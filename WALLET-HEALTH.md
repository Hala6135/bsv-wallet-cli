# Wallet Health Check Runbook

## Known Scar Tissue (Ignore These)

- **260 `invalid` proven_tx_reqs** — old bug, `max_attempts` was 10 instead of 144. All 404 on WoC (never mined). Dead entries.
- **282 `failed` transactions** — from toolbox starvation/change bugs (Feb 23-26). Fixed in rust-wallet-toolbox.
- **1 stuck `sending` tx** (`bcc7b83f...`) — "Micro test spend" from Feb 26. Never completed broadcast.

## Quick Health Check Queries

```sql
-- 1. Transaction status overview
SELECT status, COUNT(*) FROM transactions GROUP BY status;

-- 2. Proof request status
SELECT status, COUNT(*) FROM proven_tx_reqs GROUP BY status;

-- 3. Spendable balance (default basket only — this is the real balance)
SELECT COUNT(*) as utxos, SUM(satoshis) as sats, ROUND(SUM(satoshis)/100000000.0, 4) as bsv
FROM outputs o JOIN output_baskets b ON o.basket_id = b.basket_id
WHERE o.spendable = 1 AND b.name = 'default';

-- 4. Unproven transactions (should be 0 or only very recent)
SELECT t.txid, t.created_at, ptr.status as req_status, ptr.attempts
FROM transactions t
LEFT JOIN proven_tx_reqs ptr ON t.txid = ptr.txid
WHERE t.status = 'unproven';

-- 5. Outputs by basket
SELECT b.name, COUNT(*) as cnt, SUM(o.satoshis) as sats
FROM outputs o LEFT JOIN output_baskets b ON o.basket_id = b.basket_id
GROUP BY b.name ORDER BY sats DESC;
```

## What's Normal vs What's a Problem

### Normal
- `unproven` txs that are < 10 minutes old (waiting for next block)
- `unmined` proof reqs with < 5 attempts (still retrying)
- `failed` count = 282 (old bugs, frozen)
- `invalid` proof reqs = 260 (old bugs, frozen)

### Problem
- `unproven` txs older than 30 minutes — daemon might not be syncing proofs
- `unmined` proof reqs with high attempts but tx IS confirmed on WoC — reset to `unmined` with `attempts = 0`
- `unsent` proof reqs — never entered retry loop, reset to `unmined`
- Spendable default basket balance dropping unexpectedly
- New `invalid` proof reqs appearing (current threshold is 144 attempts = ~2.4 hours)

## Fix: Reset Stuck Proof Requests

Only do this after confirming the tx is on-chain via WoC:
```bash
curl -s "https://api.whatsonchain.com/v1/bsv/main/tx/$TXID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'confirmations: {d.get(\"confirmations\")}')"
```

If confirmed:
```sql
UPDATE proven_tx_reqs SET status = 'unmined', attempts = 0 WHERE txid = '<txid>';
```

## Fix: Check if Daemon is Actively Syncing Proofs

The `synchronize_transaction_statuses` runs every 60s. It only queries these statuses:
- `Unmined`, `Unknown`, `Callback`, `Sending`, `Unconfirmed`

It does NOT retry: `Invalid`, `Unsent`, `Completed`, `Failed`

## Baseline Numbers (Feb 27, 2026)

- ~33M sats spendable in default basket
- ~1,747 completed transactions
- 260 invalid proof reqs (old, ignore)
- 282 failed txs (old, ignore)
- Proven txs up to block ~938,115
