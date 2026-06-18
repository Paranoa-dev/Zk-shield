'use client'

import { useState, useCallback } from 'react'
import { useWallet }   from '@/components/wallet/WalletProvider'
import { useToast }    from '@/components/ui/Toast'
import { useTreeSync } from '@/hooks/useTreeSync'
import { ProofProgress } from '@/components/proof/ProofProgress'
import { NoteImporter }  from '@/components/wallet/NoteImporter'
import {
  loadNotes, serializeProofForSoroban, markNoteSpent, type Note,
} from '@/lib/zk/proof'
import { loadTree }    from '@/lib/merkle/tree'
import { buildSpendTx, submitTransaction } from '@/lib/stellar/contract'

type Step = 'select' | 'input' | 'proving' | 'signing' | 'submitting' | 'done' | 'error'

export default function WithdrawPage() {
  const { connected, publicKey, connect, signTransaction } = useWallet()
  const toast  = useToast()
  const { synced, leafCount } = useTreeSync()

  const [notes]        = useState<Note[]>(() => loadNotes().filter((n) => !n.spent))
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [toAddress,    setToAddress]    = useState('')
  const [step,         setStep]         = useState<Step>('select')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [txHash,       setTxHash]       = useState('')
  const [proofStatus,  setProofStatus]  = useState<'idle'|'generating'|'done'|'error'>('idle')
  const [proofElapsed, setProofElapsed] = useState(0)

  const handleWithdraw = useCallback(async () => {
    if (!publicKey || !selectedNote || !toAddress.trim()) return
    if (!toAddress.startsWith('G') || toAddress.length !== 56) {
      toast.warning('Invalid address', 'Stellar addresses start with G and are 56 characters')
      return
    }
    setErrorMsg('')

    try {
      // 1 — Build Merkle proof
      setStep('proving')
      setProofStatus('generating')
      const tree = loadTree()
      const { pathElements, pathIndices, root } = await tree.getProof(selectedNote.leafIndex)

      // 2 — Generate ZK proof
      toast.info('Generating ZK proof…', 'Proving ownership without revealing your secret — ~10 seconds')
      const t0 = performance.now()
      const snarkjs = await import('snarkjs')
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
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
      setProofElapsed(Math.round(performance.now() - t0))
      setProofStatus('done')

      const proofBytes = serializeProofForSoroban(proof as Parameters<typeof serializeProofForSoroban>[0])

      // 3 — Build spend tx (0n new_commitment = withdraw)
      const unsignedXdr = await buildSpendTx(
        publicKey,
        proofBytes,
        publicSignals,
        BigInt(selectedNote.nullifier),
        0n,
        toAddress.trim(),
      )

      // 4 — Sign
      setStep('signing')
      const signedXdr = await signTransaction(unsignedXdr)

      // 5 — Submit
      setStep('submitting')
      toast.info('Broadcasting to Stellar…')
      const { hash } = await submitTransaction(signedXdr)

      // 6 — Mark spent
      markNoteSpent(selectedNote.nullifier)
      setTxHash(hash)
      setStep('done')
      toast.success('Withdrawal confirmed!', `${(Number(selectedNote.amount) / 10_000_000).toFixed(2)} XLM sent to ${toAddress.slice(0, 6)}…`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setProofStatus('error')
      setErrorMsg(msg)
      setStep('error')
      toast.error('Withdrawal failed', msg.slice(0, 120))
    }
  }, [publicKey, selectedNote, toAddress, signTransaction, toast])

  const reset = () => {
    setStep('select'); setSelectedNote(null); setToAddress('')
    setTxHash(''); setErrorMsg(''); setProofStatus('idle')
  }

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-5xl mb-4">💸</div>
        <h1 className="text-2xl font-bold text-shield-dark mb-2">Connect your wallet</h1>
        <p className="text-shield-mid mb-6">Connect Freighter to withdraw from the pool.</p>
        <button onClick={connect} className="btn-primary">Connect Freighter</button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="badge badge-coral mb-3">Private withdrawal</span>
        <h1 className="text-3xl font-bold text-shield-dark mb-2">Withdraw XLM</h1>
        <p className="text-shield-mid">Prove ownership of a note and withdraw to any address — zero on-chain link to the depositor.</p>
      </div>

      {/* Sync status */}
      {!synced && (
        <div className="mb-4 flex items-center gap-2 text-xs text-shield-mid bg-shield-light rounded-xl px-4 py-2.5">
          <div className="w-3 h-3 border border-shield-mid border-t-transparent rounded-full animate-spin" />
          Syncing Merkle tree… ({leafCount} deposits)
        </div>
      )}

      <div className="card p-6 flex flex-col gap-6">

        {/* Note selection + address input */}
        {(step === 'select' || step === 'input') && (
          <>
            <div>
              <label className="block text-sm font-medium text-shield-dark mb-2">Select a note to withdraw</label>
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
                          ? 'border-shield-coral bg-shield-coral-lt'
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
                  <label className="block text-sm font-medium text-shield-dark mb-2">Withdraw to address</label>
                  <input
                    type="text" value={toAddress}
                    onChange={(e) => setToAddress(e.target.value.trim())}
                    placeholder="G… (any Stellar address)"
                    className="input font-mono text-sm"
                  />
                  <p className="text-xs text-shield-mid mt-2">
                    Use a fresh wallet with no history for maximum privacy — this address has zero link to your depositing wallet.
                  </p>
                </div>

                <div className="bg-shield-coral-lt rounded-xl p-4 text-sm">
                  <div className="font-medium text-shield-coral mb-1">💸 What gets revealed?</div>
                  <div className="text-shield-mid leading-relaxed">
                    The contract sees: a valid ZK proof + a nullifier (to prevent double-spend).
                    No amount. No depositor address. No link to any prior transaction.
                  </div>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={!toAddress.trim() || !synced}
                  className="btn-primary"
                >
                  {!synced ? 'Waiting for tree sync…' : 'Generate proof & withdraw →'}
                </button>
              </>
            )}

            {/* Import a received note */}
            <NoteImporter onImported={() => { toast.success('Note imported!'); window.location.reload() }} />
          </>
        )}

        {/* Proof generation */}
        {step === 'proving' && (
          <ProofProgress status={proofStatus} elapsedMs={proofElapsed} error={errorMsg || null} />
        )}

        {/* Signing / submitting */}
        {(step === 'signing' || step === 'submitting') && (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-shield-coral-lt flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-shield-coral border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <div className="font-semibold text-shield-dark text-lg mb-1">
                {step === 'signing' ? 'Waiting for signature…' : 'Submitting to Stellar…'}
              </div>
              <div className="text-shield-mid text-sm">
                {step === 'signing' ? 'Approve the transaction in Freighter' : 'Broadcasting to testnet…'}
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl">✅</div>
              <div>
                <div className="font-semibold text-shield-dark">Withdrawal confirmed</div>
                <div className="text-sm text-shield-mid">
                  {selectedNote && (Number(selectedNote.amount) / 10_000_000).toFixed(2)} XLM →{' '}
                  <span className="font-mono">{toAddress.slice(0, 6)}…{toAddress.slice(-6)}</span>
                </div>
              </div>
            </div>

            <div className="bg-shield-teal-lt rounded-xl p-4 text-sm text-shield-teal">
              ✓ The withdrawal address has no on-chain connection to your depositing address.
              The Stellar explorer shows only that a proof was verified and XLM was released.
            </div>

            {txHash && (
              <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer"
                className="text-sm text-shield-blue underline text-center">
                View on Stellar Explorer →
              </a>
            )}
            <div className="flex gap-3">
              <button onClick={reset} className="btn-ghost flex-1">New withdrawal</button>
              <a href="/dashboard" className="btn-primary flex-1 text-center">Dashboard →</a>
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="text-4xl">⚠️</div>
            <div className="font-semibold text-shield-dark">Withdrawal failed</div>
            <div className="text-sm text-shield-mid bg-shield-coral-lt rounded-xl p-3 text-left break-all w-full">{errorMsg}</div>
            <button onClick={() => setStep('select')} className="btn-ghost">Try again</button>
          </div>
        )}
      </div>
    </div>
  )
}
