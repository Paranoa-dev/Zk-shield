/**
 * scripts/export_vkey.js
 *
 * Converts verification_key.json → vkey.bin (Soroban-compatible binary).
 *
 * Layout (all uncompressed affine BN254 points, big-endian 32B each):
 *   alpha_g1  :  64B  (G1: x[32], y[32])
 *   beta_g2   : 128B  (G2: x0[32], x1[32], y0[32], y1[32])
 *   gamma_g2  : 128B
 *   delta_g2  : 128B
 *   IC[0]     :  64B  ← constant term
 *   IC[1]     :  64B  ← root signal
 *   IC[2]     :  64B  ← nullifier signal
 *
 * Total: 448 + 3×64 = 640 bytes
 *
 * Run: node scripts/export_vkey.js
 */

const fs   = require('fs')
const path = require('path')

const VK_JSON = path.join(__dirname, '..', 'public', 'circuits', 'verification_key.json')
const OUT_BIN = path.join(__dirname, '..', 'circuits', 'build', 'vkey.bin')
const OUT_HEX = path.join(__dirname, '..', 'circuits', 'build', 'vkey.hex')

function toBE32(hexOrDec) {
  let hex = hexOrDec.startsWith('0x')
    ? hexOrDec.slice(2)
    : BigInt(hexOrDec).toString(16)
  return Buffer.from(hex.padStart(64, '0'), 'hex')  // 32 bytes
}

function g1ToBuffer(point) {
  // point = [ "0x...", "0x...", "1" ]
  return Buffer.concat([toBE32(point[0]), toBE32(point[1])])  // 64 bytes
}

function g2ToBuffer(point) {
  // point = [ ["0x...", "0x..."], ["0x...", "0x..."], ["1","0"] ]
  // Fp2 element: x = x[0] + x[1]·i
  return Buffer.concat([
    toBE32(point[0][0]), toBE32(point[0][1]),  // x0, x1
    toBE32(point[1][0]), toBE32(point[1][1]),  // y0, y1
  ])  // 128 bytes
}

function main() {
  if (!fs.existsSync(VK_JSON)) {
    console.error('❌ verification_key.json not found.')
    console.error('   Run: npm run compile:circuit && npm run setup:trusted')
    process.exit(1)
  }

  const vk = JSON.parse(fs.readFileSync(VK_JSON, 'utf8'))

  const parts = [
    g1ToBuffer(vk.vk_alpha_1),   //  64B
    g2ToBuffer(vk.vk_beta_2),    // 128B
    g2ToBuffer(vk.vk_gamma_2),   // 128B
    g2ToBuffer(vk.vk_delta_2),   // 128B
    ...vk.IC.map(g1ToBuffer),    //  64B × (n_signals + 1)
  ]

  const buf = Buffer.concat(parts)
  fs.mkdirSync(path.dirname(OUT_BIN), { recursive: true })
  fs.writeFileSync(OUT_BIN, buf)
  fs.writeFileSync(OUT_HEX, buf.toString('hex'))

  console.log(`✅ Verifying key exported`)
  console.log(`   Binary : ${OUT_BIN} (${buf.length} bytes)`)
  console.log(`   Hex    : ${OUT_HEX}`)
  console.log(`   IC count (public signals + 1): ${vk.IC.length}`)
  console.log('\n📋 Set in deploy.js or pass directly to initialize():')
  console.log(`   ${buf.toString('hex').slice(0, 64)}...`)
}

main()
