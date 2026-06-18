# Changelog

All notable changes to ZK Shield will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Planned
- Full BN254 Groth16 pairing verification via Soroban SDK v21 host functions
- Encrypted note storage (wallet-keypair encryption)
- Multi-party trusted setup ceremony
- Mainnet deployment

---

## [0.1.0] — 2026-06-18

Initial hackathon release for **Stellar Hacks: ZK 2026**.

### Added
- Circom 2 commitment circuit (`Poseidon(secret, amount)`) with Groth16 / BN254
- Soroban smart contract with incremental Merkle tree (depth 20, Poseidon hashing)
- Deposit, transfer, and withdraw flows with ZK proof generation in the browser
- snarkjs-based proof generation and local verification
- Freighter wallet integration
- Incremental Merkle tree reconstructed from Soroban events
- Note backup / restore UI
- Trusted setup scripts (dev-only ceremony)
- CI workflow (lint, type-check, contract build)
- Drips Network Wave Program scaffolding (CONTRIBUTING.md, issue templates, drips.json)
