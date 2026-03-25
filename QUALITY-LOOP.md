# Quality Loop: Wallet CLI Open-Source Release

> Ship a wallet that works, not a wallet that compiles.

## The Loop

```
+---------------------------------------------------------------------+
|                                                                     |
|  1. AUDIT         Read every line. Check:                           |
|                   - Are path deps gone? (crates.io only)            |
|                   - Any hardcoded keys, URLs, secrets?              |
|                   - LICENSE file present and correct?                |
|                   - Cargo.toml metadata complete?                   |
|                                                                     |
|  2. CLEAN BUILD   Fresh clone → cargo build. No sibling repos.     |
|                   If it doesn't build from scratch, it doesn't      |
|                   ship.                                              |
|                                                                     |
|  3. SYNTHETIC     cargo test --test integration                     |
|                   41 tests, no live wallet needed.                  |
|                   All pass, zero warnings.                           |
|                                                                     |
|  4. LIVE WALLET   Start daemon, run E2E against it.                |
|                   Real SQLite, real keys, real crypto.              |
|                                                                     |
|  5. DOWNSTREAM    Start worm against THIS wallet.                  |
|                   Run worm E2E scenarios that hit wallet ops.       |
|                   If the worm breaks, the wallet isn't ready.       |
|                                                                     |
|  6. INSPECT       Read test output. Not pass/fail — the actual     |
|                   responses. Are balances correct? Are signatures   |
|                   valid? Are errors clear and actionable?           |
|                                                                     |
|  7. TRIAGE        Fix what's broken. Loop until clean.             |
|                                                                     |
+---------------------------------------------------------------------+
```

## Step 1: Audit Checklist

Run before any testing. These are release blockers.

### Packaging
- [ ] `Cargo.toml` has `license = "MIT"`
- [ ] `Cargo.toml` has `description`, `repository`, `homepage`, `keywords`
- [ ] `Cargo.toml` deps use crates.io versions, not `path = "../..."`
  ```toml
  # MUST be this, not path deps:
  bsv-wallet-toolbox = { package = "bsv-wallet-toolbox-rs", version = "0.1", features = ["sqlite"] }
  bsv-sdk = { package = "bsv-rs", version = "0.3", features = ["full"] }
  ```
- [ ] LICENSE file exists at repo root
- [ ] `.gitignore` covers `.env`, `*.db`, `*.db-shm`, `*.db-wal`, `target/`
- [ ] No `.env` or `wallet.db` committed (check full git history: `git log --all --diff-filter=A -- .env wallet.db`)

### Secrets scan
```bash
# Check for hardcoded private keys (hex strings that could be keys)
grep -rn '[0-9a-f]\{64\}' src/ tests/ --include="*.rs" | grep -v test | grep -v "//\|pub const\|ANYONE_KEY"

# Check for hardcoded URLs pointing to private infrastructure
grep -rn 'calhouninfra\|babbage\.systems\|localhost' src/ --include="*.rs"

# Check CLAUDE.md / LEARNING.md for internal notes
cat CLAUDE.md LEARNING.md 2>/dev/null
```

### Documentation
- [ ] README.md reflects crates.io install path (`cargo install bsv-wallet-cli`)
- [ ] README.md does NOT reference `path = "../..."` builds
- [ ] `.env.example` exists with all optional env vars documented
- [ ] CONTRIBUTING.md exists (at minimum: build, test, PR process)

## Step 2: Clean Build

This is the most important test. If a stranger can't build it, nothing else matters.

```bash
# Simulate a fresh clone
cd /tmp
git clone https://github.com/Calhooon/bsv-wallet-cli.git wallet-test
cd wallet-test

# Must succeed with ZERO sibling repos
cargo build --release 2>&1 | tee build.log

# Check for warnings
cargo clippy -- -D warnings 2>&1 | tee clippy.log

# Build the MCP server too
cd mcp && cargo build --release 2>&1 | tee mcp-build.log
```

**Pass criteria:**
- `cargo build --release` exits 0
- `cargo clippy -- -D warnings` exits 0
- `cd mcp && cargo build --release` exits 0
- No warnings in any build

## Step 3: Synthetic Tests (No Live Wallet)

```bash
# Run all 41 synthetic tests
cargo test --test integration 2>&1 | tee synthetic.log

# Verify count
grep -c "test result:" synthetic.log  # should show "41 passed"
```

