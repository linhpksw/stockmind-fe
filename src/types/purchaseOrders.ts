import type { ApiResponse } from './common'

export interface PoItemInput {
  productId: number
  qty: number
  unitCost: number
  expectedDate: string
}

export interface CreatePoRequest {
  supplierId: number
  items: PoItemInput[]
}

export interface PoDto {
  id: string
  status: string
  createdAt: string
}

export type PoResponse = ApiResponse<PoDto>
