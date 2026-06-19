'use client'

import Link from 'next/link'
import { useWallet } from '@/components/wallet/WalletProvider'

const features = [
  {
    icon: '🔒',
    title: 'Private deposits',
    description:
      'Lock XLM into the pool. A cryptographic commitment is stored on-chain — no amounts, no links.',
    href: '/deposit',
    color: 'bg-shield-teal-lt text-shield-teal',
    cta: 'Deposit XLM',
  },
  {
    icon: '🔄',
    title: 'Private transfers',
    description:
      'Send value to any wallet. A ZK proof verifies validity without revealing sender, receiver, or amount.',
    href: '/transfer',
    color: 'bg-shield-purple-lt text-shield-purple',
    cta: 'Transfer privately',
  },
  {
    icon: '💸',
    title: 'Unlinkable withdrawals',
    description:
      'Withdraw to any address. The recipient has zero on-chain connection to the original depositor.',
    href: '/withdraw',
    color: 'bg-shield-coral-lt text-shield-coral',
    cta: 'Withdraw XLM',
  },
]

export default function Home() {
  const { connected, connect, publicKey } = useWallet()

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">

      {/* Hero */}
      <div className="text-center mb-16 animate-slide-up">
        <div className="inline-flex items-center gap-2 badge badge-purple mb-6">
          <span className="w-2 h-2 rounded-full bg-shield-purple animate-pulse-slow" />
          Stellar Hacks: ZK 2026
        </div>
        <h1 className="text-5xl font-bold text-shield-dark mb-4 leading-tight">
          Private payments
          <br />
          <span className="text-shield-teal">on Stellar</span>
        </h1>
        <p className="text-lg text-shield-mid max-w-xl mx-auto mb-8">
          ZK Shield uses zero-knowledge proofs to let you deposit, transfer, and
          withdraw XLM — without the blockchain ever recording who sent what to
          whom or how much.
        </p>

        {!connected ? (
          <button onClick={connect} className="btn-primary text-base px-8 py-4">
            Connect Freighter wallet
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <span className="badge badge-green">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
            <span className="text-sm text-shield-mid font-mono">
              {publicKey?.slice(0, 6)}…{publicKey?.slice(-6)}
            </span>
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard →
            </Link>
          </div>
        )}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {features.map((f) => (
          <div key={f.title} className="card p-6 flex flex-col gap-4 animate-fade-in">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${f.color}`}>
              {f.icon}
            </div>
            <div>
              <h3 className="font-semibold text-shield-dark mb-1">{f.title}</h3>
              <p className="text-sm text-shield-mid leading-relaxed">{f.description}</p>
            </div>
            <Link href={f.href} className="btn-ghost text-sm mt-auto text-center">
              {f.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* How it works — brief */}
      <div className="card p-8 bg-shield-dark text-white">
        <h2 className="text-xl font-semibold mb-6">How ZK Shield works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          {[
            ['1', 'Commit', 'You generate a secret and deposit XLM. A Pedersen commitment goes on-chain.'],
            ['2', 'Merkle tree', 'Your commitment is inserted into a Merkle tree inside the Soroban contract.'],
            ['3', 'ZK proof', 'Your browser generates a Groth16 proof that you own a valid commitment — no secret revealed.'],
            ['4', 'On-chain verify', 'The Soroban contract verifies the proof using Stellar\'s BN254 host functions. XLM is released.'],
          ].map(([n, title, desc]) => (
            <div key={n} className="flex gap-3">
              <span className="flex-shrink-0 step-active">{n}</span>
              <div>
                <div className="font-medium text-white mb-1">{title}</div>
                <div className="text-gray-400 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
