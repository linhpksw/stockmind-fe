export interface PurchaseOrderItemSummary {
  productId: number
  productName: string
  uom: string
  qty: number
  unitCost: number
  expectedDate?: string | null
  mediaUrl?: string | null
}

import type { PageResponse } from './common'

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
