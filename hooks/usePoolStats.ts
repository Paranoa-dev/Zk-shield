'use client'

import { useState, useEffect, useCallback } from 'react'
import { getRpc, CONTRACT_ID, NETWORK } from '@/lib/stellar/contract'
import { Contract, scValToNative } from '@stellar/stellar-sdk'

interface PoolStats {
  leafCount: number
  root: string
  xlmBalance: string
  loading: boolean
  error: string | null
}

/**
 * usePoolStats — reads on-chain contract state to display pool statistics.
 * Fetches leaf count, current Merkle root, and the contract's XLM balance.
 */
export function usePoolStats(): PoolStats & { refresh: () => void } {
  const [stats, setStats] = useState<PoolStats>({
    leafCount: 0,
    root: '',
    xlmBalance: '0',
    loading: true,
    error: null,
  })

  const fetch = useCallback(async () => {
    setStats((s) => ({ ...s, loading: true, error: null }))
    try {
      const rpc = getRpc()

      // Read leaf count
      const leafCountResult = await rpc.readContract({
        contract: CONTRACT_ID,
        method: 'get_leaf_count',
        args: [],
      })
      const leafCount = Number(scValToNative(leafCountResult.result.retval))

      // Read root
      const rootResult = await rpc.readContract({
        contract: CONTRACT_ID,
        method: 'get_root',
        args: [],
      })
      const root = Buffer.from(
        (scValToNative(rootResult.result.retval) as Uint8Array)
      ).toString('hex')

      // Read XLM balance of the contract
      const balResp = await fetch(
        `${NETWORK.horizonUrl}/accounts/${CONTRACT_ID}`
      )
      let xlmBalance = '0'
      if (balResp.ok) {
        const data = await balResp.json()
        const native = (data.balances ?? []).find(
          (b: { asset_type: string }) => b.asset_type === 'native'
        )
        xlmBalance = native?.balance ?? '0'
      }

      setStats({ leafCount, root, xlmBalance, loading: false, error: null })
    } catch (err) {
      setStats((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch pool stats',
      }))
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { ...stats, refresh: fetch }
}
