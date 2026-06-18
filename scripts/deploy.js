/**
 * scripts/deploy.js
 *
 * Initialises the ZK Shield contract after deployment.
 * Uploads the verifying key and wires up the XLM token.
 *
 * Prerequisites:
 *   1. stellar contract deploy → set CONTRACT_ID below or as env var
 *   2. node scripts/export_vkey.js → produces circuits/build/vkey.bin
 *
 * Usage:
 *   CONTRACT_ID=CXXX... SECRET_KEY=SXXX... node scripts/deploy.js
 *
 * Or edit the CONFIG block below and run:
 *   node scripts/deploy.js
 */

const {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  rpc: StellarRpc,
  Address,
  xdr,
} = require('@stellar/stellar-sdk')
const fs   = require('fs')
const path = require('path')

// ── CONFIG — edit these or set as env vars ────────────────────────────────────
const CONFIG = {
  contractId:  process.env.CONTRACT_ID  || 'REPLACE_WITH_YOUR_CONTRACT_ID',
  secretKey:   process.env.SECRET_KEY   || 'REPLACE_WITH_YOUR_SECRET_KEY',
  network:     process.env.NETWORK      || 'testnet',
}

const NETWORK_SETTINGS = {
  testnet: {
    passphrase: Networks.TESTNET,
    rpcUrl:     'https://soroban-testnet.stellar.org',
    // Native XLM token on testnet (Soroban's wrapped native token)
    xlmToken:   'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  },
  mainnet: {
    passphrase: Networks.MAINNET,
    rpcUrl:     'https://mainnet.sorobanrpc.com',
    xlmToken:   'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
  },
}

async function poll(rpc, hash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const status = await rpc.getTransaction(hash)
    if (status.status === StellarRpc.Api.GetTransactionStatus.SUCCESS) return status
    if (status.status === StellarRpc.Api.GetTransactionStatus.FAILED)
      throw new Error(`Transaction failed: ${hash}`)
  }
  throw new Error('Transaction confirmation timed out')
}

async function main() {
  const { contractId, secretKey, network } = CONFIG
  const { passphrase, rpcUrl, xlmToken }   = NETWORK_SETTINGS[network] ?? NETWORK_SETTINGS.testnet

  if (contractId.startsWith('REPLACE') || secretKey.startsWith('REPLACE')) {
    console.error('❌ Set CONTRACT_ID and SECRET_KEY env vars or edit CONFIG in deploy.js')
    process.exit(1)
  }

  console.log(`\n🚀 Initialising ZK Shield on ${network}`)
  console.log(`   Contract : ${contractId}`)
  console.log(`   Admin    : ${Keypair.fromSecret(secretKey).publicKey()}`)

  // Load vkey binary
  const vkeyPath = path.join(__dirname, '..', 'circuits', 'build', 'vkey.bin')
  if (!fs.existsSync(vkeyPath)) {
    console.error('❌ vkey.bin not found. Run: node scripts/export_vkey.js')
    process.exit(1)
  }
  const vkeyBytes = fs.readFileSync(vkeyPath)
  console.log(`   VKey     : ${vkeyBytes.length} bytes`)

  const keypair = Keypair.fromSecret(secretKey)
  const rpc     = new StellarRpc.Server(rpcUrl, { allowHttp: false })
  const account = await rpc.getAccount(keypair.publicKey())

  const contract = new Contract(contractId)
  const args = [
    Address.fromString(keypair.publicKey()).toScVal(),  // admin
    Address.fromString(xlmToken).toScVal(),             // xlm_token
    xdr.ScVal.scvBytes(vkeyBytes),                      // verifying_key
  ]

  // Build
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperation(contract.call('initialize', ...args))
    .setTimeout(30)
    .build()

  // Simulate
  process.stdout.write('   Simulating...')
  const sim = await rpc.simulateTransaction(tx)
  if (StellarRpc.Api.isSimulationError(sim)) {
    console.error('\n❌ Simulation error:', sim.error)
    process.exit(1)
  }
  console.log(' ok')

  // Assemble + sign + send
  const assembled = StellarRpc.assembleTransaction(tx, sim).build()
  assembled.sign(keypair)

  process.stdout.write('   Submitting...')
  const result = await rpc.sendTransaction(assembled)
  if (result.status === 'ERROR') {
    console.error('\n❌ Submission error:', result.errorResult?.toString())
    process.exit(1)
  }
  console.log(` hash: ${result.hash}`)

  process.stdout.write('   Confirming')
  await poll(rpc, result.hash)
  console.log(' ✓')

  console.log('\n✅ Contract initialised!')
  console.log('\n📋 Add to your .env.local:')
  console.log(`   NEXT_PUBLIC_CONTRACT_ID=${contractId}`)
  console.log(`   NEXT_PUBLIC_NETWORK=${network}`)
  console.log('\nThen: npm run dev')
}

main().catch(err => {
  console.error('\n❌ Deploy failed:', err.message ?? err)
  process.exit(1)
})
