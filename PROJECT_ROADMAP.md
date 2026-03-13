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
- ✅ Keep API shape stable for migration to real on-chain transaction builders

## 3) CLI (Operator Workflow)

- ✅ Add `sss-token` CLI entrypoint
- ✅ Add preset and custom initialization
- ✅ Add state persistence (`.sss-state.json`) and `--state` override
- ✅ Add token operation commands
- ✅ Add management commands (`minters`, `holders`, `audit-log`)
- ✅ Add compliance commands (`blacklist`, `seize`)
- ✅ Upgrade CLI from simulator execution to real RPC/Anchor execution

## 4) Documentation

- ✅ README with quickstart and status
- ✅ `ARCHITECTURE.md`
- ✅ `SDK.md`
- ✅ `OPERATIONS.md`
- ✅ `SSS-1.md`
- ✅ `SSS-2.md`
- ✅ `COMPLIANCE.md`
- ✅ `API.md`
- 🟡 Finalize docs once devnet proof is complete

## 5) Testing

- ✅ Unit tests for presets
- ✅ SDK behavior tests
- ✅ CLI persistence/integration-style tests
- ✅ Rust unit tests for on-chain role/compliance validation
- ✅ Localnet validator proof for deploy, init, minter quota, mint, blacklist, blocked transfer enforcement, seize, and status flows
- 🟡 Expand negative-path and edge-case coverage
- ⬜ Add native Anchor instruction tests beyond the current Node validator harness
- ✅ Add full end-to-end preset integration tests against a local validator
- ⬜ Add fuzz/property testing strategy

## 6) On-Chain Programs (Production Core)

- ✅ Create Anchor workspace and program crate(s)
- ✅ Implement stablecoin config account and role-based access control on-chain
- ✅ Implement core instructions on-chain (`initialize`, `mint`, `burn`, `freeze/thaw`, `pause/unpause`, role updates)
- ✅ Implement SSS-2 compliance instructions on-chain (`add/remove blacklist`, `seize`)
- ✅ Ensure SSS-2 instructions fail gracefully when compliance disabled
- ✅ Implement/attach transfer-hook enforcement path

## 7) TypeScript SDK (Real Chain Integration)

- ✅ Replace local-only behavior with transaction builders/signers
- ✅ Add account/state readers from chain
- 🟡 Add explicit error decoding and typed responses
- ✅ Keep backwards-compatible high-level API ergonomics
- ✅ Add chain deployment state serialization for CLI/operator reuse

## 8) Backend Services and Deployment Ops

- ✅ Implement mint/burn orchestration service skeleton
- ✅ Implement event listener/indexer skeleton
- ✅ Implement compliance service for SSS-2 workflows
- ✅ Implement webhook service with retries and failure handling
- ✅ Add Dockerfiles and docker-compose setup
- ✅ Add health checks and structured logging

## 9) Devnet Proof and Submission Assets

- 🟡 Deploy program(s) to devnet and record Program IDs
- 🟡 Capture example transaction signatures for required flows
- ✅ Add reproducible scripts for deployment and smoke checks
- ✅ Record localnet proof artifacts in `LOCALNET_PROOF.md`
- ⬜ Finalize submission-ready documentation
- ⬜ Record short showcase video with strongest points of implementation

---

## Current Snapshot

The project now has both:

- a strong local simulator foundation with SDK + CLI + docs + tests
- deployed and locally verified `stablecoin-core` and `transfer-hook` programs
- a chain-enabled SDK and CLI verified against localnet for initialize, minter quota, mint, blacklist, blocked transfer enforcement, seize, status, and reader flows
- validator-backed integration tests for both SSS-1 and SSS-2 happy paths
- a Dockerized backend service skeleton covering mint/burn, compliance, indexer, and webhook flows
- recorded localnet deployment and transaction signatures in `LOCALNET_PROOF.md`

## Immediate Next Steps

- Run the same proof flow on devnet and record final Program IDs and transaction signatures.
- Extend the backend skeleton into fuller production workflows and external screening integrations.
