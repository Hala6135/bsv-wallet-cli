# Learning — commands

## Lessons Learned
- **[2026-02-24]** `daemon` opens SQLite twice — once for `Monitor` (needs `Arc<Storage>`) and once for `Wallet` (takes owned `StorageSqlx`). This is because `Wallet::new` consumes ownership. If you try to share a single connection, the borrow checker stops you. Same pattern applies to `Services`.
- **[2026-02-24]** `serve` takes `WalletContext` by value (not `&WalletContext` like other commands) because it moves `ctx.wallet` into the shared server state via `make_wallet_state`. This means `serve` consumes the context — you can't use it after calling `serve::run`.
- **[2026-02-24]** `init` writes `.env` to CWD, not `~/.config/` or any global path. Easy to lose the root key if you `init` from a temp directory. The key is also printed to stdout, so capture it.

## Debugging Insights
- **[2026-02-24]** If `balance` returns 0 but `outputs` shows UTXOs, check the basket name. `balance` hardcodes `"default"` basket. Outputs in other baskets (e.g., from custom `internalizeAction` calls) won't appear.
- **[2026-02-24]** `fund` failures often trace back to derivation mismatches. The `anyone_key()` counterparty + BRC-29 constants (`SfKxPIJNgdI=`, `NaGLC6fMH50=`) must match exactly what `address` used to generate the funding address. If the address derivation changes, `fund` silently produces an output the wallet can't spend.
- **[2026-02-24]** `daemon`'s UTXO check runs every 5 minutes and logs via `tracing::warn`. If you don't see warnings, check `RUST_LOG` is set to at least `warn`. The threshold defaults to 3 (`MIN_UTXOS` env var).
- **[2026-02-24]** `split` with a low balance will bail with "Balance too low" even if you have UTXOs, because it reserves 200 sats for fees. With 1 UTXO at 200 sats, the available balance is 0.

## Pattern Notes
- **[2026-02-24]** Three files duplicate BRC-29 constants (`DEFAULT_DERIVATION_PREFIX`, `DEFAULT_DERIVATION_SUFFIX`, `BRC29_PROTOCOL`): `address.rs`, `split.rs`, `fund.rs`. These must stay in sync. A shared constants module would prevent drift, but hasn't been extracted yet.
- **[2026-02-24]** Every command follows the same JSON output pattern: `if ctx.json_output { serde_json::json!(...) } else { println!(...) }`. The `--json` flag on the CLI propagates through `WalletContext`. New commands should follow this convention.
- **[2026-02-24]** Commands split into two initialization patterns: most take `&WalletContext`, but `init`, `daemon`, and `services` take `&Cli` directly. `init` has no wallet yet; `daemon` needs separate `Arc` ownership; `services` only needs chain info, not a full wallet.
- **[2026-02-24]** `send` tags outputs as `"relinquish"` — this is how the wallet knows not to count sent coins in its own balance. Forgetting this tag causes sent funds to appear as spendable.
- **[2026-02-24]** `outputs` and `actions` only fetch page 1 (limit 100). `balance` is the only command that paginates exhaustively. If a wallet has >100 UTXOs, `outputs` will show a partial view.
