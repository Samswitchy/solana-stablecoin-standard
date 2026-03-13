# API Reference (Current Milestone)

## SDK

- `SolanaStablecoin.create(connection, config)`
- `OnchainSolanaStablecoin.create(connection, config)`
- `OnchainSolanaStablecoin.fromDeployment(options)`
- `SolanaStablecoin#setMinterQuota(minter, quota)`
- `SolanaStablecoin#removeMinterQuota(minter)`
- `SolanaStablecoin#listMinters()`
- `SolanaStablecoin#listHolders(minBalance?)`
- `SolanaStablecoin#getAuditLog(action?)`
- `SolanaStablecoin#mint({ recipient, amount, minter })`
- `SolanaStablecoin#burn({ holder, amount, burner })`
- `SolanaStablecoin#transfer({ from, to, amount })`
- `SolanaStablecoin#freezeAccount({ address, authority })`
- `SolanaStablecoin#thawAccount({ address, authority })`
- `SolanaStablecoin#pause({ authority })`
- `SolanaStablecoin#unpause({ authority })`
- `SolanaStablecoin#getBalance(address)`
- `SolanaStablecoin#getTotalSupply()`
- `SolanaStablecoin#compliance.blacklistAdd(address, reason)`
- `SolanaStablecoin#compliance.blacklistRemove(address)`
- `SolanaStablecoin#compliance.seize(from, to, amount)`
- `OnchainSolanaStablecoin#fetchConfig()`
- `OnchainSolanaStablecoin#getTotalSupply()`
- `OnchainSolanaStablecoin#status()`
- `OnchainSolanaStablecoin#mint({ recipient, amount, minter })`
- `OnchainSolanaStablecoin#burn({ holder, amount, burner, holderAuthority })`
- `OnchainSolanaStablecoin#freezeAccount({ address, authority })`
- `OnchainSolanaStablecoin#thawAccount({ address, authority })`
- `OnchainSolanaStablecoin#pause({ authority })`
- `OnchainSolanaStablecoin#unpause({ authority })`
- `OnchainSolanaStablecoin#setMinterQuota(minter, quota, authority?)`
- `OnchainSolanaStablecoin#removeMinterQuota(minter, authority?)`
- `OnchainSolanaStablecoin#listMinters()`
- `OnchainSolanaStablecoin#listHolders(minBalance?)`
- `OnchainSolanaStablecoin#listBlacklisted()`
- `OnchainSolanaStablecoin#getAuditLog(action?)`
- `OnchainSolanaStablecoin#compliance.blacklistAdd(address, reason, authority?)`
- `OnchainSolanaStablecoin#compliance.blacklistRemove(address, authority?)`
- `OnchainSolanaStablecoin#compliance.seize(from, to, amount, authority?)`

## CLI

All CLI commands accept `--state <path>` to read/write an isolated state snapshot.
Chain-backed execution is enabled when `--rpc-url`, `--keypair`, or an existing chain deployment state file is present.
Chain state snapshots now also persist known holder addresses so `holders` and `status` can fall back cleanly on public RPCs that do not expose Token-2022 secondary indexes.

- `sss-token init --preset sss-1|sss-2`
- `sss-token init --custom <config.json|config.toml>`
- `sss-token mint <recipient> <amount>`
- `sss-token burn <holder> <amount>`
- `sss-token transfer <from> <to> <amount>`
- `sss-token freeze <address>`
- `sss-token thaw <address>`
- `sss-token pause`
- `sss-token unpause`
- `sss-token status`
- `sss-token supply`
- `sss-token minters add <minter> <quota>`
- `sss-token minters remove <minter>`
- `sss-token minters list`
- `sss-token holders --min-balance <amount>`
- `sss-token audit-log --action <type>`
- `sss-token blacklist add <address> --reason <reason>`
- `sss-token blacklist remove <address>`
- `sss-token seize <address> --to <treasury> --amount <amount>`

## Backend Services

### `mint-burn`

- `GET /health`
- `GET /requests`
- `POST /mint` with `{ "recipient": "...", "amount": 1000, "requestId": "optional-idempotency-key" }`
- `POST /burn` with `{ "holder": "...", "amount": 1000, "requestId": "optional-idempotency-key" }`

Responses persist request status and dedupe repeated `requestId` submissions.

### `compliance`

- `GET /health`
- `GET /blacklist`
- `GET /audit`
- `POST /blacklist/add` with `{ "address": "...", "reason": "watchlist", "requestId": "optional-idempotency-key" }`
- `POST /blacklist/remove` with `{ "address": "...", "requestId": "optional-idempotency-key" }`
- `POST /seize` with `{ "from": "...", "to": "...", "amount": 1000, "requestId": "optional-idempotency-key" }`

Compliance endpoints persist succeeded requests, retain failures, and emit outbox events for downstream delivery.

### `indexer`

- `GET /health`
- `GET /snapshot`
- `POST /poll`

Snapshots persist the latest status, holders, blacklist, and audit view, and poll runs are tracked in the shared service ledger.

### `webhook`

- `GET /health`
- `GET /subscriptions`
- `GET /deliveries`
- `POST /subscriptions` with `{ "url": "https://...", "events": ["indexer.snapshot.updated"] }`
- `POST /dispatch` with `{ "event": "indexer.snapshot.updated", "payload": {...} }`

Webhook deliveries are persisted with retry results for later operator inspection.
