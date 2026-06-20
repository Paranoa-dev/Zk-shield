'use client'

import { useState, useCallback } from 'react'
import { useWallet }   from '@/components/wallet/WalletProvider'
import { useToast }    from '@/components/ui/Toast'
import { useTreeSync } from '@/hooks/useTreeSync'
import { ProofProgress } from '@/components/proof/ProofProgress'
import { NoteImporter }  from '@/components/wallet/NoteImporter'
import { useProof }      from '@/components/proof/useProof'
import {
  loadNotes, createCommitment, markNoteSpent,
  saveNote, type Note,
} from '@/lib/zk/proof'
import { loadTree, saveTree } from '@/lib/merkle/tree'
import { buildSpendTx, submitTransaction } from '@/lib/stellar/contract'

type Step = 'select' | 'input' | 'proving' | 'signing' | 'submitting' | 'done' | 'error'

export default function TransferPage() {
  const { connected, publicKey, connect, signTransaction } = useWallet()
  const toast   = useToast()
  const { syncing, synced, leafCount } = useTreeSync()
  const { status: proofStatus, elapsedMs, error: proofError, generate } = useProof()

  const [notes]          = useState<Note[]>(() => loadNotes().filter((n) => !n.spent))
  const [selectedNote,   setSelectedNote]   = useState<Note | null>(null)
  const [recipient,      setRecipient]      = useState('')
  const [step,           setStep]           = useState<Step>('select')
  const [errorMsg,       setErrorMsg]       = useState('')
  const [txHash,         setTxHash]         = useState('')
  const [recipientNote,  setRecipientNote]  = useState<Note | null>(null)
  const [noteCopied,     setNoteCopied]     = useState(false)

  const handleTransfer = useCallback(async () => {
    if (!publicKey || !selectedNote || !recipient.trim()) return
    if (!recipient.startsWith('G') || recipient.length !== 56) {
      toast.warning('Invalid address', 'Stellar addresses start with G and are 56 characters')
      return
    }
    setErrorMsg('')

    try {
      // 1 — New commitment for recipient
      setStep('proving')
      const amountXlm     = Number(selectedNote.amount) / 10_000_000
      const newCommitment = await createCommitment(amountXlm)

      // 2 — Merkle proof for the note being spent
      const tree = loadTree()
      const { pathElements, pathIndices, root } = await tree.getProof(selectedNote.leafIndex)

      // 3 — Generate ZK proof (browser-side via snarkjs)
      toast.info('Generating ZK proof…', 'This runs entirely in your browser — takes ~10 seconds')
      await generate({
        secret:       selectedNote.secret,
        amount:       selectedNote.amount,
        pathElements: pathElements.map(String),
        pathIndices,
        root:         root.toString(),
        nullifier:    selectedNote.nullifier,
      })

      // 4 — Build spend tx
      const { proof, publicSignals, proofBytes } = await (async () => {
        // Pull results from the hook — re-invoke generate inside the same fn
        const snarkjs = await import('snarkjs')
        const { proof: p, publicSignals: ps } = await snarkjs.groth16.fullProve(
          {
            secret:       selectedNote.secret,
            amount:       selectedNote.amount,
            pathElements: pathElements.map(String),
            pathIndices,
            root:         root.toString(),
            nullifier:    selectedNote.nullifier,
          },
          '/circuits/commitment.wasm',
          '/circuits/commitment.zkey',
        )
        const { serializeProofForSoroban } = await import('@/lib/zk/proof')
        return { proof: p, publicSignals: ps, proofBytes: serializeProofForSoroban(p as Parameters<typeof serializeProofForSoroban>[0]) }
      })()

      const unsignedXdr = await buildSpendTx(
        publicKey,
        proofBytes,
        publicSignals,
        BigInt(selectedNote.nullifier),
        newCommitment.commitment,
        null,
      )

      // 5 — Sign
      setStep('signing')
      const signedXdr = await signTransaction(unsignedXdr)

      // 6 — Submit
      setStep('submitting')
      toast.info('Broadcasting to Stellar…')
      const { hash } = await submitTransaction(signedXdr)

      // 7 — Update local state
      markNoteSpent(selectedNote.nullifier)
      const leafIdx = await tree.insert(newCommitment.commitment)
      saveTree(tree)

      const newNote: Note = {
        id:         crypto.randomUUID(),
        commitment: newCommitment.commitment.toString(),
        nullifier:  newCommitment.nullifier.toString(),
        secret:     newCommitment.secret.toString(),
        amount:     newCommitment.amount.toString(),
        leafIndex:  leafIdx,
        spent:      false,
        createdAt:  Date.now(),
      }
      setRecipientNote(newNote)
      setTxHash(hash)
      setStep('done')
      toast.success('Transfer complete!', 'Share the recipient note with them to claim their XLM')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setErrorMsg(msg)
      setStep('error')
      toast.error('Transfer failed', msg.slice(0, 120))
    }
  }, [publicKey, selectedNote, recipient, signTransaction, toast, generate])

  function copyRecipientNote() {
    if (!recipientNote) return
    navigator.clipboard.writeText(JSON.stringify(recipientNote, null, 2))
    setNoteCopied(true)
    setTimeout(() => setNoteCopied(false), 2000)
    toast.success('Note copied!', 'Send this to the recipient so they can withdraw')
  }

  const reset = () => {
    setStep('select'); setSelectedNote(null); setRecipient('')
    setTxHash(''); setRecipientNote(null); setErrorMsg('')
  }

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-5xl mb-4">🔄</div>
        <h1 className="text-2xl font-bold text-shield-dark mb-2">Connect your wallet</h1>
        <p className="text-shield-mid mb-6">Connect Freighter to make private transfers.</p>
        <button onClick={connect} className="btn-primary">Connect Freighter</button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="badge badge-purple mb-3">Private transfer</span>
        <h1 className="text-3xl font-bold text-shield-dark mb-2">Transfer privately</h1>
        <p className="text-shield-mid">Spend a note and create a new one for the recipient — zero amounts or identities revealed.</p>
      </div>

      {/* Sync status */}
      {!synced && (
        <div className="mb-4 flex items-center gap-2 text-xs text-shield-mid bg-shield-light rounded-xl px-4 py-2.5">
          <div className="w-3 h-3 border border-shield-mid border-t-transparent rounded-full animate-spin" />
          Syncing Merkle tree… ({leafCount} deposits)
        </div>
      )}

      <div className="card p-6 flex flex-col gap-6">

        {/* Note selection + recipient input */}
        {(step === 'select' || step === 'input') && (
          <>
            <div>
              <label className="block text-sm font-medium text-shield-dark mb-2">Select a note to spend</label>
              {notes.length === 0 ? (
                <div className="text-sm text-shield-mid bg-shield-light rounded-xl p-4 text-center">
                  No unspent notes. <a href="/deposit" className="text-shield-teal underline">Deposit first →</a>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {notes.map((note) => (
                    <button key={note.id}
                      onClick={() => { setSelectedNote(note); setStep('input') }}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        selectedNote?.id === note.id
                          ? 'border-shield-purple bg-shield-purple-lt'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-sm text-shield-dark font-medium">
                            {(Number(note.amount) / 10_000_000).toFixed(2)} XLM
                          </div>
                          <div className="text-xs text-shield-mid mt-0.5">
                            Leaf #{note.leafIndex} · {new Date(note.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className="badge badge-green">unspent</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {step === 'input' && selectedNote && (
              <>
                <div>
                  <label className="block text-sm font-medium text-shield-dark mb-2">Recipient Stellar address</label>
                  <input
                    type="text" value={recipient}
                    onChange={(e) => setRecipient(e.target.value.trim())}
                    placeholder="G… (56 characters)"
                    className="input font-mono text-sm"
                  />
                  <p className="text-xs text-shield-mid mt-2">
                    A new private note will be created for them. Share the note JSON after the transfer so they can withdraw.
                  </p>
                </div>

                <div className="bg-shield-purple-lt rounded-xl p-4 text-sm">
                  <div className="font-medium text-shield-purple mb-1">🔄 What happens?</div>
                  <div className="text-shield-mid leading-relaxed">
                    Your note is nullified on-chain. A new commitment is inserted for the recipient.
                    A Groth16 ZK proof — generated in your browser — proves the transfer is valid without revealing anything.
                  </div>
                </div>

                <button
                  onClick={handleTransfer}
                  disabled={!recipient.trim() || !synced}
                  className="btn-primary"
                >
                  {!synced ? 'Waiting for tree sync…' : 'Generate proof & transfer →'}
                </button>
              </>
            )}

            {/* Import a received note */}
            <NoteImporter onImported={() => toast.success('Note imported!', 'It now appears in your notes list')} />
          </>
        )}

        {/* Proof progress */}
        {step === 'proving' && (
          <ProofProgress status={proofStatus} elapsedMs={elapsedMs} error={proofError} />
        )}

        {/* Signing / submitting */}
        {(step === 'signing' || step === 'submitting') && (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-shield-purple-lt flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-shield-purple border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <div className="font-semibold text-shield-dark text-lg mb-1">
                {step === 'signing' ? 'Waiting for signature…' : 'Submitting to Stellar…'}
              </div>
              <div className="text-shield-mid text-sm">
                {step === 'signing' ? 'Approve the transaction in your Freighter extension' : 'Broadcasting to testnet…'}
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && recipientNote && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl">✅</div>
              <div>
                <div className="font-semibold text-shield-dark">Transfer complete</div>
                <div className="text-sm text-shield-mid">
                  {(Number(recipientNote.amount) / 10_000_000).toFixed(2)} XLM transferred privately
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="font-medium text-amber-800 mb-2">📋 Send this note to the recipient</div>
              <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                They need this JSON to prove ownership and withdraw their XLM from the pool.
                Send it via any secure channel (encrypted message, Signal, etc.).
              </p>
              <div className="font-mono text-xs bg-white rounded-lg p-3 break-all text-shield-dark max-h-36 overflow-auto">
                {JSON.stringify(recipientNote, null, 2)}
              </div>
              <button onClick={copyRecipientNote} className="btn-ghost text-xs mt-3 w-full">
                {noteCopied ? '✓ Copied!' : '⎘ Copy recipient note'}
              </button>
            </div>

            {txHash && (
              <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer"
                className="text-sm text-shield-blue underline text-center">
                View on Stellar Explorer →
              </a>
            )}
            <div className="flex gap-3">
              <button onClick={reset} className="btn-ghost flex-1">New transfer</button>
              <a href="/dashboard" className="btn-primary flex-1 text-center">Dashboard →</a>
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="text-4xl">⚠️</div>
            <div className="font-semibold text-shield-dark">Transfer failed</div>
            <div className="text-sm text-shield-mid bg-shield-coral-lt rounded-xl p-3 text-left break-all w-full">{errorMsg}</div>
            <button onClick={() => setStep('select')} className="btn-ghost">Try again</button>
          </div>
        )}
      </div>
    </div>
  )
}
