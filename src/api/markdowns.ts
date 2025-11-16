import { apiClient } from './client'
import type { ApiResponse } from '../types/common'
import type {
  MarkdownApplyApiResponse,
  MarkdownApplyBulkApiResponse,
  MarkdownApplyBulkRequest,
  MarkdownApplyBulkResponse,
  MarkdownApplyRequest,
  MarkdownApplyResponse,
  MarkdownRecommendation,
  MarkdownRecommendationsResponse,
  MarkdownRule,
  MarkdownRuleApiResponse,
  MarkdownRulesResponse,
  UpsertMarkdownRuleRequest,
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

export const applyAllMarkdowns = async (
  payload: MarkdownApplyBulkRequest,
): Promise<MarkdownApplyBulkResponse> => {
  const { data } = await apiClient.post<MarkdownApplyBulkApiResponse>(
    '/markdowns/apply/bulk',
    payload,
  )
  return unwrap(data)
}

export const listMarkdownRules = async (): Promise<MarkdownRule[]> => {
  const { data } = await apiClient.get<MarkdownRulesResponse>('/markdowns/rules')
  return unwrap(data)
}

export const createMarkdownRule = async (
  payload: UpsertMarkdownRuleRequest,
): Promise<MarkdownRule> => {
  const { data } = await apiClient.post<MarkdownRuleApiResponse>('/markdowns/rules', payload)
  return unwrap(data)
}

export const updateMarkdownRule = async (
  ruleId: number,
  payload: UpsertMarkdownRuleRequest,
): Promise<MarkdownRule> => {
  const { data } = await apiClient.put<MarkdownRuleApiResponse>(
    `/markdowns/rules/${ruleId}`,
    payload,
  )
  return unwrap(data)
}

export const deleteMarkdownRule = async (ruleId: number): Promise<MarkdownRule> => {
  const { data } = await apiClient.delete<MarkdownRuleApiResponse>(`/markdowns/rules/${ruleId}`)
  return unwrap(data)
}

export const revertLotSaleDecision = async (decisionId: number): Promise<boolean> => {
  const { data } = await apiClient.post<ApiResponse<boolean>>(
    `/markdowns/decisions/${decisionId}/revert`,
  )
  return unwrap(data)
}
