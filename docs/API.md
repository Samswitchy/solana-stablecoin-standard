# API Reference (Current Milestone)

## SDK

- `SolanaStablecoin.create(connection, config)`
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

## CLI

All CLI commands accept `--state <path>` to read/write an isolated local state snapshot.

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
