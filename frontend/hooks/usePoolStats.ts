'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchDepositEvents, NETWORK } from '@/lib/stellar/contract'

interface PoolStats {
  leafCount: number
  xlmBalance: string
  loading: boolean
  error: string | null
}

/**
 * usePoolStats — derives pool statistics from on-chain events.
 * leaf count from deposit events; XLM balance from Horizon.
 */
export function usePoolStats(): PoolStats & { refresh: () => void } {
  const [stats, setStats] = useState<PoolStats>({
    leafCount: 0, xlmBalance: '0', loading: true, error: null,
  })

  const load = useCallback(async () => {
    setStats((s) => ({ ...s, loading: true, error: null }))
    try {
      const events = await fetchDepositEvents()
      const leafCount = events.length

      let xlmBalance = '0'
      try {
        const { CONTRACT_ID } = await import('@/lib/stellar/contract')
        const resp = await fetch(`${NETWORK.horizonUrl}/accounts/${CONTRACT_ID}`)
        if (resp.ok) {
          const data = await resp.json()
          const native = (data.balances ?? []).find(
            (b: { asset_type: string }) => b.asset_type === 'native'
          )
          xlmBalance = native?.balance ?? '0'
        }
      } catch { /* balance is best-effort */ }

      setStats({ leafCount, xlmBalance, loading: false, error: null })
    } catch (err) {
      setStats((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch pool stats',
      }))
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { ...stats, refresh: load }
}
