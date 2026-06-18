# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` (testnet) | ✅ Active |
| Older tags | ❌ Not supported |

ZK Shield is currently in **testnet / hackathon stage**. Do not use it on Stellar mainnet with real funds.

---

## Known limitations (by design)

- **localStorage secrets** — note secrets are stored unencrypted in the browser. A production build must encrypt them with the user's wallet keypair.
- **Dev trusted setup** — the Groth16 proving key was generated with a single-party Powers of Tau ceremony. This is insecure for mainnet. A multi-party ceremony is required before any mainnet deployment.
- **Scaffold ZK verifier** — the on-chain Groth16 pairing check is scaffolded pending `soroban-sdk v21` BN254 host functions. The current code validates proof structure but does not perform a full cryptographic pairing verification.

---

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email: **security@zkshield.xyz** (replace with your actual address)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- (Optional) suggested fix

We will acknowledge receipt within **48 hours** and aim to provide a fix or mitigation within **7 days** for critical issues.

---

## Scope

In scope:
- Soroban contract (`contracts/src/lib.rs`)
- ZK circuit (`circuits/commitment.circom`)
- Proof generation logic (`lib/zk/proof.ts`)
- Merkle tree implementation (`lib/merkle/tree.ts`)

Out of scope:
- Third-party dependencies (report to the respective maintainers)
- Issues requiring a compromised trusted setup
- UI/UX bugs without security impact
