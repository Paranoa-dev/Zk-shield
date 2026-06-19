'use client'

import { useState, useCallback } from 'react'
import {
  generateProof,
  serializeProofForSoroban,
  type ProofInputs,
  type ZKProof,
} from '@/lib/zk/proof'

type ProofStatus = 'idle' | 'generating' | 'done' | 'error'

interface UseProofReturn {
  status:      ProofStatus
  proof:       ZKProof | null
  proofBytes:  Uint8Array | null
  publicSignals: string[]
  error:       string | null
  generate:    (inputs: ProofInputs) => Promise<void>
  reset:       () => void
  elapsedMs:   number
}

/**
 * React hook that wraps snarkjs proof generation with loading state.
 * Proof runs in a web worker when available to avoid blocking the UI.
 */
export function useProof(): UseProofReturn {
  const [status,        setStatus]        = useState<ProofStatus>('idle')
  const [proof,         setProof]         = useState<ZKProof | null>(null)
  const [proofBytes,    setProofBytes]    = useState<Uint8Array | null>(null)
  const [publicSignals, setPublicSignals] = useState<string[]>([])
  const [error,         setError]         = useState<string | null>(null)
  const [elapsedMs,     setElapsedMs]     = useState(0)

  const generate = useCallback(async (inputs: ProofInputs) => {
    setStatus('generating')
    setError(null)
    setProof(null)
    setProofBytes(null)
    setPublicSignals([])

    const start = performance.now()
    try {
      const result = await generateProof(inputs)
      const bytes  = serializeProofForSoroban(result.proof)

      setProof(result)
      setProofBytes(bytes)
      setPublicSignals(result.publicSignals)
      setElapsedMs(Math.round(performance.now() - start))
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proof generation failed')
      setElapsedMs(Math.round(performance.now() - start))
      setStatus('error')
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setProof(null)
    setProofBytes(null)
    setPublicSignals([])
    setError(null)
    setElapsedMs(0)
  }, [])

  return { status, proof, proofBytes, publicSignals, error, generate, reset, elapsedMs }
}
