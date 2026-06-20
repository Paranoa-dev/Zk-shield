/**
 * lib/zk/notes.ts
 *
 * Note storage — manages the user's unspent commitments in localStorage.
 *
 * A "note" is everything needed to spend a deposit:
 *   - secret    : the random value used to create the commitment
 *   - nullifier : Poseidon(secret) — revealed when spending
 *   - commitment: Poseidon(secret, amount) — the on-chain leaf
 *   - leafIndex : position in the Merkle tree
 *   - amount    : in stroops
 *
 * Notes are currently stored in plaintext. A future improvement is to
 * encrypt them with the user's Freighter public key before persisting.
 * See: https://github.com/Paranoa-dev/Zk-shield/issues (label: enhancement)
 */

export interface Note {
  id: string
  commitment: string
  nullifier: string
  secret: string
  /** Amount in stroops (1 XLM = 10_000_000 stroops) */
  amount: string
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
    return raw ? (JSON.parse(raw) as Note[]) : []
  } catch {
    return []
  }
}

export function markNoteSpent(nullifier: string): void {
  const notes = loadNotes()
  const idx = notes.findIndex((n) => n.nullifier === nullifier)
  if (idx !== -1) {
    notes[idx].spent = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }
}

export function deleteNote(id: string): void {
  const notes = loadNotes().filter((n) => n.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

export function unspentNotes(): Note[] {
  return loadNotes().filter((n) => !n.spent)
}

export function exportNotes(): string {
  return JSON.stringify(loadNotes(), null, 2)
}

export function importNotes(json: string): { imported: number; skipped: number } {
  let incoming: Note[]
  try {
    incoming = JSON.parse(json) as Note[]
    if (!Array.isArray(incoming)) throw new Error('not an array')
  } catch {
    throw new Error('Invalid note file — expected a JSON array')
  }

  const existing = loadNotes()
  const existingIds = new Set(existing.map((n) => n.id))

  let imported = 0
  let skipped = 0
  for (const note of incoming) {
    if (existingIds.has(note.id)) { skipped++; continue }
    existing.push(note)
    imported++
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  return { imported, skipped }
}
