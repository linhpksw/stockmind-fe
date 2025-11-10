import { apiClient } from './client'
import type { ReplenishmentResponse, ReplenishmentSuggestion } from '../types/replenishment'
import { unwrap } from './helpers'

export const getReplenishmentSuggestions = async (): Promise<ReplenishmentSuggestion[]> => {
  const { data } = await apiClient.get<ReplenishmentResponse>('/replenishments/suggestions')
  return unwrap(data)
}
