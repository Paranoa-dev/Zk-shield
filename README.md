# 🛡️ ZK Shield — Private Payments on Stellar

[![CI](https://github.com/Paranoa-dev/Zk-shield/actions/workflows/ci.yml/badge.svg)](https://github.com/Paranoa-dev/Zk-shield/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Drips](https://img.shields.io/badge/Funded%20via-Drips.network-blueviolet)](https://www.drips.network/wave/stellar/repos)
[![Built for Stellar Hacks: ZK 2026](https://img.shields.io/badge/Stellar%20Hacks-ZK%202026-brightgreen)](https://dorahacks.io/hackathon/stellar-hacks-zk)

> **Deposit, transfer, and withdraw XLM privately using Zero-Knowledge proofs on Stellar.**

ZK Shield is an open-source private payment protocol built on Stellar's Soroban smart contract platform. It uses Groth16 zero-knowledge proofs over the BN254 curve to let users transact without the blockchain ever revealing who sent what to whom, or how much. No amounts. No sender. No receiver. Only a cryptographic proof that the rules were followed.

---

## Table of contents

- [How it works](#how-it-works)
- [Architecture overview](#architecture-overview)
- [Project structure](#project-structure)
- [Folder-by-folder reference](#folder-by-folder-reference)
- [Data flow](#data-flow)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Scripts reference](#scripts-reference)
- [Security notes](#security-notes)
- [Contributing](#contributing)
- [Resources](#resources)
- [License](#license)

---

## How it works

ZK Shield operates as a **shielded pool**. XLM enters the pool publicly, moves inside it privately, and exits to any address with no on-chain link to the original depositor.

### 1 — Deposit

You choose an amount and the frontend generates a cryptographically random 31-byte **secret** entirely in your browser. The secret never leaves your device. A **commitment** `Poseidon(secret, amount)` is computed and submitted to the Soroban contract alongside the XLM transfer. The contract inserts the commitment as a leaf in an on-chain **incremental Merkle tree** (depth 20, Poseidon hashing). Your XLM is now locked inside the pool. The on-chain record contains only the commitment — no address, no amount.

### 2 — Transfer

When you want to send value to someone, your browser reconstructs the Merkle tree from on-chain events, computes a **Merkle inclusion proof** for your commitment, then runs the **Circom circuit** to generate a **Groth16 ZK proof** that proves:

1. You know a secret `s` such that `Poseidon(s, amount)` is a valid leaf in the current tree.
2. The nullifier `Poseidon(s)` is derived correctly and has not been seen before (prevents double-spend).
3. You know the full Merkle path from leaf to root.

The proof is submitted to the Soroban contract along with the nullifier and a new commitment for the recipient. The contract verifies the proof using Stellar's BN254 host functions, marks the nullifier as spent, and inserts the new commitment. No amounts or addresses are revealed.

### 3 — Withdraw

Identical to a transfer, except instead of creating a new commitment, the contract releases the XLM to any wallet address you supply. The withdrawal address has zero on-chain connection to the original depositor.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                    │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │   React UI   │──▶│  lib/zk/     │──▶│  snarkjs       │  │
│  │  (app/ pages)│   │  proof.ts    │   │  Groth16 prover│  │
│  └──────┬───────┘   └──────┬───────┘   └────────────────┘  │
│         │                  │                                 │
│         │           ┌──────▼───────┐                        │
│         │           │ lib/merkle/  │  ← rebuilt from events │
│         │           │   tree.ts    │                        │
│         │           └──────────────┘                        │
│         │                                                    │
│  ┌──────▼──────────────────┐                               │
│  │  lib/stellar/contract.ts│  ← Stellar SDK + Freighter    │
│  └──────────────┬──────────┘                               │
└─────────────────┼───────────────────────────────────────────┘
                  │ XDR transactions
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Stellar Network (Testnet)                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         ZK Shield Soroban Contract (Rust)             │  │
│  │                                                       │  │
│  │  deposit()  ──▶  insert_leaf()  ──▶  Merkle tree     │  │
│  │  spend()    ──▶  verify_proof() ──▶  mark nullifier  │  │
│  │                              └──▶  transfer / release│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Project structure

```
zk-shield/
│
│   README.md               ← you are here
│   CONTRIBUTING.md         ← how to get involved + Drips info
│   SECURITY.md             ← responsible disclosure policy
│   CHANGELOG.md            ← version history
│   drips.json              ← Drips Network Wave Program metadata
│   package.json            ← Node.js deps + npm scripts
│   tsconfig.json           ← TypeScript config (strict mode)
│   tailwind.config.ts      ← design tokens (colours, animations)
│   next.config.js          ← Next.js config (WASM headers, etc.)
│   Cargo.toml              ← workspace root for Rust
│   .env.local.example      ← required environment variables
│
├── app/                    ← Next.js 14 App Router pages
│   ├── layout.tsx          ← root layout (Navbar, Wallet, Toast providers)
│   ├── page.tsx            ← landing page + hero
│   ├── deposit/page.tsx    ← deposit XLM flow
│   ├── transfer/page.tsx   ← private transfer flow
│   ├── withdraw/page.tsx   ← unlinkable withdrawal flow
│   ├── dashboard/page.tsx  ← note manager + pool balance
│   └── api/                ← (reserved) Next.js API routes
│
├── circuits/
│   └── commitment.circom   ← Circom 2 ZK circuit (the core proof logic)
│
├── contracts/
│   ├── Cargo.toml          ← Soroban contract crate
│   └── src/lib.rs          ← Soroban smart contract (Rust)
│
├── components/
│   ├── ui/
│   │   ├── Navbar.tsx      ← top navigation bar
│   │   ├── MobileNav.tsx   ← responsive mobile menu
│   │   ├── Toast.tsx       ← toast notification system
│   │   ├── ErrorBoundary.tsx ← React error boundary wrapper
│   │   ├── Skeleton.tsx    ← loading skeleton components
│   │   └── NoteBackup.tsx  ← export/import note JSON UI
│   ├── wallet/
│   │   ├── WalletProvider.tsx  ← Freighter context + connect/disconnect
│   │   └── NoteImporter.tsx    ← drag-and-drop note file import
│   └── proof/
│       ├── ProofProgress.tsx   ← step-by-step proof generation UI
│       └── useProof.ts         ← React hook: runs circuit + submits tx
│
├── hooks/
│   └── useTreeSync.ts      ← fetches deposit events, rebuilds Merkle tree
│
├── lib/
│   ├── zk/
│   │   └── proof.ts        ← Poseidon hash, secret gen, proof gen, note storage
│   ├── merkle/
│   │   └── tree.ts         ← incremental Merkle tree (mirrors Soroban contract)
│   └── stellar/
│       └── contract.ts     ← Stellar SDK: build txs, submit, fetch events
│
├── scripts/
│   ├── trusted_setup.js    ← Powers of Tau phase 1 + 2 (dev ceremony)
│   ├── test_proof.js       ← end-to-end circuit test (generate + verify)
│   ├── export_vkey.js      ← extract verification_key.json from zkey
│   ├── gen_zeros.js        ← compute Poseidon zero values for the Rust contract
│   └── deploy.js           ← deploy Soroban contract + upload verifying key
│
├── styles/
│   └── globals.css         ← Tailwind base + custom CSS variables
│
├── public/
│   ├── circuits/
│   │   ├── commitment.wasm ← compiled circuit witness generator (gitignored)
│   │   ├── commitment.zkey ← Groth16 proving key (gitignored)
│   │   └── verification_key.json ← verifier key (committed for local tests)
│   └── fonts/              ← self-hosted fonts
│
└── .github/
    ├── workflows/
    │   └── ci.yml          ← lint, type-check, build, cargo test
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.yml
    │   ├── feature_request.yml
    │   └── good_first_issue.yml
    └── PULL_REQUEST_TEMPLATE.md
```

---

## Folder-by-folder reference

### `circuits/` — The ZK circuit

`commitment.circom` is the heart of the protocol. It is a Circom 2 circuit that takes:

| Signal | Type | Description |
|--------|------|-------------|
| `secret` | private input | 31-byte random value only the depositor knows |
| `amount` | private input | deposit amount in stroops |
| `pathElements[20]` | private input | Merkle sibling hashes from leaf to root |
| `pathIndices[20]` | private input | left/right indicators along the path |
| `root` | **public** input | current on-chain Merkle root |
| `nullifier` | **public** input | `Poseidon(secret)` — prevents double-spend |

The circuit enforces three constraints:
1. `commitment = Poseidon(secret, amount)` exists in the tree at the claimed path.
2. `nullifier = Poseidon(secret)` — binds the nullifier to the secret without revealing it.
3. The Merkle path hashes up to `root`.

Compiled output (`circuits/build/`) and the proving key (`public/circuits/commitment.zkey`) are gitignored because they are large binary files — run `npm run compile:circuit` and `npm run setup:trusted` to regenerate them.

### `contracts/` — The Soroban contract

`contracts/src/lib.rs` is the on-chain component. It exposes five entry points:

| Function | Description |
|----------|-------------|
| `initialize(admin, xlm_token, verifying_key)` | One-time setup. Stores the Groth16 verifying key and seeds the Merkle tree with zero values. |
| `deposit(depositor, commitment, amount)` | Pulls XLM from the caller, inserts the commitment leaf, emits a `deposit` event. Returns the leaf index. |
| `spend(caller, proof, nullifier, new_commitment, recipient, amount)` | Verifies the ZK proof, marks the nullifier spent, then either inserts a new commitment (transfer) or releases XLM (withdraw). |
| `get_root()` | Returns the current Merkle root as `BytesN<32>`. |
| `get_leaf_count()` | Returns the number of inserted commitments. |
| `is_spent(nullifier)` | Returns `true` if the nullifier has been used. |

The incremental Merkle tree inside the contract mirrors `lib/merkle/tree.ts` exactly — same depth (20), same Poseidon zero values, same left/right ordering — so the roots always match.

### `lib/` — Shared logic

The three sub-libraries are designed to be independent and composable:

**`lib/zk/proof.ts`** — everything ZK-related in the browser:
- `generateSecret()` — `crypto.getRandomValues` seeded 31-byte secret
- `createCommitment(amountXlm)` → `{ secret, amount, commitment, nullifier }`
- `generateProof(inputs)` — calls `snarkjs.groth16.fullProve` with the compiled WASM and zkey
- `serializeProofForSoroban(proof)` — packs the 256-byte proof for the contract
- `saveNote / loadNotes / markNoteSpent` — localStorage note management

**`lib/merkle/tree.ts`** — incremental Merkle tree:
- `MerkleTree.insert(leaf)` — inserts a leaf and returns its index
- `MerkleTree.getProof(index)` → `{ pathElements, pathIndices, root }` — used as private circuit inputs
- `toJSON / fromJSON` — serialise to sessionStorage for caching
- `loadTree / saveTree` — sessionStorage persistence helpers

**`lib/stellar/contract.ts`** — Stellar SDK wrappers:
- `buildDepositTx` / `buildSpendTx` — build, simulate, and assemble XDR transactions
- `submitTransaction` — submit and poll until confirmed
- `fetchDepositEvents` / `fetchSpentNullifiers` — query Soroban events to rebuild the tree

### `hooks/` — React hooks

**`hooks/useTreeSync.ts`** ties `lib/stellar/contract.ts` and `lib/merkle/tree.ts` together. On mount it:
1. Calls `fetchDepositEvents()` to get every commitment ever inserted
2. Rebuilds a fresh `MerkleTree` by replaying all insertions in order
3. Calls `fetchSpentNullifiers()` and marks matching local notes as spent
4. Exposes `{ synced, leafCount, root, error, resync }` to consuming pages

Every page that generates proofs (`transfer`, `withdraw`) calls `useTreeSync` first to ensure the local Merkle root matches the on-chain root before proof generation starts.

### `components/` — UI layer

- **`components/proof/useProof.ts`** — orchestrates the full proof pipeline: sync tree → generate proof → serialize → build tx → sign with Freighter → submit
- **`components/proof/ProofProgress.tsx`** — visual stepper that renders each phase of the above
- **`components/wallet/WalletProvider.tsx`** — wraps `@stellar/freighter-api`, provides `{ connected, publicKey, connect, signTransaction }` context
- **`components/ui/`** — stateless UI primitives consumed by all pages

### `scripts/` — Developer tooling

| Script | Run with | Description |
|--------|----------|-------------|
| `trusted_setup.js` | `npm run setup:trusted` | Downloads Powers of Tau, runs phase 2, exports zkey and verification key |
| `test_proof.js` | `npm run test:proof` | Generates a proof with known inputs and verifies it; also tests rejection of a wrong secret |
| `export_vkey.js` | `npm run export:vkey` | Extracts `verification_key.json` from an existing `.zkey` file |
| `gen_zeros.js` | `npm run gen:zeros` | Prints the `ZEROS` array to paste into `contracts/src/lib.rs` |
| `deploy.js` | `npm run deploy:contract` | Builds WASM, deploys via Stellar CLI, uploads verifying key, writes `.env.local` |

---

## Data flow

Below is the sequence for a **private transfer** — the most complex operation:

```
User (browser)                     Soroban Contract
      │                                   │
      │  1. useTreeSync()                 │
      │     fetchDepositEvents() ─────────▶ (reads events)
      │     rebuild MerkleTree ◀──────────┤
      │                                   │
      │  2. createCommitment(amount)       │
      │     secret  = random 31 bytes      │
      │     nullifier  = Poseidon(secret)  │
      │     newCommit  = Poseidon(s, amt)  │
      │                                   │
      │  3. tree.getProof(leafIndex)       │
      │     pathElements, pathIndices ◀──  │
      │                                   │
      │  4. snarkjs.groth16.fullProve()    │
      │     (runs commitment.wasm in       │
      │      browser, ~2-4 seconds)        │
      │                                   │
      │  5. serializeProofForSoroban()     │
      │     → 256-byte proof buffer        │
      │                                   │
      │  6. buildSpendTx()                │
      │     → simulate + assemble XDR     │
      │                                   │
      │  7. Freighter.signTransaction()    │
      │                                   │
      │  8. submitTransaction() ──────────▶ spend(proof, nullifier,
      │                                   │        newCommitment)
      │                                   │  verify_groth16_proof()
      │                                   │  mark nullifier spent
      │                                   │  insert_leaf(newCommitment)
      │                                   │  emit spend event
      │     { hash, ledger } ◀────────────│
```

---

## Tech stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend framework | Next.js (App Router) | 14 |
| UI styling | Tailwind CSS | 3 |
| Wallet | Freighter browser extension | — |
| ZK circuit language | Circom | 2.1.6 |
| Proof system | Groth16 / BN254 | — |
| In-browser prover | snarkjs | 0.7.x |
| Merkle / Poseidon | circomlibjs | 0.1.x |
| Smart contract language | Rust (Soroban SDK) | 21.x |
| Smart contract platform | Stellar Soroban | Protocol X-Ray |
| Stellar SDK | @stellar/stellar-sdk | 12.x |
| Language | TypeScript | 5.x |
| Network | Stellar testnet | — |

---

## Prerequisites

- **Node.js** ≥ 18 and npm
- **Rust + Cargo** — `curl https://sh.rustup.rs | sh`
- **wasm32 target** — `rustup target add wasm32-unknown-unknown`
- **Stellar CLI** — `cargo install --locked stellar-cli`
- **Circom 2** — `npm install -g circom`
- **Freighter wallet** browser extension — https://www.freighter.app

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/Paranoa-dev/Zk-shield.git
cd Zk-shield
npm install
```

### 2. Compile the ZK circuit

```bash
npm run compile:circuit
# Outputs: circuits/build/commitment.r1cs, commitment.wasm, commitment.sym
```

### 3. Run the trusted setup (dev only)

```bash
npm run setup:trusted
# Outputs: public/circuits/commitment.wasm
#          public/circuits/commitment.zkey
#          public/circuits/verification_key.json
```

> ⚠️ This is a single-party ceremony and is **not safe for mainnet**. A production deployment requires a multi-party computation (MPC) ceremony using Hermez's perpetual powers of tau or an equivalent.

### 4. Test the circuit end-to-end

```bash
npm run test:proof
# ✅ Proof is VALID
# ✅ Correctly rejected invalid secret
```

### 5. Build and deploy the Soroban contract

```bash
cd contracts
stellar contract build

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/zk_shield.wasm \
  --network testnet \
  --source YOUR_SECRET_KEY

# Copy the output contract ID:
echo "NEXT_PUBLIC_CONTRACT_ID=CXXX..." > ../.env.local
```

### 6. Run the frontend

```bash
npm run dev
# Open http://localhost:3000
```

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CONTRACT_ID` | ✅ | Deployed ZK Shield Soroban contract address |
| `NEXT_PUBLIC_RPC_URL` | Optional | Soroban RPC URL (defaults to testnet) |
| `NEXT_PUBLIC_HORIZON_URL` | Optional | Horizon URL (defaults to testnet) |

---

## Scripts reference

| npm script | Description |
|------------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run compile:circuit` | Compile `commitment.circom` with Circom |
| `npm run setup:trusted` | Run dev trusted setup (Powers of Tau + phase 2) |
| `npm run test:proof` | End-to-end circuit test |
| `npm run export:vkey` | Export `verification_key.json` from zkey |
| `npm run gen:zeros` | Print Poseidon zero values for the Rust contract |
| `npm run deploy:contract` | Build + deploy Soroban contract |

---

## Security notes

- **Secrets in localStorage** — note secrets are currently stored unencrypted. A production build would encrypt them with the user's Freighter public key before storage.
- **Single-party trusted setup** — the `npm run setup:trusted` ceremony is insecure for mainnet. See the [SnarkJS docs](https://github.com/iden3/snarkjs#7-prepare-phase-2) on using a proper multi-party ceremony.
- **Scaffold verifier** — the on-chain Groth16 pairing check is a scaffold pending full `soroban-sdk v21` BN254 host function availability. It validates proof structure but does not yet perform a cryptographically complete pairing check.
- **Tree synchronisation** — the local Merkle tree is reconstructed from on-chain events. If events are missed (e.g. RPC gap), the computed root will not match and proofs will fail with a "root mismatch" error. Use the dashboard "Resync" button to rebuild from scratch.
- **No mainnet deployment** — this project is in active development on testnet only.

See [SECURITY.md](SECURITY.md) for the full responsible disclosure policy.

---

## Contributing

Contributions are very welcome. ZK Shield participates in the **[Drips Network Wave Program](https://www.drips.network/wave/stellar/repos)** — contributors who resolve labelled issues can receive on-chain XLM rewards via Drips.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and a curated list of good first issues ranging from frontend polish to circuit optimisation.

---

## Resources

| Resource | Link |
|----------|------|
| Stellar developer docs | https://developers.stellar.org/docs |
| Soroban smart contracts | https://developers.stellar.org/docs/smart-contracts |
| Circom documentation | https://docs.circom.io |
| snarkjs | https://github.com/iden3/snarkjs |
| circomlibjs | https://github.com/iden3/circomlibjs |
| Freighter wallet | https://www.freighter.app |
| Stellar Hacks: ZK 2026 | https://dorahacks.io/hackathon/stellar-hacks-zk |
| Drips Network | https://www.drips.network |
| Stellar Explorer (testnet) | https://stellar.expert/explorer/testnet |

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.
