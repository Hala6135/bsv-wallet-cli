# BEEF Compaction — Full Story

## Problem (2026-02-28)
Stored `input_beef` blobs in `proven_tx_reqs` grew to 100-400KB per transaction. The worm was creating rapid chains of txs, each one merging its parent's stored BEEF wholesale. Since those stored BEEFs contained full ancestor chains from creation time (when ancestors were unproven), the bloat compounded exponentially.

- **Worst case**: 408KB BEEF for a 921-byte raw tx (650:1 bloat ratio)
- **474 BEEFs over 100KB**, 780 over 60KB
- **Total DB**: 162MB, of which 140MB was `proven_tx_reqs.input_beef`
- **x402 payments broken**: AtomicBEEF exceeded 60KB HTTP header limit

## Root Causes
1. `build_input_beef()` merges stored BEEFs wholesale without checking if ancestors now have proofs
2. `MAX_BEEF_RECURSION_DEPTH = 100` allowed absurdly deep ancestor chains (TS reference uses 12)
3. Depth tracking was a flat counter per txid processed, not actual chain depth
4. **Critical bug**: `Beef::trim_known_proven()` was broken — `set_bump_index()` clears `input_txids` on `BeefTx`, so the BFS reference graph saw no edges and thought every tx was a tip. Nothing ever got trimmed.

## Fixes Applied

### rust-sdk (`~/bsv/rust-sdk`)
**File: `src/transaction/beef.rs`**
- `trim_known_proven()`: Fixed reference graph construction. For proven txs (whose `input_txids` are cleared), now parses raw tx bytes via `tx_mut()` to recover input references. This lets the BFS correctly identify tips vs ancestors and remove unnecessary ancestors of proven txs.
- Added 2 tests for trim behavior

### rust-wallet-toolbox (`~/bsv/rust-wallet-toolbox`)
**File: `src/storage/sqlx/create_action.rs`**
- `MAX_BEEF_RECURSION_DEPTH`: 100 → 12 (matches TS reference `maxRecursionDepth`)
- Depth tracking: changed `pending_txids` from `Vec<String>` to `Vec<(String, usize)>` where usize is chain depth. Children get `depth + 1`. A tx with 10 inputs at depth 0 counts as depth 0, not 10.
- `compact_stored_beef()`: Before merging a stored BEEF, queries `proven_txs` for current proofs, upgrades unproven txs with BUMPs, then calls `trim_known_proven()`.

**File: `src/monitor/tasks/compact_beef.rs`** (NEW)
- `CompactBeefTask`: Monitor task running every 15 min, processes 50 largest completed `proven_tx_reqs.input_beef` blobs per cycle.

**Files also modified**: `tasks/mod.rs`, `config.rs`, `daemon.rs`, `traits.rs`, `storage_sqlx.rs`, `storage_manager.rs`

### bsv-wallet-cli (`~/bsv/bsv-wallet-cli`)
**File: `src/commands/compact.rs`** (NEW)
- `bsv-wallet compact` CLI command: runs compaction loop until all BEEFs are optimal. Includes analysis of largest BEEF structure (proven/unproven/txid-only counts).

**Files also modified**: `cli.rs`, `commands/mod.rs`, `main.rs`

## Results (2026-03-01)
After running `bsv-wallet compact`:
- **1,424 BEEFs compacted** across 35 rounds
- Largest BEEF: **408KB → 21KB** (95% reduction)
- Average BEEF: **45KB → 4.4KB**
- Over 60KB: **780 → 1** (the remaining one is `unprocessed` status, not `completed`)
- x402 payments should now work (AtomicBEEFs well under 60KB limit)

## TS Reference Comparison (`~/bsv/wallet-toolbox`)
- TS has the **same stale BEEF problem** — stored inputBEEF blobs are never compacted. Relies on 14-day purge.
- `maxRecursionDepth = 12` — we matched this
- `trustSelf = 'known'` — declared in Rust options but NOT used for BEEF building in TS either. It's for validating incoming BEEFs with txid-only entries, not for building smaller ones.
- `mergeAllocatedChangeBeefs` uses `ignoreServices: true, trustSelf: undefined` — does NOT use trustSelf for change BEEFs
- `trimInputBeef` with `knownTxids` — we already implement this (line 1861 in create_action.rs)
- Two-BEEF split (`storageBeef` vs `beef`) — not implemented, would be a larger refactor

## Still TODO
- Compare `trim_known_proven()` with `~/bsv/ts-sdk` implementation of `Beef.trimKnownProven()`
- Consider UTXO consolidation to reduce number of inputs per tx (fewer inputs = smaller BEEFs)
- The 1 remaining >60KB BEEF (`unprocessed` status) — investigate if it can be compacted
