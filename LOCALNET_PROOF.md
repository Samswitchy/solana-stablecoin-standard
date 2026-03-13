# Localnet Proof

This document records the latest validator-backed proof run completed on March 13, 2026.

## Program IDs

- `stablecoin_core`: `DNU6Zz4eBYdh5gMGppGrGXMjA3atST2dSsiX6XZCF7v1`
- `transfer_hook`: `4eY1C8wjyJXTA3zUju9tKmND1netsJw9ViW7uBRCdzGQ`

## Deployment Signatures

- `stablecoin_core`: `mSdejVZbsPTp8uNRgrqdm2FHGhK7XEBq2ts4msGkAFuFWggokXzNC7mRcWK5Ag79Dhk1XCEUrKEZAKe27WgoYNj`
- `transfer_hook`: `jcTkJjMLM2xUCzoSnyk1WLRHFqdo1Qe2pWVAeU1uXJUJ3KtrivK8P9MiFW5G5nCWnU66rgAo4ChiKhFSpj1ZHht`

## CLI Smoke Signatures

- `minters add`: `3m9gg7TA3aYDM6MZJa3PtxtLrkZ9FaTCp4XpEpQwddny2q9CQMavJpv5wUMdGakWVssyW1ied3fWrR4G61nxisCH`
- `mint`: `2RF646rLEL4jfmMbL3YMH8UtRLxyvMtGUcq315Yewt1Pdus6ALZG4fsJBWYMpKQMcq7JJtzEa6bJwsor7nAam4Wv`
- `blacklist add`: `32zbfucrf1ausDLbtSTbP61ckyduGvQr2fbhGRbmu2KFmeo5QDjLsHYkvnh4erLUw4QQxgaHEaehpmPNmRqaukfk`
- `seize`: `616UNGEke59Doa9bwM98EFDG6mTsPPGDqxztKvRefnVX2WgECdwhG3QUrN7RESfXCQJrUbpvBYLhUjGAR23GMf5s`

## Result Snapshot

- Mint: `J9imL6fo948AZXNd5sLkqnvPsbHQjmbsxb7HT1Aivtan`
- Config PDA: `7oK7UhYQtd9Qo4Qup4LSxZsDw4yhnM3D2vdYBFFvaavs`
- Hook config PDA: `Cb3uwUjD823a7zxqdBsPRFDKG9ymmmgTH1yx7dvKxbNK`
- Hook extra-account-meta PDA: `2pJaRHvpbXYRi62mUzcgyaZj2b3bwQKNkRoG2CncwxWx`
- Total supply after mint: `500000`
- Total supply after seize: `500000`
- Blacklist size after compliance action: `1`
- Source holder balance after seize: `400000`
- Treasury holder balance after seize: `100000`

## Enforcement Notes

- A normal user transfer from the blacklisted source still fails under the transfer hook with `SourceBlacklisted` (`0x1773`).
- Admin seizure succeeds because the transfer hook now recognizes the stablecoin config PDA as the authorized permanent-delegate path for compliance seizure.
