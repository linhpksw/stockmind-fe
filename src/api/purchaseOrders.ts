import { apiClient } from './client'
import { unwrapPage } from './helpers'
import type { PageResponse } from '../types/common'
import type { PurchaseOrderSummary, PurchaseOrderSummaryPage } from '../types/purchaseOrders'

type PurchaseOrderSummaryResponse = PageResponse<PurchaseOrderSummary>

export const syncPurchaseOrders = async (
  pageNum: number,
  pageSize: number,
): Promise<PurchaseOrderSummaryPage> => {
  const { data } = await apiClient.post<PurchaseOrderSummaryResponse>('/api/pos/sync', null, {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
}

export const listPurchaseOrderSummary = async (
  pageNum: number,
  pageSize: number,
): Promise<PurchaseOrderSummaryPage> => {
  const { data } = await apiClient.get<PurchaseOrderSummaryResponse>('/api/pos/summary', {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
}
