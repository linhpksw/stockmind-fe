export interface PurchaseOrderItemSummary {
  productId: number
  productName: string
  uom: string
  qty: number
  unitCost: number
  expectedDate?: string | null
  mediaUrl?: string | null
}

import type { ApiResponse, PageResponse } from './common'

export interface PurchaseOrderSummary {
  poId: number
  supplierId: number
  supplierName: string
  status: string
  createdAt: string
  totalQty: number
  totalCost: number
  items: PurchaseOrderItemSummary[]
}

export type PurchaseOrderSummaryPage = PageResponse<PurchaseOrderSummary>

export interface CreatePurchaseOrderItemRequest {
  productId: string
  qty: number
  unitCost: number
  expectedDate: string
}

export interface CreatePurchaseOrderRequest {
  supplierId: string
  items: CreatePurchaseOrderItemRequest[]
}

export interface PurchaseOrder {
  id: string
  status: string
  createdAt: string
}

export type PurchaseOrderResponse = ApiResponse<PurchaseOrder>
