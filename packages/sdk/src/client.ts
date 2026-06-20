import {
  Contract,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'
import { Server as SorobanServer } from '@stellar/stellar-sdk/rpc'
import type { ZkShieldClientConfig, DepositEvent, SpendEvent } from './types'

/**
 * ZkShieldClient — read-only and tx-building interface to the ZK Shield
 * Soroban contract. Sign and submit transactions with your own wallet/keypair.
 */
export class ZkShieldClient {
  private rpc: SorobanServer
  private cfg: ZkShieldClientConfig

  constructor(config: ZkShieldClientConfig) {
    this.cfg = config
    this.rpc = new SorobanServer(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith('http://') })
  }

  // ── Read-only ──────────────────────────────────────────────────────────────

  /** Current Merkle root as a 32-byte hex string. */
  async getRoot(): Promise<string> {
    const res = await this.rpc.readContract({
      contract: this.cfg.contractId,
      method: 'get_root',
      args: [],
    })
    const bytes = scValToNative(res.result.retval) as Uint8Array
    return Buffer.from(bytes).toString('hex')
  }

  /** Number of commitments inserted into the tree. */
  async getLeafCount(): Promise<number> {
    const res = await this.rpc.readContract({
      contract: this.cfg.contractId,
      method: 'get_leaf_count',
      args: [],
    })
    return Number(scValToNative(res.result.retval))
  }

  /** Check whether a nullifier has been spent. */
  async isSpent(nullifierHex: string): Promise<boolean> {
    const bytes = Buffer.from(nullifierHex, 'hex')
    const res = await this.rpc.readContract({
      contract: this.cfg.contractId,
      method: 'is_spent',
      args: [nativeToScVal(bytes, { type: 'bytes' })],
    })
    return Boolean(scValToNative(res.result.retval))
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  /** Fetch all past deposit events (commitment + leaf index). */
  async getDepositEvents(startLedger?: number): Promise<DepositEvent[]> {
    const ledger = await this.rpc.getLatestLedger()
    const from   = startLedger ?? Math.max(1, ledger.sequence - 100_000)

    const result = await this.rpc.getEvents({
      startLedger: from,
      filters: [{
        type: 'contract',
        contractIds: [this.cfg.contractId],
        topics: [[xdr.ScVal.scvSymbol('deposit').toXDR('base64')]],
      }],
      limit: 10_000,
    })

    return (result.events ?? []).flatMap((e: DepositEvent): { commitment: string; leafIndex: number; ledger: string; txHash?: string } => {
      try {
        const vals = (e.value as xdr.ScVal).vec() ?? []
        const [commitment, leafIndex] = vals.map(scValToNative)
        return [{
          commitment: Buffer.from(commitment as Uint8Array).toString('hex'),
          leafIndex: Number(leafIndex),
          ledger: e.ledger,
          txHash: e.txHash,
        }]
      } catch { return [] }
    }).sort((a, b) => a.leafIndex - b.leafIndex)
  }

  /** Fetch all past spend events (nullifier + type). */
  async getSpendEvents(startLedger?: number): Promise<SpendEvent[]> {
    const ledger = await this.rpc.getLatestLedger()
    const from   = startLedger ?? Math.max(1, ledger.sequence - 100_000)

    const result = await this.rpc.getEvents({
      startLedger: from,
      filters: [{
        type: 'contract',
        contractIds: [this.cfg.contractId],
        topics: [[xdr.ScVal.scvSymbol('spend').toXDR('base64')]],
      }],
      limit: 10_000,
    })

    return (result.events ?? []).flatMap((e) => {
      try {
        const vals = (e.value as xdr.ScVal).vec() ?? []
        const [nullifier, typeSymbol] = vals.map(scValToNative)
        return [{
          nullifier: Buffer.from(nullifier as Uint8Array).toString('hex'),
          type: String(typeSymbol) === 'tx' ? 'transfer' : 'withdraw',
          ledger: e.ledger,
          txHash: e.txHash,
        }] as SpendEvent[]
      } catch { return [] }
    })
  }

  // ── Transaction builders ───────────────────────────────────────────────────

  /** Build an unsigned deposit transaction XDR. */
  async buildDepositXdr(
    depositorPublicKey: string,
    commitmentHex: string,
    amountStroops: bigint,
  ): Promise<string> {
    const account  = await this.rpc.getAccount(depositorPublicKey)
    const contract = new Contract(this.cfg.contractId)
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.cfg.networkPassphrase,
    })
      .addOperation(contract.call(
        'deposit',
        xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(
              Buffer.from(depositorPublicKey, 'hex')
            )
          )
        ),
        nativeToScVal(Buffer.from(commitmentHex, 'hex'), { type: 'bytes' }),
        nativeToScVal(amountStroops, { type: 'i128' }),
      ))
      .setTimeout(30)
      .build()

    const sim = await this.rpc.simulateTransaction(tx)
    const { assembleTransaction } = await import('@stellar/stellar-sdk/rpc')
    return assembleTransaction(tx, sim).build().toXDR()
  }
}
