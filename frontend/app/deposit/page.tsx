'use client'

import { useState, useCallback } from 'react'
import { useWallet }   from '@/components/wallet/WalletProvider'
import { useToast }    from '@/components/ui/Toast'
import { useTreeSync } from '@/hooks/useTreeSync'
import { createCommitment, saveNote, type Note } from '@/lib/zk/proof'
import { buildDepositTx, submitTransaction }      from '@/lib/stellar/contract'
import { loadTree, saveTree }                     from '@/lib/merkle/tree'

type Step = 'input' | 'generating' | 'signing' | 'submitting' | 'done' | 'error'

const STEP_LABELS: Record<Step, string> = {
  input:      'Enter amount',
  generating: 'Generating commitment',
  signing:    'Sign in Freighter',
  submitting: 'Submitting to Stellar',
  done:       'Deposited!',
  error:      'Error',
}

const PRESETS = [10, 50, 100, 500]

export default function DepositPage() {
  const { connected, publicKey, connect, signTransaction } = useWallet()
  const toast   = useToast()
  const { synced, leafCount } = useTreeSync()

  const [amount,    setAmount]    = useState('')
  const [step,      setStep]      = useState<Step>('input')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [txHash,    setTxHash]    = useState('')
  const [savedNote, setSavedNote] = useState<Note | null>(null)

  const handleDeposit = useCallback(async () => {
    if (!publicKey || !amount) return
    const xlm = parseFloat(amount)
    if (isNaN(xlm) || xlm <= 0) { toast.warning('Invalid amount', 'Enter a positive XLM amount'); return }

    setErrorMsg('')
    try {
      // 1 — Generate commitment
      setStep('generating')
      const commitment = await createCommitment(xlm)
      toast.info('Commitment generated', 'Your secret was created locally — never leaves your device')

      // 2 — Build tx
      const unsignedXdr = await buildDepositTx(publicKey, commitment.commitment, commitment.amount)

      // 3 — Sign
      setStep('signing')
      const signedXdr = await signTransaction(unsignedXdr)

      // 4 — Submit
      setStep('submitting')
      toast.info('Broadcasting transaction…')
      const { hash } = await submitTransaction(signedXdr)

      // 5 — Update local tree + save note
      const tree    = loadTree()
      const leafIdx = await tree.insert(commitment.commitment)
      saveTree(tree)

      const note: Note = {
        id:         crypto.randomUUID(),
        commitment: commitment.commitment.toString(),
        nullifier:  commitment.nullifier.toString(),
        secret:     commitment.secret.toString(),
        amount:     commitment.amount.toString(),
        leafIndex:  leafIdx,
        spent:      false,
        createdAt:  Date.now(),
      }
      saveNote(note)
      setSavedNote(note)
      setTxHash(hash)
      setStep('done')
      toast.success('Deposit confirmed!', `${xlm} XLM is now in the private pool`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setErrorMsg(msg)
      setStep('error')
      toast.error('Deposit failed', msg.slice(0, 120))
    }
  }, [publicKey, amount, signTransaction, toast])

  const reset = () => { setStep('input'); setAmount(''); setTxHash(''); setSavedNote(null); setErrorMsg('') }

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-shield-dark mb-2">Connect your wallet</h1>
        <p className="text-shield-mid mb-6">You need Freighter to deposit into the private pool.</p>
        <button onClick={connect} className="btn-primary">Connect Freighter</button>
      </div>
    )
  }

  const steps: Step[] = ['input', 'generating', 'signing', 'submitting', 'done']
  const stepIdx = steps.indexOf(step)

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="badge badge-green mb-3">Private deposit</span>
        <h1 className="text-3xl font-bold text-shield-dark mb-2">Deposit XLM</h1>
        <p className="text-shield-mid">Lock XLM into the pool — only a cryptographic commitment is stored on-chain.</p>
      </div>

      {/* Tree sync status */}
      {!synced && (
        <div className="mb-4 flex items-center gap-2 text-xs text-shield-mid bg-shield-light rounded-xl px-4 py-2.5">
          <div className="w-3 h-3 border border-shield-mid border-t-transparent rounded-full animate-spin" />
          Syncing Merkle tree from chain… ({leafCount} deposits loaded)
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => {
          const done    = i < stepIdx
          const active  = i === stepIdx
          const pending = i > stepIdx
          return (
            <div key={s} className="flex items-center gap-2">
              <span className={done ? 'step-done' : active ? 'step-active' : 'step-pending'}>
                {done ? '✓' : i + 1}
              </span>
              {i < steps.length - 1 && (
                <div className={`h-px w-5 ${done ? 'bg-shield-teal' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
        <span className="text-sm text-shield-mid ml-1">{STEP_LABELS[step]}</span>
      </div>

      <div className="card p-6">

        {/* INPUT */}
        {step === 'input' && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-shield-dark mb-2">Amount (XLM)</label>
              <div className="relative">
                <input
                  type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" min="0.1" step="0.1"
                  className="input pr-16 text-lg font-mono"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-shield-mid font-medium">XLM</span>
              </div>
            </div>
            <div className="flex gap-2">
              {PRESETS.map((a) => (
                <button key={a} onClick={() => setAmount(String(a))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    amount === String(a) ? 'bg-shield-teal-lt border-shield-teal text-shield-teal' : 'border-gray-200 text-shield-mid hover:border-gray-400'
                  }`}
                >{a} XLM</button>
              ))}
            </div>
            <div className="bg-shield-teal-lt rounded-xl p-4 text-sm text-shield-teal">
              <div className="font-medium mb-1">🛡️ What gets stored on-chain?</div>
              <div className="text-shield-mid leading-relaxed">
                Only <code className="font-mono bg-white/60 px-1 rounded">Poseidon(secret, amount)</code>. No amounts. No addresses. Your secret stays in your browser.
              </div>
            </div>
            <button onClick={handleDeposit} disabled={!amount || parseFloat(amount) <= 0} className="btn-primary">
              Deposit privately →
            </button>
          </div>
        )}

        {/* LOADING */}
        {(step === 'generating' || step === 'signing' || step === 'submitting') && (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-shield-teal-lt flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-shield-teal border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <div className="font-semibold text-shield-dark text-lg mb-1">{STEP_LABELS[step]}</div>
              <div className="text-shield-mid text-sm">
                {step === 'generating' && 'Creating your Poseidon commitment locally…'}
                {step === 'signing'    && 'Approve the transaction in your Freighter extension'}
                {step === 'submitting' && 'Broadcasting to Stellar testnet…'}
              </div>
            </div>
            {step === 'signing' && <div className="badge badge-purple animate-pulse-slow">Check your Freighter extension</div>}
          </div>
        )}

        {/* DONE */}
        {step === 'done' && savedNote && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl">✅</div>
              <div>
                <div className="font-semibold text-shield-dark">Deposit confirmed</div>
                <div className="text-sm text-shield-mid">{(Number(savedNote.amount) / 10_000_000).toFixed(2)} XLM added to the pool</div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="font-medium text-amber-800 mb-2">⚠️ Back up your note</div>
              <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                This secret lets you spend your deposit. It&apos;s stored in your browser — back it up somewhere safe.
              </p>
              <div className="font-mono text-xs bg-white rounded-lg p-3 break-all text-shield-dark">
                {JSON.stringify({ id: savedNote.id, secret: savedNote.secret, nullifier: savedNote.nullifier, amount: savedNote.amount, leafIndex: savedNote.leafIndex }, null, 2)}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(savedNote)); toast.success('Copied!') }} className="btn-ghost text-xs mt-3 w-full">
                Copy to clipboard
              </button>
            </div>
            {txHash && (
              <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-sm text-shield-blue underline text-center">
                View on Stellar Explorer →
              </a>
            )}
            <div className="flex gap-3">
              <button onClick={reset} className="btn-ghost flex-1">New deposit</button>
              <a href="/transfer" className="btn-primary flex-1 text-center">Transfer now →</a>
            </div>
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="text-4xl">⚠️</div>
            <div className="font-semibold text-shield-dark">Something went wrong</div>
            <div className="text-sm text-shield-mid bg-shield-coral-lt rounded-xl p-3 text-left break-all w-full">{errorMsg}</div>
            <button onClick={reset} className="btn-ghost">Try again</button>
          </div>
        )}
      </div>
    </div>
  )
}
