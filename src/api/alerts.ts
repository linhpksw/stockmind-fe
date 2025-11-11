import { apiClient } from './client'
import type { AlertsAggregate } from '../types/alerts'
import type { ApiResponse } from '../types/common'
import { unwrap } from './helpers'

export const getAlerts = async (): Promise<AlertsAggregate> => {
  const { data } = await apiClient.get<ApiResponse<AlertsAggregate>>('/api/alerts')
  return unwrap(data)
}
