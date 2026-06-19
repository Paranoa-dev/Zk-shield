'use client'

import { useState } from 'react'
import { saveNote, type Note } from '@/lib/zk/proof'

interface Props {
  onImported?: (note: Note) => void
}

/**
 * Paste-import for notes received from a transfer sender.
 * In a full product this would be encrypted + delivered in-app.
 * For the hackathon: copy-paste the JSON from the console.
 */
export function NoteImporter({ onImported }: Props) {
  const [open,  setOpen]  = useState(false)
  const [raw,   setRaw]   = useState('')
  const [error, setError] = useState('')
  const [done,  setDone]  = useState(false)

  function handleImport() {
    setError('')
    try {
      const note = JSON.parse(raw.trim()) as Note
      // Basic validation
      if (!note.secret || !note.nullifier || !note.commitment || !note.amount) {
        throw new Error('Invalid note: missing required fields')
      }
      saveNote({ ...note, spent: false, createdAt: note.createdAt ?? Date.now() })
      setDone(true)
      onImported?.(note)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost text-sm w-full"
      >
        + Import note from sender
      </button>
    )
  }

  if (done) {
    return (
      <div className="bg-shield-teal-lt rounded-xl p-4 text-sm text-shield-teal text-center">
        ✅ Note imported successfully — it will appear in your note list.
      </div>
    )
  }

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="font-medium text-shield-dark text-sm">Import a note</div>
      <p className="text-xs text-shield-mid leading-relaxed">
        Paste the JSON note your sender shared with you. It contains the secret
        needed to prove ownership and withdraw.
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={'{\n  "secret": "...",\n  "nullifier": "...",\n  ...\n}'}
        rows={6}
        className="input font-mono text-xs resize-none"
      />
      {error && (
        <div className="text-xs text-shield-coral bg-shield-coral-lt rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost flex-1 text-sm">
          Cancel
        </button>
        <button onClick={handleImport} disabled={!raw.trim()} className="btn-primary flex-1 text-sm">
          Import note
        </button>
      </div>
    </div>
  )
}
