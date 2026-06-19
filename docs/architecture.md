# ZK Shield — Architecture

## Overview

ZK Shield is a **shielded payment pool** on Stellar. XLM enters publicly, moves privately inside the pool, and exits to any address with no on-chain link to the depositor.

```
┌─────────────────────────────────┐
│         Browser / dApp          │
│                                 │
│  app/          ← Next.js pages  │
│  components/   ← React UI       │
│  hooks/        ← React hooks    │
│  lib/zk/       ← Proof logic    │
│  lib/merkle/   ← Tree client    │
│  lib/stellar/  ← Contract SDK   │
│                                 │
│  packages/sdk/ ← Standalone SDK │
└───────────────┬─────────────────┘
                │ Stellar SDK (XDR)
                ▼
┌─────────────────────────────────┐
│     Stellar Network (Soroban)   │
│                                 │
│  contracts/src/lib.rs           │
│  ├── deposit()                  │
│  ├── spend()                    │
│  ├── get_root()                 │
│  └── is_spent()                 │
└─────────────────────────────────┘
```

## Key design decisions

### Poseidon over SHA-256
Poseidon is ZK-friendly (far fewer constraints in a Circom circuit). SHA-256 inside a circuit would cost ~25k constraints vs ~220 for Poseidon. The Soroban contract uses sha256 as a temporary fallback pending Poseidon host functions in soroban-sdk v21.

### Incremental Merkle tree
The tree (depth 20, ~1M slots) is stored incrementally — only the current path of filled subtrees is kept in contract storage, not all 2^20 leaves. This keeps storage O(depth) = O(20) instead of O(n).

### Nullifiers
`nullifier = Poseidon(secret)` — deterministic and cannot be linked to the commitment `Poseidon(secret, amount)` without knowing the secret. Revealed publicly when spending to prevent double-spend.

### Client-side proof generation
Groth16 proof generation runs entirely in the browser via snarkjs + WebAssembly. The Soroban contract only verifies (cheap). This keeps the trusted setup off-chain and avoids putting the proving key on-chain.

## Data flow

### Deposit
```
User                           Contract
  │  generateSecret()           │
  │  commitment = Poseidon(s,a) │
  │  deposit(commitment, amt) ──▶ insert_leaf(commitment)
  │                              emit deposit(commitment, leafIndex)
  │  save note locally ◀─────────
```

### Transfer / Withdraw
```
User                           Contract
  │  fetchDepositEvents() ──────▶
  │  rebuildMerkleTree() ◀───────
  │  getProof(leafIndex)          │
  │  groth16.fullProve(...)       │
  │  spend(proof, null, newCommit) ──▶ verify_proof()
  │                                    mark_spent(nullifier)
  │                                    insert_leaf(newCommit) or transfer XLM
```

## Component relationships

```
app/deposit/page.tsx
  └── uses: useWallet, createCommitment (lib/zk/proof), buildDepositTx (lib/stellar)

app/transfer/page.tsx
app/withdraw/page.tsx
  └── uses: useTreeSync (hooks), useProof (components/proof), buildSpendTx

hooks/useTreeSync.ts
  ├── calls: fetchDepositEvents (lib/stellar/contract)
  ├── calls: fetchSpentNullifiers (lib/stellar/contract)
  └── builds: MerkleTree (lib/merkle/tree)

components/proof/useProof.ts
  ├── calls: useTreeSync
  ├── calls: generateProof (lib/zk/proof)
  └── calls: buildSpendTx (lib/stellar/contract)

packages/sdk/
  └── standalone wrapper — same contract calls, no React dependency
```
