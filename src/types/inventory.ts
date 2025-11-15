export interface InventoryLotSummary {
  lotId: number
  lotCode: string
  receivedAt?: string | null
  expiryDate?: string | null
  qtyOnHand: number
  unitCost: number
}

import type { PageResponse } from './common'

export interface InventoryProductSummary {
  productId: number
  skuCode: string
  name: string
  categoryName?: string | null
  supplierName?: string | null
  uom: string
  mediaUrl?: string | null
  onHand: number
  lots: InventoryLotSummary[]
}

export type InventoryProductSummaryPage = PageResponse<InventoryProductSummary>
