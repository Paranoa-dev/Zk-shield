'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet }   from '@/components/wallet/WalletProvider'
import { useTreeSync } from '@/hooks/useTreeSync'
import { NoteBackup }  from '@/components/ui/NoteBackup'
import { StatsSkeleton, NoteListSkeleton } from '@/components/ui/Skeleton'
import { loadNotes, type Note } from '@/lib/zk/proof'
import { getXlmBalance }        from '@/lib/stellar/contract'

export default function DashboardPage() {
  const { connected, publicKey, connect } = useWallet()
  const { syncing, synced, leafCount, root, error: syncError, resync } = useTreeSync()

  const [notes,      setNotes]      = useState<Note[]>([])
  const [xlmBalance, setXlmBalance] = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!publicKey) return
    setLoading(true)
    setNotes(loadNotes())
    getXlmBalance(publicKey)
      .then(setXlmBalance)
      .finally(() => setLoading(false))
  }, [publicKey, synced])   // re-load notes after tree sync completes

  const unspent       = notes.filter((n) => !n.spent)
  const spent         = notes.filter((n) =>  n.spent)
  const totalPrivate  = unspent.reduce((acc, n) => acc + Number(n.amount), 0) / 10_000_000

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h1 className="text-2xl font-bold text-shield-dark mb-2">Connect your wallet</h1>
        <p className="text-shield-mid mb-6">Connect Freighter to view your notes and balances.</p>
        <button onClick={connect} className="btn-primary">Connect Freighter</button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-shield-dark mb-1">Dashboard</h1>
          <p className="text-sm font-mono text-shield-mid">
            {publicKey?.slice(0, 8)}…{publicKey?.slice(-8)}
          </p>
        </div>
        <button
          onClick={resync}
          disabled={syncing}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          <span className={syncing ? 'animate-spin' : ''}>⟳</span>
          {syncing ? 'Syncing…' : 'Sync tree'}
        </button>
      </div>

      {/* Sync status bar */}
      {(syncing || syncError) && (
        <div className={`mb-5 flex items-center gap-2 text-xs rounded-xl px-4 py-2.5 ${
          syncError ? 'bg-amber-50 text-amber-800' : 'bg-shield-light text-shield-mid'
        }`}>
          {syncing && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
          {syncing && `Syncing Merkle tree from chain… (${leafCount} deposits)`}
          {syncError && `⚠️ Sync error: ${syncError} — using cached tree`}
        </div>
      )}

      {/* Stats */}
      {loading ? <StatsSkeleton /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Public balance',  value: xlmBalance != null ? `${parseFloat(xlmBalance).toFixed(2)} XLM` : '…', color: 'text-shield-dark' },
            { label: 'Private balance', value: `${totalPrivate.toFixed(2)} XLM`,   color: 'text-shield-teal'   },
            { label: 'Unspent notes',   value: String(unspent.length),              color: 'text-shield-purple' },
            { label: 'Pool deposits',   value: String(leafCount),                   color: 'text-shield-mid'    },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-5">
              <div className="text-xs text-shield-mid mb-1">{label}</div>
              <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Link href="/deposit"  className="btn-primary text-center text-sm py-3">+ Deposit</Link>
        <Link href="/transfer" className="btn-ghost   text-center text-sm py-3">→ Transfer</Link>
        <Link href="/withdraw" className="btn-ghost   text-center text-sm py-3">↓ Withdraw</Link>
      </div>

      {/* Note backup warning */}
      {unspent.length > 0 && (
        <div className="mb-6">
          <NoteBackup />
        </div>
      )}

      {/* Notes table */}
      {loading ? <NoteListSkeleton rows={3} /> : (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-shield-dark">Your notes</h2>
            <span className="text-xs text-shield-mid">Stored locally in this browser</span>
          </div>
          {notes.length === 0 ? (
            <div className="py-16 text-center text-shield-mid">
              <div className="text-4xl mb-3">🔑</div>
              <div className="font-medium mb-1">No notes yet</div>
              <div className="text-sm mb-4">Deposit XLM to create your first private note.</div>
              <Link href="/deposit" className="btn-primary text-sm">Deposit now →</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notes.map((note) => (
                <div key={note.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${note.spent ? 'bg-gray-300' : 'bg-emerald-500'}`} />
                    <div>
                      <div className="font-mono text-sm font-medium text-shield-dark">
                        {(Number(note.amount) / 10_000_000).toFixed(2)} XLM
                      </div>
                      <div className="text-xs text-shield-mid">
                        Leaf #{note.leafIndex} · {new Date(note.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={note.spent ? 'badge badge-gray' : 'badge badge-green'}>
                      {note.spent ? 'spent' : 'unspent'}
                    </span>
                    {!note.spent && (
                      <Link href="/withdraw" className="text-xs text-shield-teal underline">Withdraw</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Merkle root info */}
      {synced && (
        <div className="mt-6 card p-5 flex flex-col gap-1">
          <div className="text-xs font-medium text-shield-mid">On-chain Merkle root</div>
          <div className="font-mono text-xs text-shield-dark break-all">{root || '—'}</div>
          <div className="text-xs text-shield-mid">{leafCount} total deposits in the pool</div>
        </div>
      )}

      {/* Privacy tip */}
      <div className="mt-6 bg-shield-dark text-white rounded-2xl p-6 text-sm">
        <div className="font-semibold mb-2">🛡️ Your privacy is local</div>
        <p className="text-gray-400 leading-relaxed">
          Notes (secrets + nullifiers) are stored only in this browser. Back them up before clearing storage or switching devices. The on-chain Merkle tree cannot recover a lost secret.
        </p>
      </div>
    </div>
  )
}
