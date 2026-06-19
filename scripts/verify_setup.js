#!/usr/bin/env node
/**
 * scripts/verify_setup.js
 *
 * Pre-flight check — verifies that the local environment is ready to run
 * ZK Shield. Run before `npm run dev` or `npm run deploy:contract`.
 *
 * Usage:
 *   node scripts/verify_setup.js
 */

const fs   = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
let ok = true

function pass(msg)  { console.log(`  ✅  ${msg}`) }
function fail(msg)  { console.error(`  ❌  ${msg}`); ok = false }
function warn(msg)  { console.warn (`  ⚠️   ${msg}`) }
function header(h)  { console.log(`\n${h}`) }

function cmd(command) {
  try { return execSync(command, { stdio: 'pipe' }).toString().trim() }
  catch { return null }
}

function semver(str) {
  const m = str?.match(/(\d+)\.(\d+)/)
  return m ? [parseInt(m[1]), parseInt(m[2])] : [0, 0]
}

// ── Node.js ───────────────────────────────────────────────────────────────────
header('Node.js')
const nodeVer = cmd('node --version')
const [nodeMaj] = semver(nodeVer)
if (nodeMaj >= 18) pass(`node ${nodeVer}`)
else               fail(`node >= 18 required (found ${nodeVer ?? 'not found'})`)

// ── npm packages ──────────────────────────────────────────────────────────────
header('npm packages')
if (fs.existsSync(path.join(ROOT, 'node_modules')))
  pass('node_modules present')
else
  fail('Run `npm install` first')

// ── Rust / Cargo ──────────────────────────────────────────────────────────────
header('Rust')
const rustVer = cmd('rustc --version')
if (rustVer) pass(rustVer)
else         fail('rustc not found — install from https://rustup.rs')

const wasm = cmd('rustup target list --installed')
if (wasm?.includes('wasm32-unknown-unknown')) pass('wasm32-unknown-unknown target installed')
else warn('wasm32-unknown-unknown not installed — run: rustup target add wasm32-unknown-unknown')

// ── Stellar CLI ───────────────────────────────────────────────────────────────
header('Stellar CLI')
const stellarVer = cmd('stellar --version')
if (stellarVer) pass(`stellar ${stellarVer}`)
else            warn('stellar CLI not found — install: cargo install --locked stellar-cli')

// ── Circom ────────────────────────────────────────────────────────────────────
header('Circom')
const circomVer = cmd('circom --version')
if (circomVer) pass(`circom ${circomVer}`)
else           warn('circom not found — install: npm install -g circom')

// ── Circuit artifacts ─────────────────────────────────────────────────────────
header('Circuit artifacts (public/circuits/)')
const circuits = path.join(ROOT, 'public', 'circuits')
const wasmFile = path.join(circuits, 'commitment.wasm')
const zkeyFile = path.join(circuits, 'commitment.zkey')
const vkeyFile = path.join(circuits, 'verification_key.json')

const wasmStat = fs.existsSync(wasmFile) && fs.statSync(wasmFile).size > 0
const zkeyStat = fs.existsSync(zkeyFile) && fs.statSync(zkeyFile).size > 0

wasmStat ? pass('commitment.wasm present') : warn('commitment.wasm missing — run: npm run setup:trusted')
zkeyStat ? pass('commitment.zkey present') : warn('commitment.zkey missing — run: npm run setup:trusted')
fs.existsSync(vkeyFile) ? pass('verification_key.json present') : warn('verification_key.json missing')

// ── .env.local ────────────────────────────────────────────────────────────────
header('.env.local')
const envFile = path.join(ROOT, '.env.local')
if (fs.existsSync(envFile)) {
  const env = fs.readFileSync(envFile, 'utf8')
  const contractId = env.match(/NEXT_PUBLIC_CONTRACT_ID=(.+)/)?.[1]?.trim()
  const placeholder = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM'
  if (contractId && contractId !== placeholder)
    pass(`NEXT_PUBLIC_CONTRACT_ID set (${contractId.slice(0, 8)}…)`)
  else
    warn('NEXT_PUBLIC_CONTRACT_ID not set — deploy contract and update .env.local')
} else {
  warn('.env.local missing — copy .env.local.example and fill in your contract ID')
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('')
if (ok) {
  console.log('✅  All checks passed — ready to run `npm run dev`\n')
  process.exit(0)
} else {
  console.error('❌  Some checks failed — fix the issues above before continuing\n')
  process.exit(1)
}
