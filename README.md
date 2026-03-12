# Solana Stablecoin Standard (SSS)

Production-focused open-source foundation for building stablecoins on Solana with:

- A modular SDK for token creation and operations
- Opinionated standard presets (SSS-1 and SSS-2)
- CLI-first operator workflows
- Compliance-ready extension points

> Current milestone: local execution simulator + standards-first interface contracts. This intentionally validates business and compliance flows before wiring on-chain transaction builders.

## Quick Start

```bash
npm install
npm test
./bin/sss-token.js init --preset sss-1
./bin/sss-token.js init --preset sss-2
```

Custom config initialization:

```bash
./bin/sss-token.js init --custom ./stablecoin.config.json
./bin/sss-token.js init --custom ./stablecoin.config.toml
```

## Preset Comparison

| Preset | Description | Extensions |
| --- | --- | --- |
| SSS-1 | Minimal Stablecoin | Mint authority, freeze authority, metadata |
| SSS-2 | Compliant Stablecoin | SSS-1 + permanent delegate + transfer hook + blacklist + seize |

## Repository Layout

- `src/` SDK surface and preset logic
- `bin/` `sss-token` admin CLI entrypoint
- `test/` unit tests for presets and SDK behavior
- `docs/` architecture, standards, operations, compliance, and API docs

## Current Status

This revision expands the initial scaffold into an executable in-memory model with:

- Supply/balance accounting (`mint`, `burn`, `transfer`)
- Pause controls and freeze guards
- Minter quota limits
- SSS-2 blacklist and seize behavior with explicit failure paths

Next milestone: Anchor programs + transaction wiring + devnet deployment evidence.
