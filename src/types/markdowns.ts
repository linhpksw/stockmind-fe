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

export interface MarkdownRule {
  id: number
  scope: string
  categoryId?: string | null
  categoryName?: string | null
  categoryCode?: string | null
  daysToExpiry: number
  discountPercent: number
  floorPercentOfCost: number
  createdAt: string
  lastModifiedAt: string
  deleted: boolean
}

export interface UpsertMarkdownRuleRequest {
  categoryId?: string | null
  daysToExpiry: number
  discountPercent: number
  floorPercentOfCost: number
}

export type MarkdownRecommendationsResponse = ApiResponse<MarkdownRecommendation[]>
export type MarkdownApplyApiResponse = ApiResponse<MarkdownApplyResponse>
export type MarkdownRulesResponse = ApiResponse<MarkdownRule[]>
export type MarkdownRuleApiResponse = ApiResponse<MarkdownRule>
