import { apiClient } from './client'
import { unwrapPage } from './helpers'
import type { PageResponse } from '../types/common'
import type { InventoryProductSummary, InventoryProductSummaryPage } from '../types/inventory'

type InventorySummaryResponse = PageResponse<InventoryProductSummary>

export const syncInventory = async (
  pageNum: number,
  pageSize: number,
): Promise<InventoryProductSummaryPage> => {
  const { data } = await apiClient.post<InventorySummaryResponse>('/api/inventory/sync', null, {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
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
