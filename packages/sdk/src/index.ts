/**
 * @zk-shield/sdk
 *
 * Standalone JavaScript SDK for the ZK Shield Soroban contract.
 * Use this in any Node.js or browser project to interact with the pool.
 *
 * @example
 * ```ts
 * import { ZkShieldClient } from '@zk-shield/sdk'
 *
 * const client = new ZkShieldClient({
 *   contractId: 'CXXX...',
 *   rpcUrl: 'https://soroban-testnet.stellar.org',
 *   networkPassphrase: 'Test SDF Network ; September 2015',
 * })
 *
 * const root    = await client.getRoot()
 * const count   = await client.getLeafCount()
 * const spent   = await client.isSpent(nullifierBytes)
 * ```
 */

export { ZkShieldClient } from './client'
export type { ZkShieldClientConfig, DepositEvent, SpendEvent } from './types'
