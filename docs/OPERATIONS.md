# Operations Runbook

## Initialize

```bash
sss-token init --preset sss-1
sss-token init --preset sss-2
sss-token init --custom ./stablecoin.config.toml
sss-token init --preset sss-2 --state ./ops/dev.state.json
sss-token init --preset sss-2 --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./ops/dev.chain.json
```

## Token Operations

```bash
sss-token mint <recipient> <amount>
sss-token burn <holder> <amount>
sss-token transfer <from> <to> <amount>
sss-token freeze <address>
sss-token thaw <address>
sss-token pause
sss-token unpause
sss-token status
sss-token supply
```

Chain mode uses the same commands with `--rpc-url`, `--keypair`, and a chain state file:

```bash
sss-token minters add <minter> <quota> --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./ops/dev.chain.json
sss-token mint <recipient> <amount> --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./ops/dev.chain.json
sss-token status --rpc-url http://127.0.0.1:8899 --keypair ~/.config/solana/id.json --state ./ops/dev.chain.json
```

## Management

```bash
sss-token minters add <minter> <quota>
sss-token minters remove <minter>
sss-token minters list
sss-token holders --min-balance <amount>
sss-token audit-log --action <type>
```

## Compliance Operations (SSS-2)

```bash
sss-token blacklist add <address> --reason "OFAC match"
sss-token blacklist remove <address>
sss-token seize <address> --to <treasury> --amount 1000000
```

`--state` stores either local simulator data or deployed chain metadata, depending on the mode used during `init`.
