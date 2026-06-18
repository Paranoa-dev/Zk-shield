#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ZK Shield — Full Phase 1 + Phase 2 Setup Script
# Run this once from inside the zk-shield/ directory:
#   chmod +x SETUP.sh && ./SETUP.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e  # exit on any error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${YELLOW}➜  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo ""
echo "🛡️  ZK Shield — Environment + Phase 2 Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Check Node ────────────────────────────────────────────────────────────────
info "Checking Node.js..."
node_ver=$(node --version 2>/dev/null) || fail "Node.js not found. Install from https://nodejs.org"
ok "Node.js $node_ver"

# ── Install Rust ──────────────────────────────────────────────────────────────
if ! command -v rustc &>/dev/null; then
  info "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
  ok "Rust installed: $(rustc --version)"
else
  ok "Rust already installed: $(rustc --version)"
fi

# Ensure cargo is on PATH
source "$HOME/.cargo/env" 2>/dev/null || true

# Add wasm32 target (needed for Soroban contracts)
info "Adding wasm32-unknown-unknown target..."
rustup target add wasm32-unknown-unknown
ok "wasm32 target ready"

# ── Install Stellar CLI ───────────────────────────────────────────────────────
if ! command -v stellar &>/dev/null; then
  info "Installing Stellar CLI (this takes ~3 min)..."
  cargo install --locked stellar-cli --features opt
  ok "Stellar CLI installed: $(stellar --version)"
else
  ok "Stellar CLI already installed: $(stellar --version)"
fi

# ── Install Circom ────────────────────────────────────────────────────────────
if ! command -v circom &>/dev/null; then
  info "Installing Circom 2 globally..."
  npm install -g circom
  ok "Circom installed: $(circom --version)"
else
  ok "Circom already installed: $(circom --version)"
fi

# ── npm install ───────────────────────────────────────────────────────────────
info "Installing JS dependencies (npm install)..."
npm install
ok "JS dependencies installed"

# ── Generate Poseidon zero values ─────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Generating Poseidon zero values..."
echo ""
node scripts/gen_zeros.js > /tmp/zeros_output.txt 2>&1
cat /tmp/zeros_output.txt
ok "Zero values generated — see output above"
echo ""
echo -e "${YELLOW}⚠️  ACTION REQUIRED: Copy the ZEROS array above into contracts/src/lib.rs${NC}"
echo "   Replace the existing ZEROS constant with the output above."
echo "   Press ENTER when done (or Ctrl+C to do it now and re-run)."
read -r

# ── Compile Circom circuit ────────────────────────────────────────────────────
info "Compiling ZK circuit (circom)..."
mkdir -p circuits/build
npm run compile:circuit
ok "Circuit compiled → circuits/build/"

# ── Trusted setup ─────────────────────────────────────────────────────────────
info "Running Groth16 trusted setup (takes 2-5 min)..."
npm run setup:trusted
ok "Trusted setup complete → public/circuits/"

# ── Test the circuit ──────────────────────────────────────────────────────────
info "Running circuit end-to-end test..."
npm run test:proof
ok "All circuit tests passed!"

# ── Export verifying key ──────────────────────────────────────────────────────
info "Exporting verifying key for Soroban..."
npm run export:vkey
ok "vkey.bin ready → circuits/build/vkey.bin"

# ── Build Soroban contract ────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Building Soroban contract (Rust → WASM)..."
cd contracts
stellar contract build
cd ..
ok "Contract built → contracts/target/wasm32-unknown-unknown/release/zk_shield.wasm"

# ── Generate Stellar identity ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Setting up Stellar testnet identity..."

if ! stellar keys ls 2>/dev/null | grep -q "zk-shield-dev"; then
  stellar keys generate --network testnet zk-shield-dev
  ok "Identity 'zk-shield-dev' created"
else
  ok "Identity 'zk-shield-dev' already exists"
fi

PUBKEY=$(stellar keys address zk-shield-dev)
info "Funding testnet account via Friendbot..."
curl -s "https://friendbot.stellar.org?addr=$PUBKEY" > /dev/null
ok "Account funded: $PUBKEY"

# ── Deploy contract ───────────────────────────────────────────────────────────
info "Deploying contract to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm contracts/target/wasm32-unknown-unknown/release/zk_shield.wasm \
  --network testnet \
  --source zk-shield-dev)

ok "Contract deployed: $CONTRACT_ID"

# Write to .env.local
cat > .env.local << ENVEOF
NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENVEOF
ok ".env.local written"

# ── Initialise contract ───────────────────────────────────────────────────────
info "Initialising contract (uploading verifying key)..."
SECRET_KEY=$(stellar keys show zk-shield-dev --show-secret 2>/dev/null | grep -o 'S[A-Z0-9]\{55\}' | head -1)
CONTRACT_ID=$CONTRACT_ID SECRET_KEY=$SECRET_KEY node scripts/deploy.js
ok "Contract initialised!"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Phase 2 complete! Everything is deployed and ready.${NC}"
echo ""
echo "   Contract ID : $CONTRACT_ID"
echo "   Network     : testnet"
echo "   Explorer    : https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo ""
echo "   Start the frontend:"
echo "   npm run dev → open http://localhost:3000"
echo ""
