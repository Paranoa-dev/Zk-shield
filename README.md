# 🛡️ ZK Shield — Private Payments on Stellar

[![CI](https://github.com/zk-shield/zk-shield/actions/workflows/ci.yml/badge.svg)](https://github.com/zk-shield/zk-shield/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Drips](https://img.shields.io/badge/Funded%20via-Drips.network-blueviolet)](https://www.drips.network/wave/stellar/repos)
[![Built for Stellar Hacks: ZK 2026](https://img.shields.io/badge/Stellar%20Hacks-ZK%202026-brightgreen)](https://dorahacks.io/hackathon/stellar-hacks-zk)

> Deposit, transfer, and withdraw XLM privately using Zero-Knowledge proofs on Stellar.

ZK Shield is an **open-source** private payment protocol. Anyone can audit the circuits, contribute code, or open issues. See [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

---

## How it works

1. **Deposit** — You pick an amount and generate a random secret locally. A Poseidon commitment `Poseidon(secret, amount)` is stored in an on-chain Merkle tree inside a Soroban contract. Your XLM is locked. No amounts or addresses are visible.

2. **Transfer** — Your browser generates a Groth16 ZK proof proving you know a secret corresponding to a valid commitment in the tree. The contract verifies the proof using Stellar's BN254 host functions (Protocol X-Ray). A new commitment is created for the recipient — no amounts revealed.

3. **Withdraw** — Same as transfer, but instead of a new commitment, XLM is released to any wallet you specify. The withdrawal address has zero on-chain link to the depositor.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Wallet | Freighter browser extension |
| ZK circuit | Circom 2, Groth16 / BN254 |
| Proof generation | snarkjs (runs in browser) |
| Merkle tree | Poseidon hash, depth 20 |
| Smart contract | Soroban (Rust), Protocol X-Ray |
| Network | Stellar testnet → mainnet |

---

## Prerequisites

- **Node.js** ≥ 18
- **Rust + Cargo** (`curl https://sh.rustup.rs | sh`)
- **Stellar CLI** (`cargo install --locked stellar-cli`)
- **Circom 2** (`npm install -g circom`)
- **Freighter wallet** browser extension: https://www.freighter.app

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Compile the ZK circuit

```bash
npm run compile:circuit
# Output: circuits/build/commitment.r1cs, commitment.wasm, commitment.sym
```

### 3. Run trusted setup (dev only)

```bash
npm run setup:trusted
# Output: public/circuits/commitment.wasm, commitment.zkey, verification_key.json
```

> ⚠️ For production, use a proper trusted setup ceremony or Hermez's perpetual powers of tau.

### 4. Test the circuit end-to-end

```bash
npm run test:proof
# Should print: ✅ Proof is VALID + ✅ Correctly rejected invalid secret
```

### 5. Build & deploy the Soroban contract

```bash
cd contracts
stellar contract build

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/zk_shield.wasm \
  --network testnet \
  --source YOUR_SECRET_KEY

echo "NEXT_PUBLIC_CONTRACT_ID=CXXX..." > ../.env.local
```

### 6. Run the frontend

```bash
npm run dev
# Open http://localhost:3000
```

Copy `.env.local.example` → `.env.local` and fill in your deployed contract ID.

---

## Project structure

```
zk-shield/
├── app/                    # Next.js app router
│   ├── page.tsx            # Landing page
│   ├── dashboard/          # Note manager + balances
│   ├── deposit/            # Deposit XLM flow
│   ├── transfer/           # Private transfer flow
│   └── withdraw/           # Withdrawal flow
├── circuits/
│   └── commitment.circom   # ZK circuit (the core proof)
├── contracts/
│   └── src/lib.rs          # Soroban contract (Rust)
├── components/
│   ├── ui/                 # Shared UI components
│   └── wallet/             # Freighter wallet provider
├── lib/
│   ├── zk/proof.ts         # Proof generation + note storage
│   ├── merkle/tree.ts      # Incremental Merkle tree
│   └── stellar/contract.ts # Stellar SDK + contract calls
├── scripts/
│   ├── trusted_setup.js    # Powers of Tau + phase 2
│   └── test_proof.js       # Circuit test suite
└── public/circuits/        # Compiled WASM + zkey (gitignored)
```

---

## Security notes

- **Secrets are stored in localStorage** — for the hackathon. Production would encrypt notes with the user's wallet public key.
- **Trusted setup** — the dev ceremony is insecure. A production deployment needs a proper multi-party ceremony.
- **Nullifier linkability** — the nullifier is deterministic from the secret, so the same note always produces the same nullifier. This is correct and prevents double-spending.
- **Tree synchronisation** — the local Merkle tree is reconstructed from Soroban events. If events are missed, proofs will fail with "root mismatch".

See [SECURITY.md](SECURITY.md) for the full responsible disclosure policy.

---

## Contributing

Contributions are welcome! ZK Shield participates in the [Drips Network Wave Program](https://www.drips.network/wave/stellar/repos) — contributors can receive on-chain funding for their work.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and a list of good first issues.

---

## Resources

- [Stellar developer docs](https://developers.stellar.org/docs)
- [Soroban smart contracts](https://developers.stellar.org/docs/smart-contracts)
- [Circom documentation](https://docs.circom.io)
- [snarkjs](https://github.com/iden3/snarkjs)
- [Stellar Hacks: ZK on DoraHacks](https://dorahacks.io/hackathon/stellar-hacks-zk)
- [Freighter wallet](https://www.freighter.app)
- [Drips Network](https://www.drips.network)

---

## License

[MIT](LICENSE)
