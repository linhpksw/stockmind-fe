import { apiClient } from './client'
import { unwrapPage } from './helpers'
import type { PageResponse } from '../types/common'
import type { GrnSummary, GrnSummaryPage } from '../types/grn'

type GrnSummaryResponse = PageResponse<GrnSummary>

export const syncReceiving = async (pageNum: number, pageSize: number): Promise<GrnSummaryPage> => {
  const { data } = await apiClient.post<GrnSummaryResponse>('/api/grns/sync', null, {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
}

export const listGrnSummary = async (
  pageNum: number,
  pageSize: number,
): Promise<GrnSummaryPage> => {
  const { data } = await apiClient.get<GrnSummaryResponse>('/api/grns/summary', {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
}
