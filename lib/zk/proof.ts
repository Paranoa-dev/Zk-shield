/**
 * ZK Proof Generation — runs entirely in the browser
 *
 * Uses snarkjs (Groth16) + Poseidon hash (circomlibjs)
 * Circuit: circuits/commitment.circom
 *
 * Flow:
 *  1. deposit()   → generate secret + commitment (Poseidon hash)
 *  2. transfer()  → generate inclusion proof + nullifier + ZK proof
 *  3. withdraw()  → same as transfer, different output address
 */

import { buildPoseidon } from 'circomlibjs'

// snarkjs is loaded dynamically to avoid SSR issues
type SnarkJS = typeof import('snarkjs')
let snarkjs: SnarkJS | null = null

async function getSnarkJS(): Promise<SnarkJS> {
  if (snarkjs) return snarkjs
  snarkjs = await import('snarkjs')
  return snarkjs
}

// ─── Poseidon ─────────────────────────────────────────────────────────────────

let poseidon: Awaited<ReturnType<typeof buildPoseidon>> | null = null

async function getPoseidon() {
  if (poseidon) return poseidon
  poseidon = await buildPoseidon()
  return poseidon
}

/** Poseidon hash of one or two field elements → BigInt */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const h = await getPoseidon()
  const result = h(inputs)
  return h.F.toObject(result)
}

// ─── Secret generation ────────────────────────────────────────────────────────

/** Generate a cryptographically random 31-byte secret (fits in BN254 scalar field) */
export function generateSecret(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(31))
  return bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n)
}

// ─── Commitment ───────────────────────────────────────────────────────────────

export interface Commitment {
  /** Random secret — never shared, stored locally by user */
  secret: bigint
  /** Amount in stroops (1 XLM = 10_000_000 stroops) */
  amount: bigint
  /** Poseidon(secret, amount) — stored on-chain in the Merkle tree */
  commitment: bigint
  /** Poseidon(secret) — revealed only when spending to prevent double-spend */
  nullifier: bigint
}

export async function createCommitment(amountXlm: number): Promise<Commitment> {
  const secret     = generateSecret()
  const amount     = BigInt(Math.round(amountXlm * 10_000_000)) // convert to stroops
  const commitment = await poseidonHash([secret, amount])
  const nullifier  = await poseidonHash([secret])

  return { secret, amount, commitment, nullifier }
}

// ─── ZK Proof ─────────────────────────────────────────────────────────────────

export interface ProofInputs {
  /** The secret (private) */
  secret: string
  /** The amount in stroops (private) */
  amount: string
  /** The Merkle path siblings (private) */
  pathElements: string[]
  /** Left/right indicators along the Merkle path (public) */
  pathIndices: number[]
  /** The on-chain Merkle root (public) */
  root: string
  /** The nullifier (public — revealed to prevent double-spend) */
  nullifier: string
}

export interface ZKProof {
  proof: {
    pi_a: string[]
    pi_b: string[][]
    pi_c: string[]
  }
  publicSignals: string[]
}

/**
 * Generate a Groth16 proof.
 * The circuit WASM + zkey files must be in /public/circuits/
 */
export async function generateProof(inputs: ProofInputs): Promise<ZKProof> {
  const sjs = await getSnarkJS()

  const { proof, publicSignals } = await sjs.groth16.fullProve(
    inputs,
    '/circuits/commitment.wasm',  // compiled circuit witness generator
    '/circuits/commitment.zkey',  // proving key (from trusted setup)
  )

  return { proof: proof as ZKProof['proof'], publicSignals }
}

/**
 * Verify a proof locally (for dev/testing).
 * In production the Soroban contract verifies on-chain.
 */
export async function verifyProof(
  proof: ZKProof['proof'],
  publicSignals: string[],
): Promise<boolean> {
  const sjs = await getSnarkJS()
  const vkey = await fetch('/circuits/verification_key.json').then((r) => r.json())
  return sjs.groth16.verify(vkey, publicSignals, proof)
}

// ─── Serialise for Soroban ────────────────────────────────────────────────────

/**
 * Convert a snarkjs proof into the byte array format expected by our
 * Soroban contract's verify() entry point.
 *
 * Soroban contract expects:
 *   [pi_a_x (32 bytes), pi_a_y (32 bytes),
 *    pi_b_x0, pi_b_x1, pi_b_y0, pi_b_y1 (32 bytes each),
 *    pi_c_x, pi_c_y (32 bytes each)]  → 256 bytes total
 */
export function serializeProofForSoroban(proof: ZKProof['proof']): Uint8Array {
  const buf = new Uint8Array(256)
  let offset = 0

  function writePoint(coords: string[]) {
    for (const coord of coords) {
      const hex = BigInt(coord).toString(16).padStart(64, '0')
      const bytes = hexToBytes(hex)
      buf.set(bytes, offset)
      offset += 32
    }
  }

  writePoint(proof.pi_a)
  writePoint(proof.pi_b.flat())
  writePoint(proof.pi_c)

  return buf
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// ─── Local note storage ───────────────────────────────────────────────────────
// "Notes" = unspent commitments the user has deposited.
// Stored encrypted in localStorage (MVP: plaintext, TODO: encrypt with wallet pubkey).

export interface Note {
  id: string
  commitment: string
  nullifier: string
  secret: string
  amount: string   // in stroops
  leafIndex: number
  spent: boolean
  createdAt: number
}

const STORAGE_KEY = 'zk-shield-notes'

export function saveNote(note: Note): void {
  const notes = loadNotes()
  notes.push(note)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function markNoteSpent(nullifier: string): void {
  const notes = loadNotes()
  const idx   = notes.findIndex((n) => n.nullifier === nullifier)
  if (idx !== -1) {
    notes[idx].spent = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }
}
