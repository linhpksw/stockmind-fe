import type { PageResponse } from './common'

export interface GrnItemSummary {
  productId: number
  productName: string
  qtyReceived: number
  unitCost: number
  lotCode?: string | null
  expiryDate?: string | null
  expectedDate?: string | null
  mediaUrl?: string | null
}

export interface GrnSummary {
  grnId: number
  poId: number
  supplierId: number
  supplierName: string
  receivedAt: string
  status: string
  totalQty: number
  totalCost: number
  items: GrnItemSummary[]
}

export type GrnSummaryPage = PageResponse<GrnSummary>
