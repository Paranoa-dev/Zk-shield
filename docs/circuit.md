# ZK Shield Circuit

## Circuit: `circuits/commitment.circom`

### Purpose
Proves (in zero-knowledge) that a spender knows a valid secret corresponding to a commitment in the on-chain Merkle tree — without revealing the secret, the amount, or which leaf they are spending.

### Signals

| Signal | Visibility | Type | Description |
|--------|-----------|------|-------------|
| `secret` | private | field | Random 31-byte value only the depositor knows |
| `amount` | private | field | Deposit amount in stroops |
| `pathElements[20]` | private | field[20] | Sibling hashes along the Merkle path |
| `pathIndices[20]` | private | binary[20] | 0 = leaf is left child, 1 = right child |
| `root` | **public** | field | Current on-chain Merkle root |
| `nullifier` | **public** | field | `Poseidon(secret)` — prevents double-spend |

### Constraints enforced

1. **Commitment validity**: `commitment = Poseidon(secret, amount)` and `commitment` is a leaf in the tree at the given path.
2. **Nullifier binding**: `nullifier = Poseidon(secret)` — binds the nullifier to the secret without revealing it.
3. **Merkle inclusion**: hashing up the path from `commitment` using `pathElements` and `pathIndices` must produce `root`.

### Compiling

```bash
# Install Circom 2 first
npm install -g circom

# Compile
npm run compile:circuit
# Output: circuits/build/commitment.r1cs, commitment.wasm, commitment.sym
```

### Trusted setup (dev)

```bash
npm run setup:trusted
# Output: public/circuits/commitment.wasm
#         public/circuits/commitment.zkey
#         public/circuits/verification_key.json
```

> ⚠️ The dev ceremony is single-party and **not safe for mainnet**.

### Constraint count (approximate)

| Component | Constraints |
|-----------|-------------|
| Poseidon(2) × 1 — commitment | ~220 |
| Poseidon(1) × 1 — nullifier | ~110 |
| Poseidon(2) × 20 — Merkle path | ~4400 |
| Mux1 × 40 — path routing | ~80 |
| **Total** | **~4810** |

### Security properties

- **Soundness**: An adversary cannot produce a valid proof for a commitment not in the tree.
- **Zero-knowledge**: The proof reveals nothing about `secret`, `amount`, or `leafIndex`.
- **Nullifier uniqueness**: Each commitment can only be spent once; reuse produces the same nullifier which is rejected by the contract.
