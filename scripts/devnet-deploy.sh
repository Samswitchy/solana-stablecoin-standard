#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${RPC_URL:-https://api.devnet.solana.com}"
KEYPAIR_PATH="${KEYPAIR_PATH:-$HOME/.config/solana/id.json}"
STATE_PATH="${STATE_PATH:-./.sss-devnet.json}"

AUTHORITY_PUBKEY="${AUTHORITY_PUBKEY:-$(solana-keygen pubkey "$KEYPAIR_PATH")}"
TREASURY_PUBKEY="${TREASURY_PUBKEY:-$AUTHORITY_PUBKEY}"

anchor build

solana program deploy target/deploy/stablecoin_core.so \
  --program-id target/deploy/stablecoin_core-keypair.json \
  --keypair "$KEYPAIR_PATH" \
  --upgrade-authority "$KEYPAIR_PATH" \
  --url "$RPC_URL" \
  --use-rpc

solana program deploy target/deploy/transfer_hook.so \
  --program-id target/deploy/transfer_hook-keypair.json \
  --keypair "$KEYPAIR_PATH" \
  --upgrade-authority "$KEYPAIR_PATH" \
  --url "$RPC_URL" \
  --use-rpc

STABLECOIN_PROGRAM_ID="$(solana-keygen pubkey target/deploy/stablecoin_core-keypair.json)"
TRANSFER_HOOK_PROGRAM_ID="$(solana-keygen pubkey target/deploy/transfer_hook-keypair.json)"

rm -f "$STATE_PATH"

node ./bin/sss-token.js init \
  --preset sss-2 \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --stablecoin-program-id "$STABLECOIN_PROGRAM_ID" \
  --transfer-hook-program-id "$TRANSFER_HOOK_PROGRAM_ID" \
  --state "$STATE_PATH"

node ./bin/sss-token.js minters add "$AUTHORITY_PUBKEY" 1000000 \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --stablecoin-program-id "$STABLECOIN_PROGRAM_ID" \
  --transfer-hook-program-id "$TRANSFER_HOOK_PROGRAM_ID" \
  --state "$STATE_PATH"

node ./bin/sss-token.js mint "$AUTHORITY_PUBKEY" 500000 \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --stablecoin-program-id "$STABLECOIN_PROGRAM_ID" \
  --transfer-hook-program-id "$TRANSFER_HOOK_PROGRAM_ID" \
  --state "$STATE_PATH"

node ./bin/sss-token.js blacklist add "$AUTHORITY_PUBKEY" --reason watchlist \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --stablecoin-program-id "$STABLECOIN_PROGRAM_ID" \
  --transfer-hook-program-id "$TRANSFER_HOOK_PROGRAM_ID" \
  --state "$STATE_PATH"

node ./bin/sss-token.js seize "$AUTHORITY_PUBKEY" --to "$TREASURY_PUBKEY" --amount 100000 \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --stablecoin-program-id "$STABLECOIN_PROGRAM_ID" \
  --transfer-hook-program-id "$TRANSFER_HOOK_PROGRAM_ID" \
  --state "$STATE_PATH"

node ./bin/sss-token.js holders \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --stablecoin-program-id "$STABLECOIN_PROGRAM_ID" \
  --transfer-hook-program-id "$TRANSFER_HOOK_PROGRAM_ID" \
  --state "$STATE_PATH"
