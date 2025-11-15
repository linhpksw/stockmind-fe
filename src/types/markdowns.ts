import type { ApiResponse } from './common'

export interface MarkdownRecommendation {
  productId: string
  productName?: string
  lotId: string
  lotEntityId: number
  categoryId?: number | null
  categoryName?: string | null
  unitCost: number
  qtyReceived: number
  lotSaleDecisionId?: number | null
  lotSaleDecisionApplied?: boolean | null
  receivedAt: string
  daysToExpiry: number
  suggestedDiscountPct: number
  floorPctOfCost: number
  floorSafeDiscountPct?: number | null
  requiresFloorOverride?: boolean
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

export interface MarkdownApplyBulkRequest {
  items: MarkdownApplyRequest[]
}

export interface MarkdownApplyBulkResponse {
  requested: number
  applied: number
  failed: number
  errors: string[]
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
export type MarkdownApplyBulkApiResponse = ApiResponse<MarkdownApplyBulkResponse>
export type MarkdownRulesResponse = ApiResponse<MarkdownRule[]>
export type MarkdownRuleApiResponse = ApiResponse<MarkdownRule>
