# Solana Stablecoin Standard (SSS)

Production-focused open-source foundation for building stablecoins on Solana with:

- A modular SDK for token creation and operations
- Opinionated standard presets (SSS-1 and SSS-2)
- CLI-first operator workflows
- Compliance-ready extension points

> Current milestone: hybrid foundation with real on-chain execution. The repo now includes the original local SDK/CLI simulator for workflow iteration plus a working Anchor workspace, an on-chain TypeScript client, and a chain-enabled operator CLI.

## Reference note

I attempted to clone the suggested reference repository (`Samswitchy/solana-vault-standard`) but network restrictions in this environment returned `403` on GitHub access. The implementation below still follows the requested senior-style modular operator flow and spec alignment.

## Quick Start

```bash
npm install
npm test
npm run test:integration
npm run frontend:serve
npm run tui:admin -- --state /tmp/sss-devnet-proof.json --keypair ~/.config/solana/sss-devnet.json --rpc-url https://api.devnet.solana.com
./bin/sss-token.js init --preset sss-2
./bin/sss-token.js minters add desk-1 1000000
./bin/sss-token.js mint alice 500000
./bin/sss-token.js holders --min-balance 100000
./bin/sss-token.js audit-log --action mint
```

Localnet on-chain flow:

```bash
anchor build
solana-test-validator --reset
solana program deploy target/deploy/stablecoin_core.so --program-id target/deploy/stablecoin_core-keypair.json
solana program deploy target/deploy/transfer_hook.so --program-id target/deploy/transfer_hook-keypair.json
./bin/sss-token.js init --preset sss-2 --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./.sss-chain.json
./bin/sss-token.js minters add <AUTHORITY_PUBKEY> 1000000 --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./.sss-chain.json
./bin/sss-token.js mint <AUTHORITY_PUBKEY> 500000 --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./.sss-chain.json
./bin/sss-token.js blacklist add <AUTHORITY_PUBKEY> --reason watchlist --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./.sss-chain.json
./bin/sss-token.js status --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./.sss-chain.json
```

Custom state path:

```bash
./bin/sss-token.js init --preset sss-2 --state ./ops/dev.state.json
./bin/sss-token.js status --state ./ops/dev.state.json
```

## Preset Comparison

| Preset | Description | Extensions |
| --- | --- | --- |
| SSS-1 | Minimal Stablecoin | Mint authority, freeze authority, metadata |
| SSS-2 | Compliant Stablecoin | SSS-1 + permanent delegate + transfer hook + blacklist + seize |

## Repository Layout

- `programs/` Anchor on-chain programs (`stablecoin-core`, `transfer-hook`)
- `src/` SDK surface and preset logic
- `bin/` `sss-token` admin CLI entrypoint
- `examples/frontend/` static operator-facing demo UI
- `scripts/admin-tui.js` terminal operator dashboard
- `test/` presets + SDK + CLI integration tests
- `docs/` architecture, standards, operations, compliance, and API docs

## Current Status

This revision now includes:

- An executable in-memory model for SDK and CLI iteration
- A real Anchor workspace with PDA-based config, minter quota, blacklist, pause, seize, and role management flows
- A chain-enabled SDK client that creates Token-2022 mints, initializes metadata, and sends Anchor transactions
- A chain-enabled CLI that persists deployment metadata and executes RPC-backed operator commands
- Localnet-verified SSS-2 flow for initialize, set minter quota, mint, blacklist, blocked transfer enforcement, seize, status, and reader commands
- Validator-backed integration tests for SSS-1 and SSS-2 via `npm run test:integration`
- A Dockerized backend service stack with persistent request tracking, failure ledgers, and a shared outbox for mint/burn, compliance, indexing, and webhooks
- A polished example frontend for preset-driven creation, live service actions, and state inspection
- An interactive admin TUI for terminal-native monitoring and operations over a deployed chain state file
- Passing Rust unit tests for core role/compliance guards via `cargo test --offline`
- Recorded devnet proof for deploy, init, minter quota, mint, blacklist, blocked transfer, and seize in `DEVNET_PROOF.md`
- A public-devnet-safe `holders` / `status` fallback that derives holder state from known operators, blacklist state, and recent on-chain activity when RPC secondary indexes are unavailable

Current remaining gaps: final submission polish, demo assets, and optional deeper backend integrations like external screening persistence.

## Backend Services

The repo now includes:

- `services/mint-burn.js`
- `services/compliance.js`
- `services/indexer.js`
- `services/webhook.js`
- `docker-compose.yml`

Run the stack with:

```bash
docker compose up --build
```

Run the example frontend with:

```bash
npm run frontend:serve
```

Then open `http://127.0.0.1:4173`.

To make the frontend drive live service actions, start the backend stack too:

```bash
docker compose up --build
```

Use the admin TUI with a chain deployment state file:

```bash
npm run tui:admin -- --state ./.sss-devnet.json --keypair ~/.config/solana/sss-devnet.json --rpc-url https://api.devnet.solana.com
```

The TUI supports:

- live dashboard refresh
- mint
- burn
- pause / unpause
- blacklist add / remove
- seize

For a scripted devnet attempt, use:

```bash
./scripts/devnet-deploy.sh
```
