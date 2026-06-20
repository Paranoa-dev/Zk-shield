'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'

// Freighter browser extension API
// Docs: https://docs.freighter.app/docs/guide/usingFreighterBrowser
let freighter: typeof import('@stellar/freighter-api') | null = null

async function getFreighter() {
  if (freighter) return freighter
  try {
    freighter = await import('@stellar/freighter-api')
    return freighter
  } catch {
    return null
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletContextType {
  connected: boolean
  publicKey: string | null
  network: string | null
  connect: () => Promise<void>
  disconnect: () => void
  signTransaction: (xdr: string) => Promise<string>
  isLoading: boolean
  error: string | null
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  publicKey: null,
  network: null,
  connect: async () => {},
  disconnect: () => {},
  signTransaction: async () => '',
  isLoading: false,
  error: null,
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected]   = useState(false)
  const [publicKey, setPublicKey]   = useState<string | null>(null)
  const [network,   setNetwork]     = useState<string | null>(null)
  const [isLoading, setIsLoading]   = useState(false)
  const [error,     setError]       = useState<string | null>(null)

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    const savedKey = sessionStorage.getItem('zk-shield-pubkey')
    if (savedKey) {
      setPublicKey(savedKey)
      setConnected(true)
    }
  }, [])

  const connect = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const f = await getFreighter()
      if (!f) {
        throw new Error(
          'Freighter wallet not found. Install it from https://www.freighter.app'
        )
      }
      const isAllowed = await f.isAllowed()
      if (!isAllowed) {
        await f.setAllowed()
      }
      const key = await f.getPublicKey()
      const { networkPassphrase } = await f.getNetworkDetails()

      setPublicKey(key)
      setNetwork(networkPassphrase)
      setConnected(true)
      sessionStorage.setItem('zk-shield-pubkey', key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(msg)
      console.error('[WalletProvider] connect error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setConnected(false)
    setPublicKey(null)
    setNetwork(null)
    sessionStorage.removeItem('zk-shield-pubkey')
  }, [])

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      const f = await getFreighter()
      if (!f) throw new Error('Freighter not available')
      if (!network) throw new Error('Network not set')

      return f.signTransaction(xdr, { networkPassphrase: network })
    },
    [network]
  )

  return (
    <WalletContext.Provider
      value={{ connected, publicKey, network, connect, disconnect, signTransaction, isLoading, error }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)
