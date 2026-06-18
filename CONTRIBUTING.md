# Contributing to ZK Shield

Thank you for your interest in ZK Shield! This is an open-source project and all contributions are welcome — from bug fixes and documentation improvements to new features and circuit optimisations.

ZK Shield participates in the **[Drips Network Wave Program](https://www.drips.network/wave/stellar/repos)**. Contributors who resolve funded issues can receive on-chain XLM rewards directly via Drips.

---

## Getting started

### Prerequisites

- Node.js ≥ 18
- Rust + Cargo (`curl https://sh.rustup.rs | sh`)
- Stellar CLI (`cargo install --locked stellar-cli`)
- Circom 2 (`npm install -g circom`)

### Local setup

```bash
git clone https://github.com/zk-shield/zk-shield.git
cd zk-shield
npm install

# Compile ZK circuit
npm run compile:circuit

# Run trusted setup (dev only)
npm run setup:trusted

# Test the proof end-to-end
npm run test:proof

# Run the frontend
npm run dev
```

---

## How to contribute

1. **Find an issue** — browse [open issues](https://github.com/zk-shield/zk-shield/issues), especially ones labelled [`good first issue`](https://github.com/zk-shield/zk-shield/issues?q=is%3Aopen+label%3A%22good+first+issue%22).
2. **Comment** on the issue to let others know you're working on it.
3. **Fork** the repo and create a branch: `git checkout -b fix/your-branch-name`
4. **Make your changes** — see the coding conventions below.
5. **Test** — run `npm run lint`, `npm run build`, and `npm run test:proof` before opening a PR.
6. **Open a PR** against `main` using the PR template.

---

## Coding conventions

- **TypeScript**: strict mode enabled. No `any` types.
- **Rust**: run `cargo fmt` and `cargo clippy` before committing.
- **Commits**: use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).
- **No secrets**: never commit `.env.local`, private keys, or `.ptau` files.

---

## Good first issues

These are well-scoped tasks ideal for first-time contributors:

| Area | Task | Difficulty |
|------|------|------------|
| Frontend | Add copy-to-clipboard button for note backup | Easy |
| Frontend | Dark mode toggle | Easy |
| Docs | Add Spanish translation of README | Easy |
| Circuit | Add constraint to enforce amount > 0 | Medium |
| Contract | Add `get_commitment(leaf_index)` read-only fn | Medium |
| Security | Encrypt notes in localStorage with wallet pubkey | Medium |
| Contract | Replace `sha256` fallback with real Poseidon host fn | Hard |
| Circuit | Support multi-denomination deposits (fixed set) | Hard |

Open the [issues tab](https://github.com/zk-shield/zk-shield/issues) to claim one.

---

## Code of conduct

Be respectful and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

---

## Questions?

Open a [GitHub Discussion](https://github.com/zk-shield/zk-shield/discussions) or file an issue with the `question` label.
