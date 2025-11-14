import type { ApiResponse } from './common'

export interface MarginProfile {
  id: number
  parentCategoryId: number
  parentCategoryName: string
  marginProfile: string
  priceSensitivity: string
  minMarginPct: number
  targetMarginPct: number
  maxMarginPct: number
  notes?: string | null
  createdAt: string
  lastModifiedAt: string
}

export interface UpdateMarginProfileRequest {
  minMarginPct: number
  targetMarginPct: number
  maxMarginPct: number
}

export interface MarginProfileImportRow {
  parentCategoryId?: number
  parentCategoryName?: string
  marginProfile: string
  priceSensitivity: string
  minMarginPct: number
  targetMarginPct: number
  maxMarginPct: number
  notes?: string | null
}

export interface ImportMarginProfilesResponse {
  created: number
  updated: number
  skippedInvalid: number
  skippedMissingCategory: number
  total: number
}

export type MarginProfilesResponse = ApiResponse<MarginProfile[]>
export type MarginProfileResponse = ApiResponse<MarginProfile>
export type ImportMarginProfilesApiResponse = ApiResponse<ImportMarginProfilesResponse>
