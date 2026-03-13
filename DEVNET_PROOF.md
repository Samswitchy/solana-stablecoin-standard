# Devnet Proof

Use this file to record the final validator-independent proof package for submission.

## Environment

- Date:
- RPC URL:
- Deploy authority:
- Treasury:

## Program IDs

- `stablecoin_core`:
- `transfer_hook`:

## Deployment Signatures

- `stablecoin_core` deploy:
- `transfer_hook` deploy:

## SSS-2 Transaction Signatures

- `init`:
- `minters add`:
- `mint`:
- `blacklist add`:
- blocked transfer simulation or error reference:
- `seize`:
- `holders` / status verification:

## Result Snapshot

- Mint:
- Config PDA:
- Hook config PDA:
- Hook extra-account-meta PDA:
- Source holder balance after seize:
- Treasury holder balance after seize:
- Total supply:
- Blacklist size:

## Commands Used

```bash
./scripts/devnet-deploy.sh
```

Optional manual steps:

```bash
./bin/sss-token.js status --rpc-url <RPC_URL> --keypair <KEYPAIR> --state ./.sss-devnet.json
./bin/sss-token.js holders --rpc-url <RPC_URL> --keypair <KEYPAIR> --state ./.sss-devnet.json
```

## Notes

- Record exact errors for blocked user transfers under blacklist enforcement.
- Keep this file concise and factual so judges can verify the flow quickly.
