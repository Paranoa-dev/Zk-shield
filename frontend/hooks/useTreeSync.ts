'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchDepositEvents, fetchSpentNullifiers } from '@/lib/stellar/contract'
import { loadTree, saveTree, MerkleTree } from '@/lib/merkle/tree'
import { markNoteSpent } from '@/lib/zk/proof'

interface SyncState {
  syncing:    boolean
  synced:     boolean
  leafCount:  number
  root:       string
  error:      string | null
  lastSyncAt: number | null
}

/**
 * useTreeSync — fetches all on-chain deposit events and rebuilds the local
 * Merkle tree so that proof generation always uses the correct root.
 *
 * Also marks any locally cached notes as spent if their nullifier appears
 * in the on-chain spend events.
 *
 * Call once per page load on any page that generates proofs.
 */
export function useTreeSync() {
  const [state, setState] = useState<SyncState>({
    syncing:    false,
    synced:     false,
    leafCount:  0,
    root:       '',
    error:      null,
    lastSyncAt: null,
  })

  const sync = useCallback(async () => {
    setState((s) => ({ ...s, syncing: true, error: null }))
    try {
      // 1. Fetch all deposit events from the contract
      const events = await fetchDepositEvents()

      // 2. Rebuild tree from scratch (ensures consistency with chain)
      const tree = new MerkleTree()
      for (const event of events) {
        await tree.insert(event.commitment)
      }
      saveTree(tree)

      // 3. Mark spent notes locally
      const spentNullifiers = await fetchSpentNullifiers()
      for (const nullifier of spentNullifiers) {
        markNoteSpent(nullifier.toString())
      }

      setState({
        syncing:    false,
        synced:     true,
        leafCount:  events.length,
        root:       tree.root.toString(),
        error:      null,
        lastSyncAt: Date.now(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed'
      // Non-fatal: use cached tree if sync fails (e.g. RPC down)
      const cached = loadTree()
      setState({
        syncing:    false,
        synced:     false,
        leafCount:  cached.size,
        root:       cached.root.toString(),
        error:      msg,
        lastSyncAt: null,
      })
    }
  }, [])

  // Sync on mount
  useEffect(() => { sync() }, [sync])

  return { ...state, resync: sync }
}
