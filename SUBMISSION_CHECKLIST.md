# Submission Checklist

## Mandatory

- [ ] `README.md` reflects the current state of the repo
- [ ] `PROJECT_ROADMAP.md` reflects the current delivery status
- [ ] `LOCALNET_PROOF.md` contains the latest localnet proof
- [ ] `DEVNET_PROOF.md` is filled with real program IDs and signatures
- [ ] `docker-compose.yml` starts the backend service stack
- [ ] `npm test` passes
- [ ] `npm run test:integration` passes
- [ ] `cargo test --offline` passes
- [ ] `anchor build` succeeds
- [ ] all required docs exist:
  - [ ] `docs/ARCHITECTURE.md`
  - [ ] `docs/SDK.md`
  - [ ] `docs/OPERATIONS.md`
  - [ ] `docs/SSS-1.md`
  - [ ] `docs/SSS-2.md`
  - [ ] `docs/COMPLIANCE.md`
  - [ ] `docs/API.md`

## Submission Assets

- [ ] PR description explains the on-chain architecture clearly
- [ ] strongest proof points are summarized:
  - [ ] transfer-hook blacklist enforcement
  - [ ] admin seize flow
  - [ ] validator-backed integration tests
  - [ ] backend service stack
- [ ] devnet Program IDs are included in the PR
- [ ] example devnet transaction signatures are included in the PR
- [ ] demo video is recorded
- [ ] X post is prepared and tags `@SuperteamBR`

## Nice To Tighten

- [ ] add more negative-path tests
- [ ] improve backend persistence and screening integration hooks
- [ ] tighten typed error decoding in the TS client
