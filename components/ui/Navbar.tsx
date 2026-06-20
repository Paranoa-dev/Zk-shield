'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/components/wallet/WalletProvider'
import { MobileNav } from '@/components/ui/MobileNav'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/deposit',   label: 'Deposit' },
  { href: '/transfer',  label: 'Transfer' },
  { href: '/withdraw',  label: 'Withdraw' },
]

export function Navbar() {
  const pathname = usePathname()
  const { connected, publicKey, connect, disconnect, isLoading } = useWallet()

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-shield-dark">
          <span className="w-7 h-7 rounded-lg bg-shield-teal flex items-center justify-center text-white text-xs font-bold">ZK</span>
          ZK Shield
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname === href
                  ? 'bg-shield-teal-lt text-shield-teal font-medium'
                  : 'text-shield-mid hover:text-shield-dark hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop wallet + mobile hamburger */}
        <div className="flex items-center gap-2">
          {/* Desktop wallet button */}
          <div className="hidden md:block">
            {connected ? (
              <button
                onClick={disconnect}
                className="flex items-center gap-2 text-sm border border-gray-200 rounded-xl px-3 py-1.5 hover:border-gray-400 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-mono text-shield-mid">
                  {publicKey?.slice(0, 4)}…{publicKey?.slice(-4)}
                </span>
              </button>
            ) : (
              <button onClick={connect} disabled={isLoading} className="btn-primary text-sm py-2 px-4">
                {isLoading ? 'Connecting…' : 'Connect wallet'}
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
