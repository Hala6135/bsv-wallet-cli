# Worm Transaction Failure Investigation

> Investigation date: 2026-03-28
> Wallet DB: `~/bsv/_archived/bsv-wallet-cli-old/wallet.db`
> Toolbox version: 0.3.6 (crates.io)

## Executive Summary

The wallet on port 3322 can sign but not broadcast certain transactions. Investigation found **three distinct problems**, only one of which is related to broadcasting. The worm's failures are actually UTXO starvation, not broadcast issues.

| Problem | Root Cause | Scope | Still Happening? |
|---------|-----------|-------|-----------------|
| Worm tx failures (1,568 txs) | UTXO starvation — wallet runs out of inputs | worm | YES |
| Phantom UTXOs from nosend/sending (813) | `nosend` in UTXO selection filter | toolbox bug | YES (filter active) |
| Ghost UTXOs already spent on chain (~133) | Failed-but-broadcast txs + blind UnFail | toolbox gap | YES (no chain validation) |

**Reported balance: 2.567 BSV. Real spendable: ~2.39 BSV.** ~0.18 BSV is double-counted (already spent on chain).

---

## Problem 1: Worm UTXO Starvation

### What's happening

All 1,568 failed worm txs have **NULL `raw_tx`** — they failed before a transaction was ever constructed or signed. The wallet cannot allocate UTXOs, not broadcast.

### Evidence

```
| Status    | Has raw_tx | No raw_tx |
|-----------|-----------|-----------|
| failed    |     0     |   1,568   |
| sending   |     0     |      42   |
```

38% overall failure rate across worm transactions:

```
| Type       | Completed | Failed | Sending | Fail Rate |
|------------|-----------|--------|---------|-----------|
| worm state |     1,355 |    912 |       2 |      40%  |
| worm proof |     1,018 |    603 |      40 |      37%  |
| worm sync  |       150 |     53 |       0 |      26%  |
```

### Timeline: Catastrophic Cascade

1. **Mar 25 21:00 - Mar 26 13:00**: 100% success. 1,716 completed, 0 failed.
2. **Mar 26 14:00**: First failures (35 failed, 75 ok). UTXOs starting to deplete.
3. **Mar 26 16:00-17:00**: Brief recovery — confirmations return change UTXOs to pool.
4. **Mar 26 20:00-23:00**: Total collapse. 575 failures, 0 successes across 3 hours.
5. **Mar 27**: Intermittent recovery windows when blocks confirm, then back to 100% failure.
6. **Mar 28**: 6 failed, 5 sending, 0 ok. Pool exhausted.

### Why this happens

The worm creates **~5 createAction calls per iteration**:
- 1 Decision proof
- 1 BudgetAllocation token update
- 1-3 CapabilityProof / MemoryCommitment / MessageSend proofs

At 15-28 tx/min sustained throughput, the worm consumes UTXOs faster than confirmations return change. Each tiny tx (24-131 sats) burns one UTXO for fees. Eventually the pool hits zero.

### Worm concurrency issues

**File:** `~/bsv/rust-bsv-worm/src/runner/execute.rs` (lines 554-659)

When the worm has multiple tools to execute, it spawns them in parallel via `tokio::task::JoinSet`. Each tool can independently call `createAction`. There is:
- **No concurrency cap** on wallet requests
- **No rate limiting** on wallet operations (only on x402 external API calls)
- **No backoff** on UTXO starvation — worm maintains 15-28 tx/min even at 100% failure

Retry logic (`call_with_retry`) only covers transient errors (SQLITE_BUSY, HTTP 500/503) with 3 attempts at 100/250/500ms. UTXO starvation is not transient — it persists until confirmations arrive.

### Worm does NOT use nosend

Confirmed: all worm `createAction` calls use implicit `signAndProcess=true` (default). Options passed:
```rust
"options": {
    "acceptDelayedBroadcast": false,
    "randomizeOutputs": false,
}
```
No `noSend`, no `signAction`, no `abortAction` usage anywhere in the worm codebase.

