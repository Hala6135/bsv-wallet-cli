# bsv-wallet-cli

> Single Rust binary providing both a CLI wallet and an HTTP server that implements all 28 BRC WalletInterface endpoints, wire-compatible with the MetaNet Client.

## Architecture

The binary has two modes: **CLI commands** for interactive wallet use, and an **HTTP server** (port 3322) that is wire-compatible with MetaNet Client.

```
src/
  main.rs          — CLI entrypoint, routes clap subcommands
  context.rs       — WalletContext: loads ROOT_KEY, opens SQLite, configures services
  cli.rs           — Clap argument definitions
  commands/        — One file per CLI command (init, send, daemon, serve, split, etc.)
  server/
    mod.rs         — Axum router setup, CORS, auth middleware, SpendingLock
    handlers.rs    — All 28 endpoint handlers, each translating MetaNet JSON ↔ SDK types
    types.rs       — MetaNet Client JSON request/response structs (the translation layer)
```

**Dependency chain**: `bsv-wallet-cli` → `bsv-wallet-toolbox-rs` (wallet engine, SQLite storage, signing, broadcasting) → `bsv-rs` (WalletInterface trait, crypto primitives). Both are published on crates.io.

## Conventions

- **MetaNet Client wire compatibility** is the top constraint. The HTTP server must produce identical JSON to the MetaNet Client so existing tools (x402 skill, BRC-31 auth) work without modification.
- **Translation layer** (`server/types.rs`): MetaNet Client uses different JSON shapes than the Rust SDK. Key differences:
  - `protocolID`: mixed array `[2, "name"]` vs SDK's `Protocol { security_level, protocol_name }`
  - `counterparty`: hex string vs `Counterparty::Other(PublicKey)`
  - Binary data (`tx`, `signature`): JSON number arrays `[0,1,2,...]` vs hex strings
  - Field names: MetaNet Client uses `protocolID` / `keyID` (capital D). Use `#[serde(alias = "protocolID")]` since `rename_all = "camelCase"` produces lowercase `d`.
- **SpendingLock**: A FIFO mutex serializes `createAction` calls. With limited UTXOs, concurrent spending races on SQLite's write lock. Non-spending endpoints (crypto, queries) run fully concurrent.
- **Daemon vs Serve**: `daemon` = Monitor (background sync tasks) + HTTP server. `serve` = HTTP server only (dev mode, no background sync).

## Development

```bash
# Build
cargo build --release

# Run daemon (default port 3322)
bsv-wallet daemon

# Run daemon on a custom port
bsv-wallet daemon --port 3322

# Run HTTP server only (no background sync)
bsv-wallet serve --port 3322

# Run tests (41 synthetic tests, no server needed)
cargo test --test integration

# E2E tests (requires a running daemon with funded wallet)
bsv-wallet daemon &
WALLET_URL=http://localhost:3322 cargo test --test integration e2e_ -- --test-threads=1
```

Environment variables: `ROOT_KEY` (required, set by `bsv-wallet init`), `CHAINTRACKS_URL` (optional, for chain tracking), `AUTH_TOKEN` (optional, bearer auth), `RUST_LOG` for tracing. Note: port is set via `--port` CLI flag, not an environment variable.

## Decisions

- **Axum over JSON-RPC**: The MetaNet Client uses REST-style POST endpoints, not JSON-RPC. Matching its URL structure (`/createAction`, `/getPublicKey`, etc.) ensures wire compatibility.
- **SQLite via sqlx**: Single-file database for portability. No external database process needed.
- **Port 3322**: Default HTTP server port. Override with `--port`.
- **crates.io deps**: `bsv-wallet-toolbox-rs` and `bsv-rs` are published on crates.io. No sibling directories needed — `cargo build` works from a fresh clone.
- **BEEF → AtomicBEEF conversion**: WoC returns standard BEEF (`0x0100beef`), but `internalizeAction` requires AtomicBEEF (`0x01010101`). Conversion prepends the AtomicBEEF header + reversed txid before the standard BEEF payload.
- **createAction signing modes**: `sign_and_process: true` + `noSend: false` = signed and broadcast (default). `noSend: true` = signed but not broadcast. `sign_and_process: false` = unsigned template for deferred signing via `signAction`. These are distinct flows — `noSend` is not a dry run.
