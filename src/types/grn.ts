import type { ApiResponse } from './common'

export interface GrnItemInput {
  productId: number
  qtyReceived: number
  unitCost: number
  lotCode: string
  expiryDate?: string | null
}

export interface CreateGrnRequest {
  poId: number
  receivedAt?: string
  items: GrnItemInput[]
}

export interface StockMovementRef {
  productId: string
  lotId: string
  qty: number
  type: string
}

export interface GrnResponseDto {
  id: string
  stockMovements: StockMovementRef[]
}

export type GrnResponse = ApiResponse<GrnResponseDto>
