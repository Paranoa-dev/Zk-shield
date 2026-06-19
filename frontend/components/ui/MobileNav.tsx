'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/components/wallet/WalletProvider'

const NAV_LINKS = [
  { href: '/',          label: 'Home',      icon: '🏠' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/deposit',   label: 'Deposit',   icon: '🔒' },
  { href: '/transfer',  label: 'Transfer',  icon: '🔄' },
  { href: '/withdraw',  label: 'Withdraw',  icon: '💸' },
]

export function MobileNav() {
  const pathname = usePathname()
  const { connected, publicKey, connect, disconnect, isLoading } = useWallet()
  const [open, setOpen] = useState(false)

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Hamburger button — only visible on mobile */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        <span className={`block w-5 h-0.5 bg-shield-dark transition-transform duration-200 ${open ? 'translate-y-2 rotate-45' : ''}`} />
        <span className={`block w-5 h-0.5 bg-shield-dark transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-shield-dark transition-transform duration-200 ${open ? '-translate-y-2 -rotate-45' : ''}`} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 w-72 bg-white shadow-2xl
        transform transition-transform duration-300 ease-out md:hidden
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2 font-bold text-shield-dark">
            <span className="w-7 h-7 rounded-lg bg-shield-teal flex items-center justify-center text-white text-xs">ZK</span>
            ZK Shield
          </div>
          <button onClick={() => setOpen(false)} className="text-2xl text-gray-400 hover:text-gray-600 transition-colors leading-none">×</button>
        </div>

        {/* Nav links */}
        <nav className="px-4 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-shield-teal-lt text-shield-teal'
                  : 'text-shield-mid hover:text-shield-dark hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Wallet section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
          {connected ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-shield-light rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-xs font-mono text-shield-mid truncate">
                  {publicKey?.slice(0, 10)}…{publicKey?.slice(-8)}
                </span>
              </div>
              <button onClick={disconnect} className="btn-ghost text-sm w-full">
                Disconnect wallet
              </button>
            </div>
          ) : (
            <button onClick={connect} disabled={isLoading} className="btn-primary w-full text-sm">
              {isLoading ? 'Connecting…' : 'Connect Freighter'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
