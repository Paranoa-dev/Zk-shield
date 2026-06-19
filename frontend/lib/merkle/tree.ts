/**
 * Incremental Merkle Tree
 *
 * Matches the Soroban contract's Merkle tree exactly.
 * Depth: 20 (supports up to 2^20 = 1,048,576 deposits)
 * Hash:  Poseidon (ZK-friendly, same as circuit)
 * Zero:  Poseidon(0, 0) filled for empty leaves
 *
 * Reference: Tornado Cash MerkleTreeWithHistory.sol
 */

import { poseidonHash } from '@/lib/zk/proof'

export const TREE_DEPTH = 20

// Pre-computed zero values: zeros[i] = Poseidon(zeros[i-1], zeros[i-1])
// zeros[0] = Poseidon(0) for empty leaves
// These are constants — we compute them once at init
const ZEROS: bigint[] = []
let zerosInitialised = false

export async function initZeros(): Promise<void> {
  if (zerosInitialised) return
  ZEROS[0] = await poseidonHash([0n])
  for (let i = 1; i <= TREE_DEPTH; i++) {
    ZEROS[i] = await poseidonHash([ZEROS[i - 1], ZEROS[i - 1]])
  }
  zerosInitialised = true
}

// ─── Tree ────────────────────────────────────────────────────────────────────

export class MerkleTree {
  private layers: bigint[][]
  private nextIndex: number

  constructor() {
    // Each layer holds the current filled + zero-padded values
    this.layers = Array.from({ length: TREE_DEPTH + 1 }, () => [])
    this.nextIndex = 0
  }

  get root(): bigint {
    if (this.layers[TREE_DEPTH].length === 0) {
      return ZEROS[TREE_DEPTH]
    }
    return this.layers[TREE_DEPTH][0]
  }

  get size(): number {
    return this.nextIndex
  }

  /** Insert a leaf commitment and return its index */
  async insert(leaf: bigint): Promise<number> {
    await initZeros()
    if (this.nextIndex >= 2 ** TREE_DEPTH) {
      throw new Error('Merkle tree is full')
    }

    let currentIndex = this.nextIndex
    let currentLevelHash = leaf

    for (let i = 0; i < TREE_DEPTH; i++) {
      // Fill this layer's slot
      if (!this.layers[i]) this.layers[i] = []
      this.layers[i][currentIndex] = currentLevelHash

      let left: bigint, right: bigint
      if (currentIndex % 2 === 0) {
        // We are a left child → right sibling is a zero
        left = currentLevelHash
        right = ZEROS[i]
      } else {
        // We are a right child → left sibling is the node we filled earlier
        left = this.layers[i][currentIndex - 1]
        right = currentLevelHash
      }

      currentLevelHash = await poseidonHash([left, right])
      currentIndex = Math.floor(currentIndex / 2)
    }

    this.layers[TREE_DEPTH][0] = currentLevelHash
    const insertedIndex = this.nextIndex
    this.nextIndex++
    return insertedIndex
  }

  /**
   * Generate a Merkle proof for the leaf at `index`.
   * Returns the sibling hashes and left/right indicators needed by the ZK circuit.
   */
  async getProof(index: number): Promise<{
    pathElements: bigint[]
    pathIndices: number[]
    root: bigint
  }> {
    await initZeros()
    if (index >= this.nextIndex) {
      throw new Error(`Leaf at index ${index} has not been inserted`)
    }

    const pathElements: bigint[] = []
    const pathIndices: number[]  = []

    let currentIndex = index

    for (let i = 0; i < TREE_DEPTH; i++) {
      const isLeft = currentIndex % 2 === 0
      pathIndices.push(isLeft ? 0 : 1)

      const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1
      const sibling = this.layers[i]?.[siblingIndex] ?? ZEROS[i]
      pathElements.push(sibling)

      currentIndex = Math.floor(currentIndex / 2)
    }

    return { pathElements, pathIndices, root: this.root }
  }

  /** Serialise to plain JSON for storage */
  toJSON() {
    return {
      layers: this.layers.map((l) => l.map(String)),
      nextIndex: this.nextIndex,
    }
  }

  /** Restore from JSON */
  static fromJSON(data: ReturnType<MerkleTree['toJSON']>): MerkleTree {
    const tree = new MerkleTree()
    tree.layers = data.layers.map((l: string[]) => l.map(BigInt))
    tree.nextIndex = data.nextIndex
    return tree
  }
}

// ─── Singleton tree (synced from chain) ───────────────────────────────────────
// In a real deployment we'd fetch all past Deposit events from Soroban
// and reconstruct the tree. For now we cache in sessionStorage.

const TREE_STORAGE_KEY = 'zk-shield-tree'

export function loadTree(): MerkleTree {
  try {
    const raw = sessionStorage.getItem(TREE_STORAGE_KEY)
    if (raw) return MerkleTree.fromJSON(JSON.parse(raw))
  } catch { /* ignore */ }
  return new MerkleTree()
}

export function saveTree(tree: MerkleTree): void {
  sessionStorage.setItem(TREE_STORAGE_KEY, JSON.stringify(tree.toJSON()))
}
