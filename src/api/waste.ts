import { apiClient } from './client'
import type { WasteRequest, WasteResponse, WasteResponseDto } from '../types/waste'
import { unwrap } from './helpers'

export const recordWaste = async (payload: WasteRequest): Promise<WasteResponseDto> => {
  const { data } = await apiClient.post<WasteResponse>('/waste', payload)
  return unwrap(data)
}
