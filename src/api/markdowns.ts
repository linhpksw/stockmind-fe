import { apiClient } from './client'
import type {
  MarkdownApplyApiResponse,
  MarkdownApplyRequest,
  MarkdownApplyResponse,
  MarkdownRecommendation,
  MarkdownRecommendationsResponse,
} from '../types/markdowns'
import { unwrap } from './helpers'

export const getMarkdownRecommendations = async (
  days: number,
): Promise<MarkdownRecommendation[]> => {
  const { data } = await apiClient.get<MarkdownRecommendationsResponse>(
    '/markdowns/recommendations',
    { params: { days } },
  )
  return unwrap(data)
}

export const applyMarkdown = async (
  payload: MarkdownApplyRequest,
): Promise<MarkdownApplyResponse> => {
  const { data } = await apiClient.post<MarkdownApplyApiResponse>('/markdowns/apply', payload)
  return unwrap(data)
}
