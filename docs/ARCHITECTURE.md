# Architecture

## Layer 1 — Base SDK

- Stablecoin configuration model (name, symbol, decimals, authorities)
- Preset + custom config merge strategy
- Core operations: mint, burn, transfer, freeze/thaw, pause/unpause
- Supply tracking and per-address balances
- Minter quota tracking

## Layer 2 — Modules

- Compliance module (blacklist add/remove, seize)
- Module access is feature-gated by preset/extension flags
- Transfer path checks blacklist state when compliance is enabled

## Layer 3 — Standards

- SSS-1: minimal stablecoin profile
- SSS-2: compliance profile with transfer-hook/permanent-delegate assumptions

## Security Model

- Role-separated operations expected (`master`, `minter`, `burner`, `pauser`)
- SSS-2 extends with `blacklister` and `seizer`
- Compliance paths fail fast when not enabled
- Pause, freeze, and blacklist checks short-circuit state changes

## Current Execution Model

This milestone uses an in-memory execution model to validate API contracts and compliance logic before wiring Solana transaction builders and Anchor programs.
