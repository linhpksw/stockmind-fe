import type { ApiResponse } from './common'

export interface MarkdownRecommendation {
  productId: string
  lotId: string
  daysToExpiry: number
  suggestedDiscountPct: number
  floorPctOfCost: number
}

export interface MarkdownApplyRequest {
  productId: string
  lotId: string
  discountPct: number
  overrideFloor: boolean
}

export interface MarkdownApplyResponse {
  applied: boolean
  effectivePrice: number
}

export type MarkdownRecommendationsResponse = ApiResponse<MarkdownRecommendation[]>
export type MarkdownApplyApiResponse = ApiResponse<MarkdownApplyResponse>
