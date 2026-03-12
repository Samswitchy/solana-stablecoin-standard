# Operations Runbook

## Initialize

```bash
sss-token init --preset sss-1
sss-token init --preset sss-2
sss-token init --custom ./stablecoin.config.toml
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

## Compliance Operations (SSS-2)

```bash
sss-token blacklist add <address> --reason "OFAC match"
sss-token blacklist remove <address>
sss-token seize <address> --to <treasury> --amount 1000000
```
