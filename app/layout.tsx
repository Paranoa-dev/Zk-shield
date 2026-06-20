import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { ToastProvider }  from '@/components/ui/Toast'
import { ErrorBoundary }  from '@/components/ui/ErrorBoundary'
import { Navbar }         from '@/components/ui/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title:       'ZK Shield — Private Payments on Stellar',
  description: 'Deposit, transfer, and withdraw XLM privately using zero-knowledge proofs on Stellar.',
  openGraph: {
    title:       'ZK Shield',
    description: 'Private payments on Stellar using zero-knowledge proofs',
    type:        'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <WalletProvider>
          <ToastProvider>
            <Navbar />
            <main className="min-h-screen pt-16">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
            <footer className="border-t border-gray-200 py-8 mt-16">
              <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
                <span className="text-sm text-shield-mid">
                  ZK Shield — Stellar Hacks: ZK 2026
                </span>
                <div className="flex gap-4 text-sm text-shield-mid">
                  <a href="https://github.com/zk-shield/zk-shield" className="hover:text-shield-dark transition-colors" target="_blank" rel="noreferrer">GitHub</a>
                  <a href="https://developers.stellar.org" className="hover:text-shield-dark transition-colors" target="_blank" rel="noreferrer">Stellar Docs</a>
                  <a href="https://stellar.expert/explorer/testnet" className="hover:text-shield-dark transition-colors" target="_blank" rel="noreferrer">Explorer</a>
                </div>
              </div>
            </footer>
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
