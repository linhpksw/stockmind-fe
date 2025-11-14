import { apiClient } from './client'
import { unwrap } from './helpers'
import type {
  ImportMarginProfilesResponse,
  MarginProfile,
  MarginProfileImportRow,
  MarginProfileResponse,
  MarginProfilesResponse,
  UpdateMarginProfileRequest,
} from '../types/margins'
import type { ApiResponse } from '../types/common'

export const listMarginProfiles = async (): Promise<MarginProfile[]> => {
  const { data } = await apiClient.get<MarginProfilesResponse>('/api/margin-profiles')
  return unwrap(data)
}

export const updateMarginProfile = async (
  id: number,
  payload: UpdateMarginProfileRequest,
): Promise<MarginProfile> => {
  const { data } = await apiClient.put<MarginProfileResponse>(`/api/margin-profiles/${id}`, payload)
  return unwrap(data)
}

export const importMarginProfiles = async (
  rows: MarginProfileImportRow[],
): Promise<ImportMarginProfilesResponse> => {
  const { data } = await apiClient.post<ApiResponse<ImportMarginProfilesResponse>>(
    '/api/margin-profiles/import',
    { rows },
  )
  return unwrap(data)
}