**What these cover:**
| Category | Tests | Endpoints |
|----------|-------|-----------|
| Status | 5 | isAuthenticated, getHeight, getNetwork, getVersion, waitForAuthentication |
| Crypto | 4 | getPublicKey, encrypt/decrypt, sign/verify, hmac |
| Transactions | 2 | listActions (empty), listOutputs (empty) |
| Certificates | 1 | listCertificates (empty) |
| Discovery | 2 | discoverByIdentityKey, discoverByAttributes |
| Edge cases | 6 | large payload, bad ciphertext, wrong signature, missing Origin |
| Error paths | 4 | insufficient funds, invalid reference, nonexistent output, invalid tx |
| Cert lifecycle | 3 | acquire → prove → relinquish |
| Key linkage | 2 | counterparty linkage, specific linkage |
| Derived keys | 1 | BRC-42 derived key generation |
| Auth | 1 | Bearer token enforcement |

**Known gaps (synthetic can't cover):**
- No actual spend transaction (createAction → sign → broadcast)
- No concurrent operation safety (FIFO lock)
- No UTXO split/merge under load
- No chain confirmation polling

## Step 4: Live Wallet E2E

Requires a funded wallet instance. These test real crypto, real SQLite, real chain queries.

```bash
# Terminal 1: Start fresh wallet
cd /tmp/wallet-e2e-test
bsv-wallet init
# Fund it (need ~50,000 sats for safety margin)
bsv-wallet daemon

# Terminal 2: Run E2E tests
WALLET_URL=http://localhost:3322 cargo test --test integration e2e_ -- --test-threads=1 --nocapture 2>&1 | tee e2e.log
```

**The 8 E2E tests:**
| Test | What it proves |
|------|---------------|
| `e2e_status_endpoints` | Wallet is alive, chain height real, network correct |
| `e2e_crypto_roundtrip` | encrypt→decrypt and sign→verify work with real keys |
| `e2e_certificate_lifecycle` | acquire→prove→relinquish on real wallet state |
| `e2e_key_linkage` | BRC-69/70 key linkage with real derivation |
| `e2e_create_and_abort_action` | createAction (unsigned) → abort releases UTXOs |
| `e2e_sign_action_happy_path` | createAction (unsigned) → signAction succeeds |
| `e2e_internalize_action_real_beef` | Internalizing a real BEEF transaction |
| `e2e_nosend_flow` | Transaction with signAndProcess:false |

**Inspect manually after E2E:**
```bash
# Check wallet state is clean after tests
bsv-wallet balance          # Should be close to starting balance (minus fees)
bsv-wallet outputs          # No orphaned/locked UTXOs
bsv-wallet actions          # All test actions visible in history
```

## Step 5: Downstream — Worm E2E Against This Wallet

This is the real test. The worm is the primary consumer of bsv-wallet-cli. If the worm breaks, the wallet isn't ready.

### Setup
```bash
# Terminal 1: wallet daemon (from Step 4, already running)
# Wallet must be on port 3322 (worm default) or configure WORM_WALLET_URL

# Terminal 2: Build and start worm
cd ~/bsv/rust-bsv-worm
cargo build --release
cargo run --release -- serve --port 8080

# Terminal 3: Run worm E2E scenarios
cd ~/bsv/rust-bsv-worm/tests/integration
```

### Tier 1: Canary (must pass, ~$0.01)
```bash
node run.js --canary
```
If canary fails, stop. The wallet can't serve basic LLM inference requests.

### Tier 2: Wallet-Specific Scenarios (~$0.05)
These scenarios directly exercise wallet operations:
```bash
node run.js --id 9,10,3
```

| ID | Name | What it tests via wallet |
|----|------|-------------------------|
| 9 | `wallet_balance` | Direct `wallet_balance()` tool call → must return real sats |
| 10 | `budget_awareness` | Budget calculation from wallet spend history |
| 3 | `self_knowledge_network` | Network detection from wallet state |

### Tier 3: On-Chain State Scenarios (~$0.10)
These test the wallet's transaction and proof infrastructure:
```bash
node run.js --id 13,15,20,25
```

| ID | Name | What it tests via wallet |
|----|------|-------------------------|
| 13 | `audit_introspection` | Bulk read of BRC-18 proof chain |
| 15 | `certificate_awareness` | BRC-52 certificate queries |
| 20 | `onchain_proof_txid` | Read most recent proof txid from on-chain state |
| 25 | `introspection_identity` | Identity key awareness |

### Tier 4: Payment Infrastructure (~$0.15)
Every scenario exercises x402 payment through the wallet. Run a broader set:
```bash
node run.js --tier trivial
```
This validates BRC-31 auth handshake, x402 payment construction, UTXO selection, and change handling across multiple sequential payments.

### Tier 5: Full Suite (~$0.30-0.50)
Only after Tiers 1-4 pass:
```bash
node run.js
```

## Step 6: Inspection

### Synthetic test output
```bash
# Any test that took > 5s? (timeout/lock issue)
grep "test .* ok" synthetic.log

# Any warnings in output?
grep -i "warn\|error\|panic" synthetic.log
```

### E2E test output
```bash
# Check actual response bodies, not just pass/fail
grep -A5 "e2e_" e2e.log

# Verify balance didn't leak (no orphaned UTXOs)
bsv-wallet balance
bsv-wallet outputs --basket default
```

### Worm E2E transcript inspection
For each worm scenario, read the actual transcript:
```bash
TASK_DIR=~/bsv/rust-bsv-worm/working/tasks

# Find latest task for scenario 9 (wallet_balance)
ls -lt $TASK_DIR/*/session.jsonl | head -5

# Timeline of what happened
python3 -c "
import json, sys
for line in open(sys.argv[1]):
    e = json.loads(line)
    t = e.get('type','')
    if t == 'tool_call':
        print(f'  CALL {e.get(\"name\")} {str(e.get(\"arguments\",{}))[:80]}')
    elif t == 'tool_result':
        print(f'  -> {e.get(\"name\")} ok={e.get(\"success\")} sats={e.get(\"sats_paid\",0)}')
    elif t == 'think_response':
        print(f'THINK: sats={e.get(\"sats_paid\",0)} tools={len(e.get(\"tool_calls\",[]))}')
    elif t == 'session_end':
        print(f'END: iters={e.get(\"iterations\")} sats={e.get(\"sats_spent\")}')
" $TASK_DIR/<TASK_ID>/session.jsonl
```

**Check for these red flags:**
- [ ] `wallet_balance` returns 0 or error → wallet not connected
- [ ] BRC-31 401 errors in transcript → auth session stale/broken
- [ ] `sats_paid: 0` on x402 calls → payment not flowing through wallet
- [ ] SQLite lock errors → concurrent access regression
- [ ] Agent retries same tool call 3+ times → wallet returning unexpected format
- [ ] Balance after tests differs from expected by more than test cost → UTXO leak

## Step 7: Triage

| Issue type | Action |
|------------|--------|
| Clean build fails | Fix Cargo.toml deps. This is the #1 blocker. |
| Synthetic test fails | Fix in wallet-cli code. These are deterministic. |
| E2E test fails | Check if wallet was funded. Check if chain services are up. |
| Worm canary fails | Check wallet port (default 3322). Check CORS Origin header. |
| Worm scenario fails | Read transcript. Is the wallet returning bad data or is the worm misinterpreting? |
| Performance regression | Check FIFO lock contention. Check SQLite WAL mode. |
| Secrets found in audit | Remove from git history (`git filter-branch` or BFG). Re-audit. |

## Expected Timeline

| Phase | Effort | Cost |
|-------|--------|------|
| Audit + packaging fixes | 2-3 hours | $0 |
| Clean build verification | 30 min | $0 |
| Synthetic tests | 5 min | $0 |
| Live wallet E2E | 15 min | ~$0.01 (chain fees only) |
| Worm E2E Tier 1-3 | 20 min | ~$0.15 |
| Worm E2E full suite | 30 min | ~$0.50 |
| Inspection + triage | 1 hour | $0 |
| Fix loop (expect 1-2 rounds) | 1-2 hours | ~$0.50 |
| **Total** | **~Half a day** | **~$1.15** |

## Known Test Gaps (Post-Launch)

These are NOT blockers for open-source release but should be filed as issues:

1. **No happy-path spend test** — All E2E transaction tests abort. No test validates createAction → sign → broadcast → confirm. File as issue.
2. **No concurrent safety test** — The FIFO spending lock is documented but never tested under contention. File as issue.
3. **No UTXO split stress test** — `bsv-wallet split --count 10` is never tested with concurrent spenders. File as issue.
4. **No MCP server tests** — The `mcp/` binary has zero tests. File as issue.
5. **No CI/CD** — GitHub Actions should run synthetic tests on every PR. File as issue.
6. **No chain service failover test** — Chaintracks down → WoC/BHS fallback is untested. File as issue.

## When to Run This Loop

- Before making the repo public (full loop)
- Before publishing to crates.io (full loop)
- After any Cargo.toml dependency change (Steps 2-3 minimum)
- After any endpoint handler change (Steps 3-5)
- After any storage/SQLite change (Steps 3-6, full inspection)
- After any crypto/signing change (Steps 3-6, full inspection)