### 42 zombie "sending" transactions

All 42 "sending" worm txs have NULL `raw_tx` — they were marked "sending" but no transaction was ever signed. These are orphaned records that will never resolve and should be cleaned up.

### Worm fixes needed

1. **Wallet concurrency semaphore** — limit concurrent `createAction` calls to 1 (or use the wallet's SpendingLock properly by not firing concurrent requests)
2. **UTXO starvation backoff** — when `createAction` fails, exponential backoff before retrying (not just for SQLITE_BUSY, but for any allocation failure)
3. **UTXO budget awareness** — check available UTXO count before starting a cycle; skip or consolidate if pool is low
4. **Batch proofs** — combine multiple 0-sat OP_RETURN proofs into a single createAction with multiple outputs instead of 5 separate calls per iteration

---

## Problem 2: `nosend` in UTXO Selection Filter (Toolbox Bug)

### What's happening

The Rust toolbox's UTXO selection query includes `nosend` in the allowed parent transaction statuses:

**File:** `~/bsv/bsv-wallet-toolbox-rs/src/storage/sqlx/create_action.rs` (lines 874, 1583)
```sql
AND t.status IN ('completed', 'unproven', 'nosend', 'sending')
```

The TypeScript reference does NOT include `nosend`:
```typescript
const txStatus: TransactionStatus[] = ['completed', 'unproven']
if (!excludeSending) txStatus.push('sending')
```

This means outputs from transactions that were **explicitly never broadcast** can be picked as inputs for new transactions. Those inputs don't exist on chain, so broadcast fails.

### Impact

- 1 spendable UTXO from nosend parent (4,925 sats) — from our debug testing
- In practice, the worm doesn't use nosend so this only affects manual testing. But it's still a bug.

### Fix

Remove `'nosend'` from the status filter. Match TS reference:
```sql
AND t.status IN ('completed', 'unproven', 'sending')
```

Or better, add `excludeSending` support like TS.

---

## Problem 3: Ghost UTXOs (Already Spent On Chain)

### What's happening

~7% of "completed" spendable UTXOs are already spent on chain. Sample of 200 found 14 already-spent.

**Extrapolated:** ~133 of 1,909 UTXOs, ~0.18 BSV double-counted in balance.

### How they got there

Some transactions were marked `failed` in the DB but **actually broadcast and confirmed on chain**. The failure handler restored their input UTXOs to spendable, but those inputs are really spent.

Known examples:
- `0f90c454...` "mega consolidation 1M sats" — 14 inputs, 316 confirmations, marked `failed` in DB
- `5ebfd59a...` "comparison test tx 56" — confirmed on chain, marked `failed`
- `c5fcb07b...` "batch size test tx 42" — confirmed on chain, marked `failed`

### Why the toolbox doesn't catch this

The Rust UnFail mechanism (`storage_sqlx.rs:3112-3123`) blindly restores outputs:
```sql
UPDATE outputs SET spendable = 1
WHERE txid = ? AND spendable = 0
```

The TS reference validates against chain before restoring:
```typescript
// TaskUnFail.ts lines 137-140
const isUtxo = await services.isUtxo(o)
if (isUtxo !== o.spendable) {
    await sp.updateOutput(o.outputId, { spendable: isUtxo })
}
```

The Rust ReviewStatus only does 1 of 3 reconciliation checks the TS version does.

### Toolbox safety net gaps vs TS reference

| Safety Net | TypeScript | Rust | Risk |
|-----------|-----------|------|------|
| UnFail output validation | `isUtxo()` check before restore | Blind `spendable = 1` | Ghost UTXOs |
| UnFail input scanning | Scans input sources, updates spentBy | Not implemented | Stale spentBy refs |
| ReviewStatus: failed tx→output cleanup | Releases outputs spentBy failed txs | Not implemented | Locked UTXOs |
| ReviewStatus: failed req→tx detection | Marks txs failed if req is invalid | Not implemented | Status mismatch |
| ReviewStatus: completed sync | Marks txs completed when proof exists | Implemented | OK |
| FailAbandoned | Configurable timeout | Hard-coded 5 min | OK |

### Fix needed

1. **Add `isUtxo()` validation** to the Rust UnFail task before restoring outputs
2. **Complete ReviewStatus** — add the 2 missing reconciliation checks from TS
3. **One-time DB cleanup** — scan all 1,909 "completed" spendable UTXOs against chain, mark spent ones as `spendable = 0`

---

## DB Cleanup Plan

### Step 1: Fix zombie "sending" txs (immediate, safe)

```sql
-- 42 sending txs with NULL raw_tx — can never resolve
UPDATE transactions SET status = 'failed', updated_at = CURRENT_TIMESTAMP
WHERE status = 'sending' AND raw_tx IS NULL;
```

### Step 2: Mark nosend outputs unspendable (immediate, safe)

```sql
UPDATE outputs SET spendable = 0, updated_at = CURRENT_TIMESTAMP
WHERE spendable = 1
AND transaction_id IN (
    SELECT transaction_id FROM transactions WHERE status = 'nosend'
);
```

### Step 3: Full chain validation (requires WoC scan, ~22 min)

Check all 1,909 "completed" spendable UTXOs against WoC's `/tx/{txid}/{vout}/spent` endpoint. Mark any that return HTTP 200 (already spent) as `spendable = 0`.

This is the only way to find the ~133 ghost UTXOs since we can't identify them from the DB alone.

---

## "Will This Never Happen Again?"

### After toolbox fixes: mostly yes

| Failure Mode | Fixed By | Confidence |
|-------------|----------|-----------|
| UTXO starvation (worm) | Worm concurrency limit + backoff | High (worm code change) |
| nosend in filter | Remove from status filter | 100% (simple fix) |
| Ghost UTXOs from ambiguous broadcast | `isUtxo()` in UnFail + complete ReviewStatus | High (matches TS reference) |
| Zombie sending txs | FailAbandoned task (already exists) | Medium (needs raw_tx NULL check) |

### Remaining edge case: ambiguous broadcast responses

The fundamental problem is: **if a broadcast response is lost (timeout, network error), you can't know if the miner accepted it.** The toolbox marks it "failed" and restores inputs, but the tx might be mined.

The TS reference handles this with TaskUnFail checking merkle proofs periodically. The Rust version needs the same — plus the `isUtxo()` validation to avoid creating ghost UTXOs during unfail.

This edge case will always exist in any wallet that broadcasts transactions. The safety net (UnFail + isUtxo) reduces the window to minutes (between broadcast failure and next UnFail cycle).

---

## Action Items

### Toolbox (`bsv-wallet-toolbox-rs`)

1. **`create_action.rs` lines 874, 1583**: Remove `'nosend'` from status filter. Add `excludeSending` parameter.
2. **`process_action.rs` line 862**: On broadcast failure, mark change outputs as `spendable = 0`.
3. **`storage_sqlx.rs` lines 3112-3123**: Add `isUtxo()` validation in UnFail before restoring outputs.
4. **`storage_sqlx.rs` lines 3148-3196**: Complete ReviewStatus with all 3 TS reconciliation checks.

### Worm (`rust-bsv-worm`)

5. **`wallet/http.rs`**: Add wallet request semaphore (limit concurrent createAction to 1).
6. **`runner/execute.rs`**: Sequential wallet calls instead of parallel when multiple tools need createAction.
7. **`runner/step.rs`**: Backoff on UTXO starvation — if createAction fails, wait for confirmations.
8. **`onchain/proofs.rs`**: Batch multiple proofs into single createAction with multiple outputs.

### DB Cleanup (one-time)

9. Run Steps 1-3 from cleanup plan above.
