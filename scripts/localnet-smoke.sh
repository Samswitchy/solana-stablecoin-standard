#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8899}"
KEYPAIR_PATH="${KEYPAIR_PATH:-$HOME/.config/solana/id.json}"
STATE_PATH="${STATE_PATH:-./.sss-chain.json}"

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

node ./bin/sss-token.js init \
  --preset sss-2 \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --state "$STATE_PATH"

node ./bin/sss-token.js minters add "$AUTHORITY_PUBKEY" 1000000 \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --state "$STATE_PATH"

node ./bin/sss-token.js mint "$AUTHORITY_PUBKEY" 500000 \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --state "$STATE_PATH"

node ./bin/sss-token.js blacklist add "$AUTHORITY_PUBKEY" --reason watchlist \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --state "$STATE_PATH"

node ./bin/sss-token.js status \
  --rpc-url "$RPC_URL" \
  --keypair "$KEYPAIR_PATH" \
  --state "$STATE_PATH"

echo
echo "Optional next step once transfer-hook extra-account-meta wiring is complete:"
echo "node ./bin/sss-token.js seize \"$AUTHORITY_PUBKEY\" --to \"$TREASURY_PUBKEY\" --amount 100000 --rpc-url \"$RPC_URL\" --keypair \"$KEYPAIR_PATH\" --state \"$STATE_PATH\""
