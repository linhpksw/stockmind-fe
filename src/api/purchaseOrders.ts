import { apiClient } from './client'
import type { CreatePoRequest, PoDto, PoResponse } from '../types/purchaseOrders'
import { unwrap } from './helpers'

export const createPurchaseOrder = async (payload: CreatePoRequest): Promise<PoDto> => {
  const { data } = await apiClient.post<PoResponse>('/api/pos', payload)
  return unwrap(data)
}

export const getPurchaseOrder = async (id: number): Promise<PoDto> => {
  const { data } = await apiClient.get<PoResponse>(`/api/pos/${id}`)
  return unwrap(data)
}
