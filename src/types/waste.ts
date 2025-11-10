import type { ApiResponse } from './common'

export interface WasteRequest {
  productId: string
  lotId: string
  qty: number
  reason: string
}

export interface WasteResponseDto {
  movementId: string
  type: string
  qty: number
}

export type WasteResponse = ApiResponse<WasteResponseDto>
