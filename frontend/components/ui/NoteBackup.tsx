'use client'

import { useState } from 'react'
import { loadNotes, type Note } from '@/lib/zk/proof'

/**
 * NoteBackup — lets users export all their notes as a JSON file.
 * Critical for the hackathon demo: if a judge clears browser storage,
 * they'd lose their notes. This makes the risk visible and manageable.
 */
export function NoteBackup() {
  const [expanded, setExpanded] = useState(false)
  const [copied,   setCopied]   = useState(false)

  const notes  = loadNotes()
  const unspent = notes.filter((n) => !n.spent)

  function downloadBackup() {
    const data = JSON.stringify({ version: 1, exportedAt: Date.now(), notes }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `zk-shield-notes-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyToClipboard() {
    const data = JSON.stringify({ version: 1, exportedAt: Date.now(), notes }, null, 2)
    await navigator.clipboard.writeText(data)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (unspent.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-amber-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🔑</span>
          <div>
            <div className="font-semibold text-amber-900 text-sm">Back up your notes</div>
            <div className="text-xs text-amber-700">
              {unspent.length} unspent {unspent.length === 1 ? 'note' : 'notes'} stored in this browser only
            </div>
          </div>
        </div>
        <span className={`text-amber-700 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-amber-200">
          <p className="text-xs text-amber-800 leading-relaxed pt-3">
            Your notes contain the secrets needed to spend your private funds.
            They are stored only in <strong>this browser</strong>. Clear browser
            storage, switch devices, or use a different browser and they are gone.
            Back them up somewhere safe.
          </p>

          {/* Note summary */}
          <div className="flex flex-col gap-1.5">
            {unspent.map((note) => (
              <div key={note.id} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 text-xs">
                <span className="font-mono text-shield-dark font-medium">
                  {(Number(note.amount) / 10_000_000).toFixed(2)} XLM
                </span>
                <span className="text-shield-mid">Leaf #{note.leafIndex}</span>
                <span className="text-amber-700 font-medium">unspent</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={downloadBackup}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-800 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-amber-900 transition-colors"
            >
              ↓ Download JSON
            </button>
            <button
              onClick={copyToClipboard}
              className="flex-1 flex items-center justify-center gap-2 border border-amber-300 text-amber-900 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              {copied ? '✓ Copied!' : '⎘ Copy all'}
            </button>
          </div>

          <p className="text-xs text-amber-700 text-center">
            Store in a password manager, encrypted file, or cold storage.
          </p>
        </div>
      )}
    </div>
  )
}
