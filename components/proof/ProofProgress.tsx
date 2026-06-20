'use client'

import { useEffect, useState } from 'react'

interface Props {
  status:    'idle' | 'generating' | 'done' | 'error'
  elapsedMs: number
  error?:    string | null
}

const MESSAGES = [
  'Sampling random witness…',
  'Computing Poseidon hashes…',
  'Building Merkle inclusion proof…',
  'Running Groth16 prover…',
  'Computing elliptic curve operations…',
  'Finalising proof…',
]

/**
 * Animated progress card shown during ZK proof generation.
 * Cycles through descriptive messages so the user knows what's happening.
 */
export function ProofProgress({ status, elapsedMs, error }: Props) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [dots,   setDots]   = useState('')

  // Rotate through messages while generating
  useEffect(() => {
    if (status !== 'generating') return
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [status])

  // Animated ellipsis
  useEffect(() => {
    if (status !== 'generating') return
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 400)
    return () => clearInterval(interval)
  }, [status])

  if (status === 'idle') return null

  return (
    <div className="card p-6 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        {status === 'generating' && (
          <div className="w-10 h-10 rounded-full bg-shield-purple-lt flex items-center justify-center flex-shrink-0">
            <div className="w-5 h-5 border-2 border-shield-purple border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {status === 'done' && (
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-lg">
            ✅
          </div>
        )}
        {status === 'error' && (
          <div className="w-10 h-10 rounded-full bg-shield-coral-lt flex items-center justify-center flex-shrink-0 text-lg">
            ⚠️
          </div>
        )}

        <div>
          <div className="font-semibold text-shield-dark text-sm">
            {status === 'generating' && `Generating ZK proof${dots}`}
            {status === 'done'       && 'ZK proof ready'}
            {status === 'error'      && 'Proof generation failed'}
          </div>
          <div className="text-xs text-shield-mid">
            {status === 'generating' && `${(elapsedMs / 1000).toFixed(1)}s elapsed`}
            {status === 'done'       && `Generated in ${(elapsedMs / 1000).toFixed(1)}s`}
            {status === 'error'      && 'See error below'}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {status === 'generating' && (
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-shield-purple rounded-full animate-pulse-slow w-3/4 transition-all" />
        </div>
      )}

      {/* Rotating message */}
      {status === 'generating' && (
        <div className="text-xs text-shield-mid font-mono bg-shield-light rounded-lg px-3 py-2 min-h-[28px]">
          {MESSAGES[msgIdx]}
        </div>
      )}

      {/* Done — show proof snippet */}
      {status === 'done' && (
        <div className="bg-shield-teal-lt rounded-lg px-3 py-2 text-xs text-shield-teal">
          Proof verified locally ✓ — ready to submit to Soroban
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="bg-shield-coral-lt rounded-lg px-3 py-2 text-xs text-shield-mid break-all">
          {error}
        </div>
      )}

      {/* Privacy note */}
      <p className="text-xs text-shield-mid leading-relaxed">
        🔒 The proof is computed entirely in your browser. Your secret never leaves your device.
      </p>
    </div>
  )
}
