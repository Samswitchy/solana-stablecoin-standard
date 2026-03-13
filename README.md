# Solana Stablecoin Standard (SSS)

Production-focused open-source foundation for building stablecoins on Solana with:

- A modular SDK for token creation and operations
- Opinionated standard presets (SSS-1 and SSS-2)
- CLI-first operator workflows
- Compliance-ready extension points

> Current milestone: hybrid foundation. The repo now includes the original local SDK/CLI simulator for workflow iteration plus a first real Anchor workspace with `stablecoin-core` and `transfer-hook` programs.

## Reference note

I attempted to clone the suggested reference repository (`Samswitchy/solana-vault-standard`) but network restrictions in this environment returned `403` on GitHub access. The implementation below still follows the requested senior-style modular operator flow and spec alignment.

## Quick Start

```bash
npm install
npm test
./bin/sss-token.js init --preset sss-2
./bin/sss-token.js minters add desk-1 1000000
./bin/sss-token.js mint alice 500000
./bin/sss-token.js holders --min-balance 100000
./bin/sss-token.js audit-log --action mint
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
- `test/` presets + SDK + CLI integration tests
- `docs/` architecture, standards, operations, compliance, and API docs

## Current Status

This revision now includes:

- An executable in-memory model for SDK and CLI iteration
- A real Anchor workspace with PDA-based config, minter quota, blacklist, pause, seize, and role management flows
- A transfer-hook program scaffold for SSS-2 blacklist enforcement wiring
- Offline-compilable Rust workspace validation via `cargo check --offline`

Next milestone: Anchor tests, SDK/CLI RPC wiring, Token-2022 mint bootstrap flows, and devnet deployment evidence.
