# API Reference (Current Milestone)

## SDK

- `SolanaStablecoin.create(connection, config)`
- `SolanaStablecoin#setMinterQuota(minter, quota)`
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
- `sss-token blacklist add <address> --reason <reason>`
- `sss-token blacklist remove <address>`
- `sss-token seize <address> --to <treasury> --amount <amount>`
