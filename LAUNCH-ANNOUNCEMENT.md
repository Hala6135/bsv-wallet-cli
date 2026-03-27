# bsv-wallet-cli Launch Announcement — Draft

---

## 1. Twitter/X — Pick one main post + one reply

---

### MAIN POST — Option A: "The Count"

There are two BRC-100 wallets in the world. Both need a desktop. Neither runs on a server.

Today there are three. This one is headless, self-hosted, and built for AI agents.

Single Rust binary. All 28 BRC-100 endpoints. Wire-compatible with MetaNet Client. MIT licensed.

Your agent's favorite wallet.

https://github.com/Calhooon/bsv-wallet-cli

---

### MAIN POST — Option B: "Agents Need Wallets"

AI agents need wallets. Not browser extensions. Not desktop apps. A headless server they can call over HTTP.

Built one. Single Rust binary, all 28 BRC-100 endpoints, wire-compatible with MetaNet Client. One wallet server, N agents pointing at it. Keys never leave the server.

Open source, MIT licensed.

https://github.com/Calhooon/bsv-wallet-cli

---

### MAIN POST — Option C: "Three Commands"

Three commands to a self-hosted BRC-100 wallet:

bsv-wallet init
bsv-wallet address
bsv-wallet daemon

All 28 WalletInterface endpoints on localhost. Single Rust binary. SQLite. No GUI, no cloud, no account. Wire-compatible with MetaNet Client.

Built for servers and AI agents. Open source.

https://github.com/Calhooon/bsv-wallet-cli

---

### MAIN POST — Option D: "Short and Let the Repo Talk"

Open-sourced bsv-wallet-cli. Self-hosted BRC-100 wallet and server in a single Rust binary.

All 28 endpoints. Wire-compatible with MetaNet Client. Built for AI agents that need to pay, sign, and encrypt without a GUI.

https://github.com/Calhooon/bsv-wallet-cli

---

### MAIN POST — Option E: "The Problem"

Every BRC-100 wallet requires a desktop. Can't run one on a server, in a container, or from a cron job. If you're building agents or infrastructure, you're stuck.

Fixed it. bsv-wallet-cli is a headless, self-hosted BRC-100 wallet. Single Rust binary, all 28 endpoints, MIT licensed.

https://github.com/Calhooon/bsv-wallet-cli

---

### REPLY — Option 1: "Install in 60 Seconds"

Install and run in 60 seconds:

curl -sSf https://raw.githubusercontent.com/Calhooon/bsv-wallet-cli/main/install.sh | sh
bsv-wallet init
bsv-wallet daemon

28 BRC-100 endpoints on localhost:3322. MCP server included for Claude Code / Codex.

---

### REPLY — Option 2: "What You Get"

What's in the box:
- CLI wallet + HTTP server in one binary
- All 28 BRC-100 endpoints (transactions, crypto, certs, discovery)
- MCP server for AI coding assistants
- SQLite storage, no external deps
- Wire-compatible with MetaNet Client

curl -sSf https://raw.githubusercontent.com/Calhooon/bsv-wallet-cli/main/install.sh | sh

---

### REPLY — Option 3: "Hackathon Plug"

AgenticPay hackathon is live — if you're building AI payment infrastructure, this is the wallet layer.

One wallet server, N agents. Custody separation built in. Keys on a hardened server, agents on throwaway VMs.

curl -sSf https://raw.githubusercontent.com/Calhooon/bsv-wallet-cli/main/install.sh | sh

---

## 2. Discord/Telegram Post

**bsv-wallet-cli -- Your agent's favorite wallet.**

Just open-sourced the first headless BRC-100 wallet. It's a single Rust binary that runs as both a CLI wallet and an HTTP server implementing all 28 WalletInterface endpoints. Wire-compatible with MetaNet Client, so anything built for MetaNet Desktop works against it with zero changes. Until now the only BRC-100 wallets were MetaNet Desktop and Yours Wallet -- both GUI-only, neither deployable on a server. This one runs anywhere: your laptop, a VPS, a Docker container, a Raspberry Pi.

The real unlock is for AI agents. Run `bsv-wallet daemon` on a server, point your agent fleet at it, and every agent gets full BRC-100 capabilities -- transactions, signing, encryption, certificates -- through a simple HTTP API. There's also an MCP server binary so Claude Code, Codex, or any MCP-compatible client gets 29 wallet tools natively. Custody is separated by design: private keys never leave the wallet server, agents only speak protocol IDs and key IDs.

Install in one line and have a running wallet in under a minute:
```
curl -sSf https://raw.githubusercontent.com/Calhooon/bsv-wallet-cli/main/install.sh | sh
bsv-wallet init
bsv-wallet daemon
```
MIT licensed. Repo: https://github.com/Calhooon/bsv-wallet-cli

---

## 3. Show HN

**Title:** Show HN: bsv-wallet-cli -- Self-hosted BSV wallet and BRC-100 server in Rust

**Body:**

I built a self-hosted Bitcoin SV wallet that doubles as an HTTP server implementing all 28 endpoints of the BRC-100 WalletInterface specification. Single Rust binary, SQLite storage, no external dependencies.

The motivation was AI agents. I'm building an autonomous agent (bsv-worm) that needs to send and receive micropayments, sign messages, and manage certificates -- and there was no headless wallet that spoke BRC-100. The two existing implementations (MetaNet Desktop, Yours Wallet) are both GUI applications.

Technical details:
- Axum HTTP server on port 3322 with all 28 BRC WalletInterface endpoints (transactions, crypto, certificates, discovery)
- Wire-compatible with MetaNet Client (the reference implementation) -- same JSON shapes, same URL structure, drop-in replacement
- Translation layer handles format differences between the MetaNet Client JSON protocol and the Rust SDK types (mixed arrays vs structs, number arrays vs hex strings, camelCase aliasing)
- SQLite with WAL mode for read concurrency, FIFO spending lock to serialize UTXO selection under contention
- BEEF transaction format with automatic compaction and AtomicBEEF conversion
- MCP server binary exposes all endpoints as tools for AI coding assistants
- 41 synthetic integration tests + E2E test suite against a live wallet
- One-line install script with pre-built binaries for macOS/Linux (x86_64, aarch64), cargo fallback

The architecture separates custody from application logic. Agents never see private keys -- they request operations by protocol ID and key ID, and the wallet derives keys internally via BRC-42.

MIT licensed. Install: `curl -sSf https://raw.githubusercontent.com/Calhooon/bsv-wallet-cli/main/install.sh | sh`

https://github.com/Calhooon/bsv-wallet-cli
