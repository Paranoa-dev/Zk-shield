export interface ZkShieldClientConfig {
  contractId: string
  rpcUrl: string
  networkPassphrase: string
  horizonUrl?: string
}

export interface DepositEvent {
  commitment: string   // hex
  leafIndex: number
  ledger: number
  txHash: string
}

export interface SpendEvent {
  nullifier: string    // hex
  type: 'transfer' | 'withdraw'
  ledger: number
  txHash: string
}
