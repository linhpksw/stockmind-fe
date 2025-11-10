import { apiClient } from './client'
import type { CreateGrnRequest, GrnResponse, GrnResponseDto } from '../types/grn'
import { unwrap } from './helpers'

export const createGrn = async (payload: CreateGrnRequest): Promise<GrnResponseDto> => {
  const { data } = await apiClient.post<GrnResponse>('/api/grns', payload)
  return unwrap(data)
}

export const getGrnById = async (id: number): Promise<GrnResponseDto> => {
  const { data } = await apiClient.get<GrnResponse>(`/api/grns/${id}`)
  return unwrap(data)
}
