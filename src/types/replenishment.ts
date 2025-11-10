import type { ApiResponse } from './common'

export interface ReplenishmentSuggestion {
  productId: number
  onHand: number
  onOrder: number
  avgDaily: number
  sigmaDaily: number
  leadTimeDays: number
  safetyStock: number
  rop: number
  suggestedQty: number
}

export type ReplenishmentResponse = ApiResponse<ReplenishmentSuggestion[]>
