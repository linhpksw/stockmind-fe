import type { ApiResponse } from './common'

export interface SalesOrderContext {
  orderCode: string
  generatedAt: string
  cashierId: number
  cashierName: string
  loyaltyRedemptionStep: number
  loyaltyValuePerStep: number
  loyaltyEarnRate: number
}

export interface SellableLot {
  lotId: number
  lotCode: string
  productId: number
  productName: string
  skuCode: string
  uom: string
  qtyOnHand: number
  expiryDate?: string | null
  receivedAt: string
  mediaUrl?: string | null
  supplierName?: string | null
  categoryName?: string | null
  parentCategoryName?: string | null
  isPerishable: boolean
  unitCost: number
  targetMarginPct: number
  minMarginPct: number
  unitPrice: number
  discountPercent: number
  suggestedQty?: number | null
  hasPricingGaps: boolean
}

export interface SellableLotQuery {
  query?: string
  parentCategoryIds?: number[]
  categoryIds?: number[]
  supplierIds?: number[]
  limit?: number
}

export interface CreateSalesOrderLineInput {
  productId: number
  lotId: number
  quantity: number
}

export interface CreateSalesOrderRequest {
  orderCode?: string
  customerId?: number
  loyaltyPointsToRedeem: number
  lines: CreateSalesOrderLineInput[]
}

export interface SalesOrderLineSummary {
  productId: number
  lotId: number
  productName: string
  lotCode: string
  uom: string
  quantity: number
  unitPrice: number
  discountPercent: number
  lineTotal: number
}

export interface SalesOrderSummary {
  orderId: string
  orderCode: string
  createdAt: string
  cashierName: string
  customerName?: string | null
  itemsCount: number
  subtotal: number
  discountTotal: number
  total: number
  loyaltyAmountRedeemed: number
  loyaltyPointsEarned: number
  loyaltyPointsRedeemed: number
  lines: SalesOrderLineSummary[]
}

export interface PendingSalesOrder {
  pendingId: number
  confirmationToken: string
  expiresAt: string
  customerEmail?: string | null
}

export interface CreateSalesOrderResponse {
  status: 'CONFIRMED' | 'PENDING'
  order?: SalesOrderSummary
  pending?: PendingSalesOrder
}

export interface PendingSalesOrderStatus {
  pendingId: number
  status: string
  expiresAt: string
  confirmedAt?: string | null
  isConfirmed: boolean
}

export type SalesOrderContextResponse = ApiResponse<SalesOrderContext>
export type SellableLotResponse = ApiResponse<SellableLot[]>
export type CreateSalesOrderApiResponse = ApiResponse<CreateSalesOrderResponse>
