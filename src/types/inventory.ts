import type { ApiResponse } from './common'

export interface InventoryAdjustmentRequest {
  productId: string
  lotId?: string
  qtyDelta: number
  reason: string
  actorId: number
  timestamp?: string
}

export interface InventoryAdjustmentResponse {
  movementId: string
  qty: number
}

export type InventoryAdjustmentApiResponse = ApiResponse<InventoryAdjustmentResponse>

export interface LotSummary {
  lotId: string
  qtyOnHand: number
  receivedAt?: string | null
  expiryDate?: string | null
}

export interface MovementSummary {
  id: string
  type: string
  qty: number
  lotId?: string | null
  at: string
  refType?: string | null
  refId?: string | null
}

export interface InventoryLedger {
  productId: string
  onHand: number
  lots: LotSummary[]
  movements: MovementSummary[]
  recentMovements?: MovementSummary[]
}
