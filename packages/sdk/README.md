# @zk-shield/sdk

JavaScript/TypeScript SDK for the [ZK Shield](https://github.com/Paranoa-dev/Zk-shield) private payment protocol on Stellar.

## Installation

```bash
npm install @zk-shield/sdk @stellar/stellar-sdk
```

## Usage

```ts
import { ZkShieldClient } from '@zk-shield/sdk'
import { Networks } from '@stellar/stellar-sdk'

const client = new ZkShieldClient({
  contractId:       'CXXX...your deployed contract ID',
  rpcUrl:           'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
})

// Read pool state
const root      = await client.getRoot()         // hex Merkle root
const leafCount = await client.getLeafCount()    // number of deposits
const isSpent   = await client.isSpent('abc123...') // check nullifier

// Fetch events (for rebuilding a Merkle tree client-side)
const deposits = await client.getDepositEvents()
const spends   = await client.getSpendEvents()

// Build an unsigned deposit transaction
const xdr = await client.buildDepositXdr(
  'GABC...depositor public key',
  'deadbeef...commitment hex',
  10_000_000n,  // 1 XLM in stroops
)
// Sign xdr with Freighter or a keypair, then submit
```

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `getRoot()` | `Promise<string>` | Current Merkle root (hex) |
| `getLeafCount()` | `Promise<number>` | Number of commitments in the tree |
| `isSpent(nullifierHex)` | `Promise<boolean>` | Check if a nullifier was used |
| `getDepositEvents(startLedger?)` | `Promise<DepositEvent[]>` | All deposit events |
| `getSpendEvents(startLedger?)` | `Promise<SpendEvent[]>` | All spend events |
| `buildDepositXdr(...)` | `Promise<string>` | Unsigned deposit tx XDR |

## Building

```bash
cd packages/sdk
npm install
npm run build
```

## Contributing

See the [main contributing guide](../../CONTRIBUTING.md).
Issues labelled [`sdk`](https://github.com/Paranoa-dev/Zk-shield/issues?q=label%3Asdk) are a good starting point.
