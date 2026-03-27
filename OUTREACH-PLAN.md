# bsv-wallet-cli Community Outreach Plan

> Launch window: March 25 -- April 7, 2026
> Goal: Get bsv-wallet-cli into the hands of hackathon participants, BSV developers, and the Rust community before the AgenticPay deadline (April 3) and Chronicle upgrade (April 7).

---

## Narrative

**Primary angle**: "The first headless, self-hosted BRC-100 wallet -- built for AI agents, not humans."

**Supporting angles** (pick per channel):
- **Hackathon angle**: "Free infrastructure for AgenticPay participants -- wallet server in 3 commands"
- **Rust angle**: "Pure Rust BSV wallet with SQLite, Axum, zero-dependency install"
- **AI payments angle**: "Give your AI agent a wallet. One binary, 28 endpoints, non-custodial"
- **Developer angle**: "Drop-in MetaNet Client replacement. Same JSON, no desktop required"

---

## Channels

### 1. Twitter/X (@Calgooon)

**Launch thread (Day 1):**
1. Hook: "Your agent's favorite wallet just shipped. bsv-wallet-cli: a self-hosted BRC-100 wallet server in a single Rust binary."
2. Problem: "MetaNet Client needs a desktop. CI pipelines, servers, and AI agents don't have desktops."
3. Demo: 4-line install + `bsv-wallet daemon` → 28 endpoints live. Screenshot of curl hitting `/getPublicKey`.
4. Architecture: "Rust, SQLite, Axum. No cloud, no account. Your keys, your machine."
5. Use cases: Local dev wallet / deployable server / multi-agent fleet / custody separation.
6. bsv-worm teaser: "Next week: bsv-worm -- an autonomous agent that uses this wallet to pay for x402 resources."
7. AgenticPay CTA: "Building for @AgenticPay? This is your wallet backend. `curl -sSf ... | sh` and you're funded."
8. Link to repo + tag people (see People section below).

**Tag in launch thread**: @BSVAssociation, @deggen, @AaronRussell, @imablackwolf

**Follow-up tweets (Days 2-7):**
- Day 2: "Here's how bsv-wallet-cli handles concurrent spending with a FIFO lock..." (technical deep-dive, tag @deggen)
- Day 3: AgenticPay-specific post: "3 commands to a funded wallet for the hackathon" (tag @AgenticPay, @BSVAssociation)
- Day 4: "BRC-42 key derivation, BRC-52 certificates, BEEF compaction -- all 28 endpoints, all headless" (tag @GavinMehl, @imablackwolf)
- Day 5: Retweet/QT anyone who tries it, answer questions
- Day 8 (worm launch): "bsv-worm ships today. An autonomous agent that reads, writes, and pays -- powered by bsv-wallet-cli." New thread.

### 2. BSV Discord (discord.gg/bsv)

**Channels to post in:**
- **#developers** -- Primary. Post launch announcement with repo link, install command, and 2-sentence pitch. Follow up with technical details when questions come.
- **#showcase** / **#projects** (if exists) -- Short demo post with screenshot of `bsv-wallet balance` and the HTTP server responding.
- **#hackathon** / **#agentic-pay** (if exists) -- Targeted post: "Free wallet infrastructure for hackathon participants. Self-hosted, BRC-100 compliant, installs in one command."

**Tone**: Conversational, technical. Lead with the install command. Don't oversell -- let the README do the work.

**Post template:**
```
Just shipped bsv-wallet-cli -- a self-hosted BRC-100 wallet server in a single Rust binary.

curl -sSf https://raw.githubusercontent.com/Calhooon/bsv-wallet-cli/main/install.sh | sh
bsv-wallet init
bsv-wallet daemon

28 WalletInterface endpoints on localhost:3322. Wire-compatible with MetaNet Client.
Built for servers, CI, and AI agents -- no desktop required.

Repo: https://github.com/Calhooon/bsv-wallet-cli
```

### 3. BSV Telegram

**Groups:**
- **BSV Developers** (main dev group) -- Same post as Discord #developers.
- **BSV Chat** (general) -- Shorter version, more use-case focused.
- **AgenticPay** (if a group exists for the hackathon) -- Hackathon-specific angle.

**Keep it brief in Telegram.** One message, repo link, install command. Answer questions as they come.

### 4. Reddit

**r/bsv:**
- Title: "bsv-wallet-cli: Self-hosted BRC-100 wallet server in a single Rust binary"
- Body: Concise version of the README use cases. Emphasize non-custodial, headless, AI-agent-ready. Link to repo.
- Timing: Day 1 or Day 2.

**r/rust:**
- Title: "Show r/rust: BSV wallet server -- Axum + SQLite + single binary"
- Body: Lead with the Rust angle. Axum for HTTP, sqlx for SQLite, clap for CLI. Pure Rust, no C dependencies beyond SQLite. Talk about the SpendingLock pattern (FIFO mutex for transaction serialization). Mention the translation layer challenge (SDK types vs wire format). This audience cares about architecture, not BSV marketing.
- Timing: Day 2 or 3 (after any initial bugs from Day 1 are fixed).
- **Important**: r/rust is allergic to marketing. Lead with technical substance. No "revolutionary" or "game-changing" language.

