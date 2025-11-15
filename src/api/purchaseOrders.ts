import { apiClient } from './client'
import { unwrapPage } from './helpers'
import type { PageResponse } from '../types/common'
import type { PurchaseOrderSummary, PurchaseOrderSummaryPage } from '../types/purchaseOrders'

type PurchaseOrderSummaryResponse = PageResponse<PurchaseOrderSummary>
const SUMMARY_PAGE_SIZE = 100

export const syncPurchaseOrders = async (
  pageNum: number,
  pageSize: number,
): Promise<PurchaseOrderSummaryPage> => {
  const { data } = await apiClient.post<PurchaseOrderSummaryResponse>('/api/pos/sync', null, {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
}

export const fetchAllPurchaseOrderSummaries = async (): Promise<PurchaseOrderSummary[]> => {
  const aggregated: PurchaseOrderSummary[] = []
  let pageNum = 1
  let total = Number.POSITIVE_INFINITY

  while (aggregated.length < total) {
    const page = await listPurchaseOrderSummary(pageNum, SUMMARY_PAGE_SIZE)
    aggregated.push(...page.data)
    total = page.total

    if (page.data.length === 0) {
      break
    }

    pageNum += 1
  }

  return aggregated
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
