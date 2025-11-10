import { apiClient } from './client'
import type {
  InventoryAdjustmentApiResponse,
  InventoryAdjustmentRequest,
  InventoryAdjustmentResponse,
  InventoryLedger,
} from '../types/inventory'
import { unwrap } from './helpers'

export const getInventoryLedger = async (productId: string): Promise<InventoryLedger> => {
  const { data } = await apiClient.get<InventoryLedger>(`/api/inventory/${productId}`)
  return data
}

export const adjustInventory = async (
  payload: InventoryAdjustmentRequest,
): Promise<InventoryAdjustmentResponse> => {
  const { data } = await apiClient.post<InventoryAdjustmentApiResponse>(
    '/api/inventory/adjustments',
    payload,
  )
  return unwrap(data)
}
