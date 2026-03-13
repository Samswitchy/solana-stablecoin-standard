# Devnet Proof

Use this file to record the final validator-independent proof package for submission.

## Funding Guidance

- Fund the deploy wallet with `SOL`, not `USDC`
- Recommended amount: `3-5 SOL` on devnet
- Recommended wallet: a dedicated local devnet deploy wallet you control, passed into `KEYPAIR_PATH`
- Do not rely on the temporary `/tmp/sss-local-keypair.json` for final submission unless you intentionally want to keep using it

Recommended flow:

```bash
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/sss-devnet.json
solana-keygen pubkey ~/.config/solana/sss-devnet.json
```

Then fund that public key with devnet `SOL`, and run:

```bash
KEYPAIR_PATH=~/.config/solana/sss-devnet.json ./scripts/devnet-deploy.sh
```

## Environment

- Date: `2026-03-13`
- RPC URL: `https://api.devnet.solana.com`
- Deploy authority: `Df1jBoiwXzxgRaz1Akpf9ZZzGFjEsdBbFFAkKrGfZ7bT`
- Treasury: `CHpUwFHL5hcTc7JpuT5zhY2jsvYbZYSBm1toz5hExYKU`
- Keypair path used: `~/.config/solana/sss-devnet.json`

## Program IDs

- `stablecoin_core`: `5oaQNq7VZWRzaqhY7vxaxnP5fjoGCM6266LkSk8mjJS4`
- `transfer_hook`: `ANsBbf6d6k7gtaj2mWC8d4eLz5FTkDLvmmLkQuxR7aUF`

## Deployment Signatures

- `stablecoin_core` deploy / upgrade: `3ZUFPMsX3rdMBZesctRjc8DgJBDkzWfD6867KsjHeQBS5gwtXRGsEC6tun4yGPtUTvtTLZKgWXETj9kTsSgJu9PU`
- `transfer_hook` deploy / upgrade: `4Rp36Drod2bE6VHA2KSZbwVUnVwPvC86nBZWVmhY19Rb4PUCY6U7mTJjcU4xWfDy1s7mnMLvbNEvcjAzBfpyWU6u`

## SSS-2 Transaction Signatures

- `init` (`stablecoin_core::initialize`): `3RYhTPcFgyXqamSgvteD2JWs3HMWKagwm5NhFMAPTv5i2SDvjoiaFyfXaJ7r4Xd8weZ5e8o435CSThgYcCiJWayz`
- `transfer_hook::initialize`: `1t7EqHmYkWPf6FFh23ezWKRHdh4t413HXA7XFh9yPDcWktCLoVFgFnZVhsvTtZw1DWcUQd2BcY9X6HusYkJExMK`
- `minters add`: `4hxD85TSjYeSUcruXQmpdeiCLduuG3wrF6AeRA96N1zHjBMtwiUSbaminvNtnpFuhdgPAHNC3hrZDeysddrGE9iC`
- `mint`: `pHJ8CkXqkbvnFaoxn3Zo8Ajx4nSwcYEKYi7Vj61GRfLmkQ4uHNyAxk4Dn4w28GVYo4enMSkGCs797L7HLPDWJbd`
- `blacklist add`: `jXzjTQgz7JLnUozhUayZy9YDFkAvZRwY3FDgX1cwiYCeDVN8XGfEBsZcstx713rCQrUaDk4fBxwq2WEtgdDBF9t`
- blocked transfer simulation or error reference: `simulation rejected with custom error 0x1773 / SourceBlacklisted`
- `seize`: `3r3L4dzQjef2aj2DBECMb4jNyr4ysNnkuLE43Gj2uWJ1VonSpvZSjaW1dQdENBSdBSCBFK5xPvqH4KNAHxSVTzDZ`
- `holders` / status verification: `direct RPC snapshot via mint + ATA reads (no transaction signature)`

## Result Snapshot

- Mint: `Atktnf8wX6EZ33afbHXmh21x3EBPhkNfjrApDNikEAHf`
- Config PDA: `EeangMMnmHGmDRqdAPtJk1KKTYjJVhET4JVYRB68Z92C`
- Hook config PDA: `HyPkVaPguap2Q7nR1ycUTfmgULCWL1QVZLmJVjGuGeG7`
- Hook extra-account-meta PDA: `GxsR8CmJ27JEAp8WbihzCDv19QEDN8QV9hDLxzwWG5xF`
- Source holder ATA: `6ug8Xggkc3u2yPoY6fyBLucmstyy7iVW9a5NbfZ6ySnF`
- Treasury holder ATA: `DyH3yXby6hWCnT4eQRi8JkJQqkoRrnnGVLZPP3jAQkR5`
- Source holder balance after seize: `400000`
- Treasury holder balance after seize: `100000`
- Total supply: `500000`
- Blacklist size: `1`
- Paused: `false`

## Commands Used

