import { apiClient } from './client'
import { unwrap } from './helpers'
import type {
  CreateSalesOrderRequest,
  CreateSalesOrderResponse,
  PendingSalesOrderStatus,
  SalesOrderContext,
  SellableLot,
  SellableLotQuery,
} from '../types/salesOrders'
import type { ApiResponse } from '../types/common'

export const fetchSalesOrderContext = async (): Promise<SalesOrderContext> => {
  const { data } = await apiClient.get<ApiResponse<SalesOrderContext>>('/api/sales-orders/context')
  return unwrap(data)
}

const serializeQueryParams = (params: SellableLotQuery): string => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    if (Array.isArray(value)) {
      value
        .filter(item => item !== undefined && item !== null && !Number.isNaN(Number(item)))
        .forEach(item => {
          searchParams.append(key, String(item))
        })
      return
    }
    searchParams.append(key, String(value))
  })
  return searchParams.toString()
}

export const searchSellableLots = async (query: SellableLotQuery): Promise<SellableLot[]> => {
  const { data } = await apiClient.get<ApiResponse<SellableLot[]>>(
    '/api/sales-orders/available-items',
    {
      params: query,
      paramsSerializer: serializeQueryParams,
    },
  )
  return unwrap(data)
}

export const createSalesOrder = async (
  payload: CreateSalesOrderRequest,
): Promise<CreateSalesOrderResponse> => {
  const { data } = await apiClient.post<ApiResponse<CreateSalesOrderResponse>>(
    '/api/sales-orders',
    payload,
  )
  return unwrap(data)
}

export const getPendingSalesOrderStatus = async (
  pendingId: number,
): Promise<PendingSalesOrderStatus> => {
  const { data } = await apiClient.get<ApiResponse<PendingSalesOrderStatus>>(
    `/api/sales-orders/pending/${pendingId}`,
  )
  return unwrap(data)
}

export const cancelPendingSalesOrder = async (pendingId: number): Promise<void> => {
  await apiClient.delete(`/api/sales-orders/pending/${pendingId}`)
}
