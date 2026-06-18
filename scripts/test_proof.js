/**
 * scripts/test_proof.js
 *
 * End-to-end ZK circuit test — no frontend, no blockchain.
 * Simulates: deposit → prove → verify → reject-bad-input.
 *
 * Run: node scripts/test_proof.js
 *
 * Must run after:
 *   npm run compile:circuit
 *   npm run setup:trusted
 */

const snarkjs        = require('snarkjs')
const { buildPoseidon } = require('circomlibjs')
const crypto         = require('crypto')
const fs             = require('fs')
const path           = require('path')

const PUBLIC = path.join(__dirname, '..', 'public', 'circuits')
const WASM   = path.join(PUBLIC, 'commitment.wasm')
const ZKEY   = path.join(PUBLIC, 'commitment.zkey')
const VKEY   = path.join(PUBLIC, 'verification_key.json')

// ── Merkle tree (mirrors lib/merkle/tree.ts) ──────────────────────────────────

class TestMerkleTree {
  constructor(poseidon, depth = 20) {
    this.poseidon = poseidon
    this.depth    = depth
    this.layers   = Array.from({ length: depth + 1 }, () => [])
    this.zeros    = []
    this.nextIdx  = 0
  }

  async init() {
    this.zeros[0] = this._hash([0n])
    for (let i = 1; i <= this.depth; i++) {
      this.zeros[i] = this._hash([this.zeros[i-1], this.zeros[i-1]])
    }
  }

  _hash(inputs) {
    const r = this.poseidon(inputs.map(BigInt))
    return this.poseidon.F.toObject(r)
  }

  async insert(leaf) {
    let idx  = this.nextIdx
    let hash = leaf
    for (let i = 0; i < this.depth; i++) {
      this.layers[i][idx] = hash
      const sibling = idx % 2 === 0 ? this.zeros[i] : this.layers[i][idx - 1]
      const [l, r]  = idx % 2 === 0 ? [hash, sibling] : [sibling, hash]
      hash = this._hash([l, r])
      idx  = Math.floor(idx / 2)
    }
    this.layers[this.depth][0] = hash
    return this.nextIdx++
  }

  proof(index) {
    const pathElements = []
    const pathIndices  = []
    let   idx = index
    for (let i = 0; i < this.depth; i++) {
      const isLeft = idx % 2 === 0
      pathIndices.push(isLeft ? 0 : 1)
      const sibIdx = isLeft ? idx + 1 : idx - 1
      pathElements.push(this.layers[i][sibIdx] ?? this.zeros[i])
      idx = Math.floor(idx / 2)
    }
    return { pathElements, pathIndices, root: this.layers[this.depth][0] ?? this.zeros[this.depth] }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomSecret() {
  const b = crypto.randomBytes(31)
  return b.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n)
}

function ok(msg)   { console.log(`   ✅ ${msg}`) }
function fail(msg) { console.error(`   ❌ ${msg}`); process.exit(1) }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪 ZK Shield — Circuit End-to-End Test\n')

  // Pre-flight check
  for (const [label, p] of [['WASM', WASM], ['zkey', ZKEY], ['vkey', VKEY]]) {
    if (!fs.existsSync(p)) fail(`${label} not found at ${p}\n   Run: npm run compile:circuit && npm run setup:trusted`)
  }
  ok('Circuit artifacts found')

  const poseidon = await buildPoseidon()
  const tree     = new TestMerkleTree(poseidon)
  await tree.init()

  function hash(...inputs) {
    const r = poseidon(inputs.map(BigInt))
    return poseidon.F.toObject(r)
  }

  // ── Test 1: Single deposit + prove + verify ───────────────────────────────
  console.log('\n1️⃣  Deposit + Proof + Verify')

  const secret     = randomSecret()
  const amount     = BigInt(100 * 10_000_000)          // 100 XLM in stroops
  const commitment = hash(secret, amount)
  const nullifier  = hash(secret)

  const leafIdx = await tree.insert(commitment)
  ok(`Commitment inserted at leaf #${leafIdx}`)
  ok(`Merkle root: ${tree.layers[20][0]}`)

  const { pathElements, pathIndices, root } = tree.proof(leafIdx)

  const input = {
    secret:       secret.toString(),
    amount:       amount.toString(),
    pathElements: pathElements.map(String),
    pathIndices,
    root:         root.toString(),
    nullifier:    nullifier.toString(),
  }

  const t0 = Date.now()
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY)
  ok(`Proof generated in ${Date.now() - t0}ms`)
  ok(`Public signals: [${publicSignals.slice(0,2).join(', ')}...]`)

  const vKey  = JSON.parse(fs.readFileSync(VKEY, 'utf8'))
  const valid = await snarkjs.groth16.verify(vKey, publicSignals, proof)
  if (!valid) fail('Proof verification returned false')
  ok('Proof is VALID ✓')

  // ── Test 2: Wrong secret → constraint violation ────────────────────────────
  console.log('\n2️⃣  Reject wrong secret')
  try {
    await snarkjs.groth16.fullProve(
      { ...input, secret: (secret + 1n).toString() },
      WASM, ZKEY
    )
    fail('Expected constraint violation — circuit did NOT reject bad secret')
  } catch {
    ok('Correctly rejected wrong secret (constraint unsatisfied)')
  }

  // ── Test 3: Wrong nullifier → constraint violation ─────────────────────────
  console.log('\n3️⃣  Reject tampered nullifier')
  try {
    await snarkjs.groth16.fullProve(
      { ...input, nullifier: (nullifier + 1n).toString() },
      WASM, ZKEY
    )
    fail('Expected constraint violation — circuit did NOT reject bad nullifier')
  } catch {
    ok('Correctly rejected wrong nullifier (constraint unsatisfied)')
  }

  // ── Test 4: Multiple deposits, prove second leaf ───────────────────────────
  console.log('\n4️⃣  Multiple deposits — prove second leaf')

  const secret2     = randomSecret()
  const commitment2 = hash(secret2, amount)
  const nullifier2  = hash(secret2)

  // Insert a second commitment
  await tree.insert(commitment2)
  const leafIdx3 = await tree.insert(hash(randomSecret(), amount)) // third leaf
  ok(`Inserted 2 more leaves (total: ${tree.nextIdx})`)

  const proof2Input = {
    secret:       secret2.toString(),
    amount:       amount.toString(),
    pathElements: tree.proof(1).pathElements.map(String),
    pathIndices:  tree.proof(1).pathIndices,
    root:         tree.proof(1).root.toString(),
    nullifier:    nullifier2.toString(),
  }

  const { proof: proof2, publicSignals: ps2 } =
    await snarkjs.groth16.fullProve(proof2Input, WASM, ZKEY)
  const valid2 = await snarkjs.groth16.verify(vKey, ps2, proof2)
  if (!valid2) fail('Proof for second leaf is invalid')
  ok('Proof for second leaf is VALID ✓')

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(52))
  console.log('🎉 All tests passed! The ZK circuit is working.')
  console.log('─'.repeat(52))
  console.log('\nNext steps:')
  console.log('  node scripts/export_vkey.js    ← prep vkey for Soroban')
  console.log('  stellar contract build         ← compile Rust contract')
  console.log('  stellar contract deploy ...    ← deploy to testnet')
  console.log('  node scripts/deploy.js         ← initialise contract')
  console.log('  npm run dev                    ← start the frontend')
}

main().catch(err => {
  console.error('\n❌ Test failed:', err.message ?? err)
  process.exit(1)
})
