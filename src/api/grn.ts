import { apiClient } from './client'
import { unwrapPage } from './helpers'
import type { PageResponse } from '../types/common'
import type { GrnSummary, GrnSummaryPage } from '../types/grn'

type GrnSummaryResponse = PageResponse<GrnSummary>
const SUMMARY_PAGE_SIZE = 100

export const syncReceiving = async (pageNum: number, pageSize: number): Promise<GrnSummaryPage> => {
  const { data } = await apiClient.post<GrnSummaryResponse>('/api/grns/sync', null, {
    params: { pageNum, pageSize },
  })
  return unwrapPage(data)
}

export const acceptGrn = async (poId: number): Promise<GrnSummary> => {
  const { data } = await apiClient.post<{ data: GrnSummary }>(`/api/grns/po/${poId}/accept`)
  return data.data
}

export const cancelGrn = async (poId: number): Promise<GrnSummary> => {
  const { data } = await apiClient.post<{ data: GrnSummary }>(`/api/grns/po/${poId}/cancel`)
  return data.data
}

export const fetchAllGrnSummaries = async (): Promise<GrnSummary[]> => {
  const aggregated: GrnSummary[] = []
  let pageNum = 1
  let total = Number.POSITIVE_INFINITY

  while (aggregated.length < total) {
    const page = await listGrnSummary(pageNum, SUMMARY_PAGE_SIZE)
    aggregated.push(...page.data)
    total = page.total

    if (page.data.length === 0) {
      break
    }

    pageNum += 1
  }

  return aggregated
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
