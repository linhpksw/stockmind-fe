import { apiClient } from './client'
import type { AlertsAggregate } from '../types/alerts'

export const getAlerts = async (): Promise<AlertsAggregate> => {
  const { data } = await apiClient.get<AlertsAggregate>('/api/alerts')
  return data
}