```bash
anchor build
solana program deploy target/deploy/stablecoin_core.so --program-id target/deploy/stablecoin_core-keypair.json --keypair ~/.config/solana/sss-devnet.json --upgrade-authority ~/.config/solana/sss-devnet.json --url devnet --use-rpc
solana program deploy target/deploy/transfer_hook.so --program-id target/deploy/transfer_hook-keypair.json --keypair ~/.config/solana/sss-devnet.json --upgrade-authority ~/.config/solana/sss-devnet.json --url devnet --use-rpc
/tmp/node-v22.22.1-x64/bin/node ./bin/sss-token.js init --preset sss-2 --rpc-url https://api.devnet.solana.com --keypair ~/.config/solana/sss-devnet.json --stablecoin-program-id 5oaQNq7VZWRzaqhY7vxaxnP5fjoGCM6266LkSk8mjJS4 --transfer-hook-program-id ANsBbf6d6k7gtaj2mWC8d4eLz5FTkDLvmmLkQuxR7aUF --state /tmp/sss-devnet-proof.json
/tmp/node-v22.22.1-x64/bin/node ./bin/sss-token.js minters add Df1jBoiwXzxgRaz1Akpf9ZZzGFjEsdBbFFAkKrGfZ7bT 1000000 --rpc-url https://api.devnet.solana.com --keypair ~/.config/solana/sss-devnet.json --stablecoin-program-id 5oaQNq7VZWRzaqhY7vxaxnP5fjoGCM6266LkSk8mjJS4 --transfer-hook-program-id ANsBbf6d6k7gtaj2mWC8d4eLz5FTkDLvmmLkQuxR7aUF --state /tmp/sss-devnet-proof.json
/tmp/node-v22.22.1-x64/bin/node ./bin/sss-token.js mint Df1jBoiwXzxgRaz1Akpf9ZZzGFjEsdBbFFAkKrGfZ7bT 500000 --rpc-url https://api.devnet.solana.com --keypair ~/.config/solana/sss-devnet.json --stablecoin-program-id 5oaQNq7VZWRzaqhY7vxaxnP5fjoGCM6266LkSk8mjJS4 --transfer-hook-program-id ANsBbf6d6k7gtaj2mWC8d4eLz5FTkDLvmmLkQuxR7aUF --state /tmp/sss-devnet-proof.json
/tmp/node-v22.22.1-x64/bin/node ./bin/sss-token.js blacklist add Df1jBoiwXzxgRaz1Akpf9ZZzGFjEsdBbFFAkKrGfZ7bT --reason watchlist --rpc-url https://api.devnet.solana.com --keypair ~/.config/solana/sss-devnet.json --stablecoin-program-id 5oaQNq7VZWRzaqhY7vxaxnP5fjoGCM6266LkSk8mjJS4 --transfer-hook-program-id ANsBbf6d6k7gtaj2mWC8d4eLz5FTkDLvmmLkQuxR7aUF --state /tmp/sss-devnet-proof.json
/tmp/node-v22.22.1-x64/bin/node ./bin/sss-token.js transfer Df1jBoiwXzxgRaz1Akpf9ZZzGFjEsdBbFFAkKrGfZ7bT CHpUwFHL5hcTc7JpuT5zhY2jsvYbZYSBm1toz5hExYKU 1 --rpc-url https://api.devnet.solana.com --keypair ~/.config/solana/sss-devnet.json --stablecoin-program-id 5oaQNq7VZWRzaqhY7vxaxnP5fjoGCM6266LkSk8mjJS4 --transfer-hook-program-id ANsBbf6d6k7gtaj2mWC8d4eLz5FTkDLvmmLkQuxR7aUF --state /tmp/sss-devnet-proof.json
/tmp/node-v22.22.1-x64/bin/node ./bin/sss-token.js seize Df1jBoiwXzxgRaz1Akpf9ZZzGFjEsdBbFFAkKrGfZ7bT --to CHpUwFHL5hcTc7JpuT5zhY2jsvYbZYSBm1toz5hExYKU --amount 100000 --rpc-url https://api.devnet.solana.com --keypair ~/.config/solana/sss-devnet.json --stablecoin-program-id 5oaQNq7VZWRzaqhY7vxaxnP5fjoGCM6266LkSk8mjJS4 --transfer-hook-program-id ANsBbf6d6k7gtaj2mWC8d4eLz5FTkDLvmmLkQuxR7aUF --state /tmp/sss-devnet-proof.json
```

Optional manual steps:

```bash
/tmp/node-v22.22.1-x64/bin/node --input-type=module -e '<direct snapshot query for mint/config/ATAs>'
```

## Notes

- Public `api.devnet.solana.com` does not expose the Token-2022 secondary index needed by the generic `holders` / `status` implementation, so final verification used direct mint and associated-token-account reads instead.
- The currently active binaries are the upgraded deploys signed by `3ZUFPM...` and `4Rp36D...`; the earlier raw deploys were superseded after aligning `declare_id!` values with the final program IDs.
- Blocked transfer behavior is proven by the `SourceBlacklisted` simulation error from the transfer-hook program before signature submission.
