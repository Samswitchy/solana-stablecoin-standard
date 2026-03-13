#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

missing=0

check_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    printf "[ok] %s\n" "$file"
  else
    printf "[missing] %s\n" "$file"
    missing=1
  fi
}

check_text() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q "$pattern" "$file"; then
    printf "[ok] %s\n" "$label"
  else
    printf "[missing] %s\n" "$label"
    missing=1
  fi
}

echo "Checking required files..."
check_file "README.md"
check_file "PROJECT_ROADMAP.md"
check_file "LOCALNET_PROOF.md"
check_file "DEVNET_PROOF.md"
check_file "SUBMISSION_CHECKLIST.md"
check_file "docker-compose.yml"
check_file "scripts/localnet-smoke.sh"
check_file "scripts/devnet-deploy.sh"
check_file "examples/frontend/index.html"
check_file "examples/frontend/app.js"
check_file "examples/frontend/styles.css"
check_file "test/onchain.integration.test.js"
check_file "services/mint-burn.js"
check_file "services/compliance.js"
check_file "services/indexer.js"
check_file "services/webhook.js"
check_file "docs/ARCHITECTURE.md"
check_file "docs/SDK.md"
check_file "docs/OPERATIONS.md"
check_file "docs/SSS-1.md"
check_file "docs/SSS-2.md"
check_file "docs/COMPLIANCE.md"
check_file "docs/API.md"

echo
echo "Checking proof placeholders..."
check_text "DEVNET_PROOF.md" "stablecoin_core" "DEVNET_PROOF.md includes stablecoin_core section"
check_text "DEVNET_PROOF.md" "transfer_hook" "DEVNET_PROOF.md includes transfer_hook section"
check_text "LOCALNET_PROOF.md" "seize" "LOCALNET_PROOF.md records seize proof"

echo
echo "Checking package scripts..."
check_text "package.json" "\"test:integration\"" "package.json includes integration test script"
check_text "package.json" "\"service:mint-burn\"" "package.json includes service scripts"
check_text "package.json" "\"frontend:serve\"" "package.json includes frontend preview script"

echo
if [[ "$missing" -eq 0 ]]; then
  echo "Submission artifact check passed."
else
  echo "Submission artifact check failed."
  exit 1
fi
