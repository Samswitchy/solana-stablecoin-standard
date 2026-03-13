# Project Roadmap — Solana Stablecoin Standard

This roadmap tracks what is already done and what remains to reach a production-grade SSS implementation.

## Progress Legend

- ✅ Done
- 🟡 In progress / partially done
- ⬜ Not started

## 1) Foundation and Repository Setup

- ✅ Initialize repository with core structure (`src/`, `bin/`, `test/`, `docs/`)
- ✅ Add package metadata and scripts
- ✅ Add baseline README and architecture docs
- ✅ Define SSS-1 and SSS-2 preset concepts

## 2) SDK (Current Local Simulator Layer)

- ✅ Implement `SolanaStablecoin` class scaffold
- ✅ Add core operations (`mint`, `burn`, `transfer`, `freeze`, `thaw`, `pause`, `unpause`)
- ✅ Add minter quota model and checks
- ✅ Add compliance surface (`blacklistAdd`, `blacklistRemove`, `seize`)
- ✅ Add audit log and holder/minter query methods
- 🟡 Keep API shape stable for migration to real on-chain transaction builders

## 3) CLI (Operator Workflow)

- ✅ Add `sss-token` CLI entrypoint
- ✅ Add preset and custom initialization
- ✅ Add state persistence (`.sss-state.json`) and `--state` override
- ✅ Add token operation commands
- ✅ Add management commands (`minters`, `holders`, `audit-log`)
- ✅ Add compliance commands (`blacklist`, `seize`)
- 🟡 Upgrade CLI from simulator execution to real RPC/Anchor execution

## 4) Documentation

- ✅ README with quickstart and status
- ✅ `ARCHITECTURE.md`
- ✅ `SDK.md`
- ✅ `OPERATIONS.md`
- ✅ `SSS-1.md`
- ✅ `SSS-2.md`
- ✅ `COMPLIANCE.md`
- ✅ `API.md`
- 🟡 Update all docs once on-chain programs are fully wired

## 5) Testing

- ✅ Unit tests for presets
- ✅ SDK behavior tests
- ✅ CLI persistence/integration-style tests
- 🟡 Expand negative-path and edge-case coverage
- ⬜ Add Anchor program instruction tests
- ⬜ Add full end-to-end preset integration tests against local validator/devnet
- ⬜ Add fuzz/property testing strategy

## 6) On-Chain Programs (Production Core)

- ✅ Create Anchor workspace and program crate(s)
- ✅ Implement stablecoin config account and role-based access control on-chain
- 🟡 Implement core instructions on-chain (`initialize`, `mint`, `burn`, `freeze/thaw`, `pause/unpause`, role updates)
- 🟡 Implement SSS-2 compliance instructions on-chain (`add/remove blacklist`, `seize`)
- ✅ Ensure SSS-2 instructions fail gracefully when compliance disabled
- 🟡 Implement/attach transfer-hook enforcement path

## 7) TypeScript SDK (Real Chain Integration)

- ⬜ Replace local-only behavior with transaction builders/signers
- ⬜ Add account/state readers from chain
- ⬜ Add explicit error decoding and typed responses
- ⬜ Keep backwards-compatible high-level API ergonomics

## 8) Backend Services and Deployment Ops

- ⬜ Implement mint/burn orchestration service
- ⬜ Implement event listener/indexer
- ⬜ Implement compliance service for SSS-2 workflows
- ⬜ Implement webhook service with retries and failure handling
- ⬜ Add Dockerfiles and docker-compose setup
- ⬜ Add health checks and structured logging

## 9) Devnet Proof and Submission Assets

- ⬜ Deploy program(s) to devnet and record Program IDs
- ⬜ Capture example transaction signatures for required flows
- ⬜ Add reproducible scripts for deployment and smoke checks
- ⬜ Finalize submission-ready documentation
- ⬜ Record short showcase video with strongest points of implementation

---

## Current Snapshot

The project now has both:

- a strong local simulator foundation with SDK + CLI + docs + tests
- a compiling Anchor workspace with first-pass `stablecoin-core` and `transfer-hook` programs

The next major phase is transaction wiring, Anchor tests, and devnet proof.
