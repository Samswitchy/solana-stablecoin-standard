# Architecture

## Layer 1 — Base SDK

- Stablecoin configuration model (name, symbol, decimals, authorities)
- Preset + custom config merge strategy
- Core operations: mint, burn, transfer, freeze/thaw, pause/unpause
- Supply tracking and per-address balances
- Minter quota tracking

## Layer 1B — On-Chain Core

- `programs/stablecoin-core` Anchor program
- PDA-backed stablecoin config account keyed by mint
- Role-separated authorities for master, mint admin, burner, pauser, freezer, blacklister, and seizer
- PDA-backed minter quota accounts and blacklist accounts
- Token-2022 CPI paths for mint, burn, freeze/thaw, and seize

## Layer 2 — Modules

- Compliance module (blacklist add/remove, seize)
- Module access is feature-gated by preset/extension flags
- Transfer path checks blacklist state when compliance is enabled
- `programs/transfer-hook` now exists as the first enforcement scaffold for SSS-2

## Layer 3 — Standards

- SSS-1: minimal stablecoin profile
- SSS-2: compliance profile with transfer-hook/permanent-delegate assumptions

## Security Model

- Role-separated operations expected (`master`, `minter`, `burner`, `pauser`)
- SSS-2 extends with `blacklister` and `seizer`
- Compliance paths fail fast when not enabled
- Pause, freeze, and blacklist checks short-circuit state changes

## Current Execution Model

This repo is currently in a hybrid phase:

- The JS SDK and CLI still run as a local state simulator for operator workflow design.
- The Anchor workspace now provides the first real on-chain control plane for config, quotas, compliance flags, and token-admin CPIs.
- The remaining migration is to replace local CLI/SDK execution with RPC-backed transaction builders and full transfer-hook integration tests.
