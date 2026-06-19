/**
 * Stellar / Soroban interaction layer
 */

import {
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Contract,
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
  Keypair,
} from '@stellar/stellar-sdk'
import { Server as SorobanServer, Api } from '@stellar/stellar-sdk/rpc'

// ─── Config ───────────────────────────────────────────────────────────────────

export const NETWORK = {
  passphrase: Networks.TESTNET,
  rpcUrl:     process.env.NEXT_PUBLIC_RPC_URL     ?? 'https://soroban-testnet.stellar.org',
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  explorerUrl:'https://stellar.expert/explorer/testnet',
}

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ??
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM'

// ─── RPC ──────────────────────────────────────────────────────────────────────

let _rpc: SorobanServer | null = null
export function getRpc(): SorobanServer {
  if (!_rpc) _rpc = new SorobanServer(NETWORK.rpcUrl, { allowHttp: false })
  return _rpc
}

// ─── Account helpers ──────────────────────────────────────────────────────────

export async function getXlmBalance(publicKey: string): Promise<string> {
  try {
    const resp = await fetch(`${NETWORK.horizonUrl}/accounts/${publicKey}`)
    if (!resp.ok) return '0'
    const data = await resp.json()
    const native = (data.balances ?? []).find(
      (b: { asset_type: string }) => b.asset_type === 'native'
    )
    return native?.balance ?? '0'
  } catch {
    return '0'
  }
}

// ─── Build + simulate ─────────────────────────────────────────────────────────

async function buildAndSimulate(
  publicKey: string,
  methodName: string,
  args: xdr.ScVal[],
): Promise<string> {
  const rpc     = getRpc()
  const account = await rpc.getAccount(publicKey)
  const contract = new Contract(CONTRACT_ID)

  const tx = new TransactionBuilder(account, {
    fee:              BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call(methodName, ...args))
    .setTimeout(30)
    .build()

  const sim = await rpc.simulateTransaction(tx)
  if (Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }

  // assembleTransaction is a named export in @stellar/stellar-sdk/rpc
  const { assembleTransaction } = await import('@stellar/stellar-sdk/rpc')
  return assembleTransaction(tx, sim).build().toXDR()
}

// ─── Submit + poll ────────────────────────────────────────────────────────────

export async function submitTransaction(signedXdr: string): Promise<{ hash: string; ledger: number }> {
  const { TransactionBuilder: TB } = await import('@stellar/stellar-sdk')
  const rpc = getRpc()
  const tx  = TB.fromXDR(signedXdr, NETWORK.passphrase)

  const result = await rpc.sendTransaction(tx)
  if (result.status === 'ERROR') {
    throw new Error(`Transaction error: ${result.errorResult?.toString() ?? 'unknown'}`)
  }

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const status = await rpc.getTransaction(result.hash)
    if (status.status === Api.GetTransactionStatus.SUCCESS) {
      return { hash: result.hash, ledger: (status as { ledger: number }).ledger }
    }
    if (status.status === Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain: ${result.hash}`)
    }
  }
  throw new Error('Transaction timed out')
}

// ─── Contract operations ──────────────────────────────────────────────────────

/** Build deposit transaction XDR (unsigned) */
export async function buildDepositTx(
  publicKey:    string,
  commitment:   bigint,
  amountStroops: bigint,
): Promise<string> {
  return buildAndSimulate(publicKey, 'deposit', [
    Address.fromString(publicKey).toScVal(),
    nativeToScVal(Buffer.from(commitment.toString(16).padStart(64, '0'), 'hex'), { type: 'bytes' }),
    nativeToScVal(amountStroops, { type: 'i128' }),
  ])
}

/** Build spend (transfer or withdraw) transaction XDR (unsigned) */
export async function buildSpendTx(
  publicKey:      string,
  proofBytes:     Uint8Array,
  _publicSignals: string[],
  nullifier:      bigint,
  newCommitment:  bigint,
  recipientAddress: string | null,
): Promise<string> {
  const toBytes32 = (n: bigint) =>
    Buffer.from(n.toString(16).padStart(64, '0'), 'hex')

  const recipientArg = recipientAddress
    ? xdr.ScVal.scvVec([Address.fromString(recipientAddress).toScVal()])
    : xdr.ScVal.scvVec([])

  return buildAndSimulate(publicKey, 'spend', [
    Address.fromString(publicKey).toScVal(),
    xdr.ScVal.scvBytes(Buffer.from(proofBytes)),
    nativeToScVal(toBytes32(nullifier),     { type: 'bytes' }),
    nativeToScVal(toBytes32(newCommitment), { type: 'bytes' }),
    recipientArg,
    nativeToScVal(0n, { type: 'i128' }),   // amount — enforced by the ZK circuit
  ])
}

// ─── Event fetching ───────────────────────────────────────────────────────────

export interface DepositEvent {
  commitment: bigint
  leafIndex:  number
  ledger:     number
}

export async function fetchDepositEvents(): Promise<DepositEvent[]> {
  const rpc     = getRpc()
  const events: DepositEvent[] = []

  try {
    // Get the current ledger to use as startLedger
    const ledgerInfo  = await rpc.getLatestLedger()
    const startLedger = Math.max(1, ledgerInfo.sequence - 100_000)

    const result = await rpc.getEvents({
      startLedger,
      filters: [{
        type:        'contract',
        contractIds: [CONTRACT_ID],
        topics:      [[xdr.ScVal.scvSymbol('deposit').toXDR('base64')]],
      }],
      limit: 1000,
    })

    for (const event of result.events ?? []) {
      try {
        const vals = (event.value as xdr.ScVal).vec() ?? []
        const [commitmentVal, leafIndexVal] = vals.map(scValToNative)
        events.push({
          commitment: BigInt(commitmentVal),
          leafIndex:  Number(leafIndexVal),
          ledger:     event.ledger,
        })
      } catch {
        // skip malformed events
      }
    }
  } catch (err) {
    console.warn('[stellar] fetchDepositEvents:', err)
  }

  return events.sort((a, b) => a.leafIndex - b.leafIndex)
}

export async function fetchSpentNullifiers(): Promise<bigint[]> {
  const rpc       = getRpc()
  const nullifiers: bigint[] = []

  try {
    const ledgerInfo  = await rpc.getLatestLedger()
    const startLedger = Math.max(1, ledgerInfo.sequence - 100_000)

    const result = await rpc.getEvents({
      startLedger,
      filters: [{
        type:        'contract',
        contractIds: [CONTRACT_ID],
        topics:      [[xdr.ScVal.scvSymbol('spend').toXDR('base64')]],
      }],
      limit: 1000,
    })

    for (const event of result.events ?? []) {
      try {
        const vals = (event.value as xdr.ScVal).vec() ?? []
        if (vals.length > 0) nullifiers.push(BigInt(scValToNative(vals[0])))
      } catch {
        // skip
      }
    }
  } catch (err) {
    console.warn('[stellar] fetchSpentNullifiers:', err)
  }

  return nullifiers
}
