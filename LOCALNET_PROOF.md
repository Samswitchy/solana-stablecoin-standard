# Localnet Proof

This document records the latest validator-backed proof run completed on March 13, 2026.

## Program IDs

- `stablecoin_core`: `DNU6Zz4eBYdh5gMGppGrGXMjA3atST2dSsiX6XZCF7v1`
- `transfer_hook`: `4eY1C8wjyJXTA3zUju9tKmND1netsJw9ViW7uBRCdzGQ`

## Deployment Signatures

- `stablecoin_core`: `4EZkimAYUd3W6eBNUatsdsZRKFDzhNoScbzJ5wfJiEtuPqyYDUcKntNPd2GHtWobnS6291E9MZoU3QTh76JhfZKV`
- `transfer_hook`: `3vCXXcrdgCjHR8mWkuc1yvNzEbrAqwZyFd4PCACFvTeKYssG3RT1hr9SRKKptF2HmTHsxqnGDYLum5GpnfTREBXD`

## CLI Smoke Signatures

- `minters add`: `L274MUJtj81s2JPHAMR65t4oPsA4zrtAH6KwofKktreGHyuGysogkVVyet1CbGdyfYWrxK836LxSQ8S6yp4Soot`
- `mint`: `s9dpE5332gPeSmCysKH3JdVbjdgE6drFAS8ikK5jn7ym61qo2XTHTZasbWzMmqyYwJP7atuY9p2VGBsmwirKyPj`
- `blacklist add`: `5sE4YYqxZyRSvGwLTE2gW7pZbyycVtR8G5ND3YnC1UzLLQHN3MxfFTXSfTXEUaZ7qHdhJXdVvbNCkyM7MABRorqF`

## Result Snapshot

- Mint: `ALyeeN6BTZuxvfXj54zrMn7Kd2g5joi6qeh2u4bjd1ZM`
- Config PDA: `DCnz7Suwpd79tiffKeBTFUq6hWJbqNx9RaT67K6bmEpN`
- Hook config PDA: `E5YQ4chcZnDsEtegeRJ4RkwTh4P7gtPT4NUL7LNAF9R5`
- Total supply after mint: `500000`
- Blacklist size after compliance action: `1`

## Known Gap

`seize` currently reaches the on-chain core program but fails once Token-2022 attempts a hook-enforced transfer, because the transfer-hook extra-account-meta wiring is not yet supplied to the CPI path. The remaining work is in the hook account meta setup, not in CLI or SDK transport.
