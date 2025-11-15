import { apiClient } from './client'
import { unwrapPage } from './helpers'
import type { PageResponse } from '../types/common'
import type { InventoryProductSummary, InventoryProductSummaryPage } from '../types/inventory'

type InventorySummaryResponse = PageResponse<InventoryProductSummary>
const SUMMARY_PAGE_SIZE = 100

export const syncInventory = async (
  pageNum: number,
  pageSize: number,
): Promise<InventoryProductSummaryPage> => {
  const { data } = await apiClient.post<InventorySummaryResponse>('/api/inventory/sync', null, {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
}

export const fetchAllInventorySummaries = async (): Promise<InventoryProductSummary[]> => {
  const aggregated: InventoryProductSummary[] = []
  let pageNum = 1
  let total = Number.POSITIVE_INFINITY

  while (aggregated.length < total) {
    const page = await listInventorySummary(pageNum, SUMMARY_PAGE_SIZE)
    aggregated.push(...page.data)
    total = page.total

    if (page.data.length === 0) {
      break
    }

    pageNum += 1
  }

  return aggregated
}

export const listInventorySummary = async (
  pageNum: number,
  pageSize: number,
): Promise<InventoryProductSummaryPage> => {
  const { data } = await apiClient.get<InventorySummaryResponse>('/api/inventory/summary', {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
}
