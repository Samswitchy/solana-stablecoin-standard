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

## Integration Tests

```bash
anchor build
npm run test:integration
```

This suite validates:

- SSS-1 mint -> freeze -> thaw
- SSS-2 mint -> blacklist -> blocked transfer -> seize

## Backend Stack

```bash
docker compose up --build
```

Default service ports:

- `mint-burn`: `8081`
- `compliance`: `8082`
- `indexer`: `8083`
- `webhook`: `8084`

## Example Frontend

Start the static preview UI with:

```bash
npm run frontend:serve
```

Then open:

```text
http://127.0.0.1:4173
```

Use it to:

- generate preset-based SDK and CLI snippets
- drive mint, burn, blacklist, and seize actions through the backend services
- inspect live status, holder balances, blacklist state, and audit activity
