'use client'

import { useWallet } from '@/components/wallet/WalletProvider'

interface ConnectPromptProps {
  message?: string
}

/**
 * ConnectPrompt — shown on any page that requires a connected wallet.
 * Renders a centred card with a connect button and optional context message.
 */
export function ConnectPrompt({ message = 'Connect your Freighter wallet to continue.' }: ConnectPromptProps) {
  const { connect, isLoading, error } = useWallet()

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-4">
      <div className="card p-8 max-w-sm w-full text-center flex flex-col gap-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-semibold text-shield-dark">Wallet required</h2>
        <p className="text-sm text-shield-mid">{message}</p>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>
        )}

        <button
          onClick={connect}
          disabled={isLoading}
          className="btn-primary"
        >
          {isLoading ? 'Connecting…' : 'Connect Freighter'}
        </button>

        <a
          href="https://www.freighter.app"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-shield-mid hover:text-shield-dark transition-colors"
        >
          Don&apos;t have Freighter? Install it here →
        </a>
      </div>
    </div>
  )
}