### 5. Hacker News

**Show HN post:**
- Title: "Show HN: Self-hosted BSV wallet server in a single Rust binary"
- Body: 3-4 sentences. What it does, why it exists (AI agents need headless wallets), how to try it. Link to repo.
- Timing: Day 3 or 4. Wait until install path is battle-tested and README is polished from initial feedback.
- **Tip**: HN likes "I built X because Y didn't exist." Frame as: "I needed a headless wallet for AI agents. MetaNet Client needs a desktop. So I built one in Rust."

### 6. dev.to

**Blog post:**
- Title: "Building a Headless Wallet Server for AI Agents in Rust"
- Angle: Technical walkthrough. Not a product announcement -- a story about the engineering decisions.
- Sections:
  1. The problem (AI agents can't run desktop wallets)
  2. Architecture (Axum, SQLite, the translation layer)
  3. The SpendingLock pattern (why concurrent UTXO spending is hard)
  4. Wire compatibility (matching someone else's JSON format byte-for-byte)
  5. What's next (bsv-worm, the autonomous agent)
- Timing: Day 4-5. Polish based on community feedback.
- Cross-post to: Hashnode, Medium (if you use them).

### 7. Rust Community

**Rust Discord (#showcase or #projects):**
- Same framing as r/rust. Technical, no marketing language. "Here's a wallet server I built with Axum and sqlx."

**This Week in Rust:**
- Submit to "Call for Participation" or "New Crates" section: https://github.com/rust-lang/this-week-in-rust
- Timing: Submit by Wednesday for the following Thursday's edition. Submit Day 1 for the March 27 edition if possible, otherwise target April 3.

---

## People to Reach Out To

### BSV Ecosystem (Priority -- reach before April 3)

| # | Name | Handle | Why they'd care | Suggested angle |
|---|------|--------|-----------------|-----------------|
| 1 | **BSV Association** | @BSVAssociation | 36K followers, biggest amplifier. They promote BRC-compliant tooling. | "First headless BRC-100 wallet server. All 28 endpoints. Open source, MIT licensed." Ask for RT or inclusion in their developer newsletter. |
| 2 | **Deggen** (Darren) | @deggen | Distributed apps lead at BSV Association. Most active technical voice (2.8K followers). Cares about BRC compliance and developer tools. | "Pure Rust implementation of all 28 WalletInterface endpoints. Wire-compatible with MetaNet Client. Would love your feedback on BRC compliance." DM first, then public tag. |
| 3 | **Ry4N** (imablackwolf) | @imablackwolf | Actively building BRC-100 wallet tooling. Direct peer -- will understand the value immediately. | "Built a headless BRC-100 wallet server in Rust. Implements the same WalletInterface you're working with. Happy to compare notes on BRC-42 key derivation and certificate handling." |
| 4 | **Gavin Mehl** | @GavinMehl | Tracks wallet compliance status across the ecosystem. | "bsv-wallet-cli implements all 28 BRC WalletInterface endpoints. Would be great to get it on your compliance tracker." |
| 5 | **Aaron Russell** | @AaronRussell | BSV Association developer relations / education. | "This could be useful for developer onboarding -- install in one command, no desktop needed. Happy to write a tutorial for the BSV Academy if there's interest." |
| 6 | **AgenticPay** (org) | @AgenticPay | Their hackathon participants need wallet infrastructure. bsv-wallet-cli is exactly that. | "bsv-wallet-cli gives hackathon participants a self-hosted BRC-100 wallet in 3 commands. Happy to write a quick-start guide for AgenticPay builders." |
| 7 | **Jake Jones** (Bsvweb/BSV Browser) | @JakeJonesBSV (or similar) | Just launched BSV Browser (March 23). Ecosystem momentum, potential integration. | "Congrats on BSV Browser launch. bsv-wallet-cli could serve as a headless backend for browser-based apps -- same wire format as MetaNet Client." |

### Rust / Broader Developer Community

| # | Name | Handle | Why they'd care | Suggested angle |
|---|------|--------|-----------------|-----------------|
| 8 | **This Week in Rust** | @thisweekinrust | Curated newsletter, ~20K readers. New open-source Rust projects get featured. | Submit to the GitHub repo for inclusion in "Interesting Crates" or "Call for Participation." |
| 9 | **Axum maintainers/community** | Tokio Discord | Built on Axum -- good showcase of a real-world Axum service with auth middleware, CORS, FIFO spending lock. | Post in Tokio Discord #showcase. "Built a wallet server on Axum. Here's the interesting parts: FIFO mutex for transaction serialization, translation layer for wire compatibility." |
| 10 | **AI agent builders** (general) | Various | Anyone building autonomous agents that need to make payments. | "If your AI agent needs to hold funds and make payments, this is the wallet backend. Non-custodial, 28 standardized endpoints, one binary." Post in AI agent communities (AutoGPT, LangChain, Claude Code discords). |

### Individual Outreach (DM or email)

| # | Name | Why | Action |
|---|------|-----|--------|
| 11 | **Deggen** | Gatekeeper for BSV developer credibility. His endorsement carries weight. | DM on Twitter/Discord. Share repo. Ask for technical review. Be specific: "Would appreciate your eyes on the BRC-42 implementation and the BEEF compaction approach." |
| 12 | **Ry4N** | Peer working on same problem space. Potential collaborator. | DM. "I see you're working on BRC-100 tooling. I built a Rust implementation -- would love to compare approaches." |
| 13 | **BSV Association dev relations** | Official channels amplify. | Email or DM Aaron Russell. Ask about: developer newsletter inclusion, AgenticPay hackathon promotion, BSV Academy tutorial opportunity. |
| 14 | **Rust crypto/payments newsletter authors** | Niche but high-signal audience. | Find authors of Rust crypto newsletters or blog posts about payment systems in Rust. Send a brief note. |

---

## Timing

### Key Dates

| Date | Event | Relevance |
|------|-------|-----------|
| **March 25-26** | bsv-wallet-cli ships | Launch window opens |
| **March 27** | This Week in Rust deadline | Submit for March 27 edition |
| **April 1-2** | bsv-worm ships (~1 week after wallet) | Second wave of attention |
| **April 3** | AgenticPay registration closes | Must reach hackathon participants before this |
| **April 7** | Chronicle upgrade | Ecosystem attention peaks -- ride the wave |

### Constraints
- bsv-wallet-cli must ship before any outreach begins (no vaporware announcements)
- bsv-worm follows ~1 week later as the "killer app" that demonstrates the wallet in action
- AgenticPay deadline is hard -- everything hackathon-related must land by April 2 at the latest
- Chronicle upgrade on April 7 means the BSV community will be highly active that week

---

## Week 1: Wallet Launch (March 25-31)

| Day | Date | Action |
|-----|------|--------|
| **Tue** | Mar 25 | Ship bsv-wallet-cli. Final README polish. Verify install script works on clean machine. |
| **Wed** | Mar 26 | **Launch day.** Twitter thread (8 tweets). BSV Discord #developers post. BSV Telegram post. DM Deggen and Ry4N. Submit to This Week in Rust. |
| **Thu** | Mar 27 | r/bsv post. Reply to any Discord/Twitter responses. DM BSV Association dev relations about hackathon promotion. |
| **Fri** | Mar 28 | r/rust post (technical angle). Rust Discord #showcase. Monitor feedback, fix any install issues. |
| **Sat** | Mar 29 | dev.to blog post draft. Engage with anyone who tried it. |
| **Sun** | Mar 30 | Finalize dev.to post. Prep Hacker News submission. |
| **Mon** | Mar 31 | Show HN post (morning, ~10am ET for best visibility). AgenticPay-specific Twitter post + Discord post. |

## Week 2: Worm Launch + Hackathon Push (April 1-7)

| Day | Date | Action |
|-----|------|--------|
| **Tue** | Apr 1 | Ship bsv-worm. New Twitter thread: "bsv-worm: an autonomous agent powered by bsv-wallet-cli." Tag same people. |
| **Wed** | Apr 2 | **Last push before AgenticPay deadline.** Post "hackathon quick-start" in all BSV channels. "3 commands to a funded wallet for AgenticPay." |
| **Thu** | Apr 3 | AgenticPay registration closes. Shift focus from hackathon to broader developer audience. |
| **Fri** | Apr 4 | Publish dev.to blog post (if not already). Cross-post to Hashnode/Medium. |
| **Sat-Sun** | Apr 5-6 | Engage with community. Write follow-up Twitter thread on a specific technical topic (BEEF compaction, SpendingLock, BRC-42). |
| **Mon** | Apr 7 | **Chronicle upgrade day.** Tweet: "Chronicle just upgraded. bsv-wallet-cli is ready -- all 28 BRC-100 endpoints, headless, self-hosted." Ride the ecosystem attention. |

---

## Metrics to Track

- GitHub stars + forks (baseline: 0)
- Install script downloads (add a simple counter if possible, or track via GitHub release downloads)
- Discord/Telegram questions (signal of real usage)
- Twitter impressions on launch thread
- r/rust upvotes (measures whether the technical angle landed)
- HN points (measures whether the general-audience pitch worked)
- AgenticPay participants who mention using bsv-wallet-cli

---

## Assets to Prepare Before Launch

- [ ] README is polished and accurate (staging repo version)
- [ ] Install script tested on clean macOS and Linux machines
- [ ] `cargo install` path works from the public repo
- [ ] 2-3 screenshots/terminal recordings: install, daemon startup, curl to an endpoint
- [ ] One-paragraph pitch ready to copy-paste across channels
- [ ] Twitter thread drafted and ready to post
- [ ] DM messages drafted for Deggen, Ry4N, BSV Association

---

## Do Not

- Do not announce before the repo is public and the install works
- Do not use hype language in r/rust or HN ("revolutionary", "game-changing", "the future of")
- Do not spam channels -- one post per channel, then engage in replies
- Do not promise features that aren't shipped (bsv-worm is "coming next week", not "available now")
- Do not tag more than 4 people in a single tweet (looks desperate)
- Do not post the same text across all channels -- tailor the angle to the audience
