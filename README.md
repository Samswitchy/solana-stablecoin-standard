# Solana Stablecoin Standard (SSS)

Production-focused open-source foundation for building stablecoins on Solana with:

- A modular SDK for token creation and operations
- Opinionated standard presets (SSS-1 and SSS-2)
- CLI-first operator workflows
- Compliance-ready extension points

> Current milestone: local execution simulator + standards-first interface contracts. This validates operator workflows and compliance logic before wiring on-chain programs.

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

- `src/` SDK surface and preset logic
- `bin/` `sss-token` admin CLI entrypoint
- `test/` presets + SDK + CLI integration tests
- `docs/` architecture, standards, operations, compliance, and API docs

## Current Status

This revision includes an executable in-memory model with:

- Supply/balance accounting (`mint`, `burn`, `transfer`)
- Pause controls and freeze guards
- Minter quota lifecycle (`add/remove/list`)
- Holder listing and audit-log queries
- SSS-2 blacklist and seize behavior with explicit failure paths

Next milestone: Anchor programs + transaction wiring + devnet deployment evidence.
