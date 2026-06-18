/**
 * scripts/trusted_setup.js
 *
 * Full Groth16 trusted setup for the commitment circuit.
 * Run ONCE after compiling the circuit:
 *
 *   npm run compile:circuit   (first)
 *   npm run setup:trusted     (this script)
 *
 * Output:
 *   circuits/build/commitment_final.zkey   → proving key
 *   public/circuits/commitment.wasm        → witness generator (browser)
 *   public/circuits/commitment.zkey        → proving key (browser)
 *   public/circuits/verification_key.json  → verification key
 *
 * WARNING: This is a DEVELOPMENT setup (single contributor).
 * For mainnet: use Hermez perpetual powers of tau + multi-party phase 2.
 */

const snarkjs = require('snarkjs')
const fs      = require('fs')
const path    = require('path')

const ROOT       = path.join(__dirname, '..')
const BUILD_DIR  = path.join(ROOT, 'circuits', 'build')
const PUBLIC_DIR = path.join(ROOT, 'public', 'circuits')
const WASM_DIR   = path.join(BUILD_DIR, 'commitment_js')

async function step(label, fn) {
  process.stdout.write(`\n  ${label}...`)
  const t = Date.now()
  await fn()
  console.log(` done (${((Date.now() - t) / 1000).toFixed(1)}s)`)
}

async function main() {
  console.log('🔧 ZK Shield — Groth16 Trusted Setup')
  console.log('   Circuit: commitment.circom (depth 20)')

  fs.mkdirSync(BUILD_DIR,  { recursive: true })
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })

  // Check circuit was compiled
  const r1csPath = path.join(BUILD_DIR, 'commitment.r1cs')
  if (!fs.existsSync(r1csPath)) {
    console.error('\n❌ commitment.r1cs not found.')
    console.error('   Run first: npm run compile:circuit')
    process.exit(1)
  }

  // ── Powers of Tau (phase 1) ────────────────────────────────────────────────
  // Power 18 supports up to 2^18 = 262,144 constraints.
  // Our depth-20 circuit has ~42,000 constraints — fits comfortably.
  const pot0 = path.join(BUILD_DIR, 'pot18_0000.ptau')
  const pot1 = path.join(BUILD_DIR, 'pot18_0001.ptau')
  const potF = path.join(BUILD_DIR, 'pot18_final.ptau')

  await step('Phase 1 — new accumulator (pot18)', async () => {
    await snarkjs.powersOfTau.newAccumulator('bn128', 18, pot0)
  })

  await step('Phase 1 — contribute entropy', async () => {
    await snarkjs.powersOfTau.contribute(
      pot0, pot1,
      'ZK Shield dev contribution',
      // In production: use random bytes from a hardware RNG
      Buffer.from(crypto.randomUUID ? crypto.randomUUID() : 'zk-shield-dev-entropy-2026').toString('hex')
    )
  })

  await step('Phase 1 — prepare phase 2', async () => {
    await snarkjs.powersOfTau.preparePhase2(pot1, potF)
  })

  // ── Phase 2 (circuit-specific) ─────────────────────────────────────────────
  const zkey0 = path.join(BUILD_DIR, 'commitment_0000.zkey')
  const zkeyF = path.join(BUILD_DIR, 'commitment_final.zkey')

  await step('Phase 2 — Groth16 setup', async () => {
    await snarkjs.groth16.setup(r1csPath, potF, zkey0)
  })

  await step('Phase 2 — contribute to zkey', async () => {
    await snarkjs.zKey.contribute(
      zkey0, zkeyF,
      'ZK Shield dev zkey contribution',
      Buffer.from('zk-shield-phase2-entropy-2026').toString('hex')
    )
  })

  // ── Export artifacts ───────────────────────────────────────────────────────
  await step('Export verification key', async () => {
    const vKey = await snarkjs.zKey.exportVerificationKey(zkeyF)
    fs.writeFileSync(
      path.join(PUBLIC_DIR, 'verification_key.json'),
      JSON.stringify(vKey, null, 2)
    )
  })

  await step('Copy WASM + zkey to public/', async () => {
    // WASM witness generator
    const wasmSrc = path.join(WASM_DIR, 'commitment.wasm')
    if (!fs.existsSync(wasmSrc)) {
      throw new Error(`WASM not found at ${wasmSrc}. Did compile:circuit finish?`)
    }
    fs.copyFileSync(wasmSrc, path.join(PUBLIC_DIR, 'commitment.wasm'))
    fs.copyFileSync(zkeyF,   path.join(PUBLIC_DIR, 'commitment.zkey'))
  })

  // ── Sizes ──────────────────────────────────────────────────────────────────
  const files = {
    'commitment.wasm':        path.join(PUBLIC_DIR, 'commitment.wasm'),
    'commitment.zkey':        path.join(PUBLIC_DIR, 'commitment.zkey'),
    'verification_key.json':  path.join(PUBLIC_DIR, 'verification_key.json'),
  }
  console.log('\n📦 Artifacts:')
  for (const [name, p] of Object.entries(files)) {
    const size = (fs.statSync(p).size / 1024).toFixed(1)
    console.log(`   public/circuits/${name.padEnd(24)} ${size} KB`)
  }

  console.log('\n✅ Trusted setup complete!')
  console.log('\nNext steps:')
  console.log('  1. node scripts/test_proof.js    ← verify the circuit works')
  console.log('  2. node scripts/export_vkey.js   ← prepare vkey for Soroban')
  console.log('  3. stellar contract build         ← compile Rust contract')
  console.log('  4. stellar contract deploy ...    ← deploy to testnet')
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message)
  process.exit(1)
})
