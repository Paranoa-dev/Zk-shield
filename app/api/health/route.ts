import { NextResponse } from 'next/server'

const START = Date.now()

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.1.0',
    uptimeMs: Date.now() - START,
    network: process.env.NEXT_PUBLIC_NETWORK ?? 'testnet',
    contractId: process.env.NEXT_PUBLIC_CONTRACT_ID ?? null,
  })
}
