import { apiClient } from './client'
import { unwrap } from './helpers'
import type {
  CategoryImportRow,
  CategoryNode,
  ImportCategoriesRequest,
  ImportCategoriesResponse,
} from '../types/categories'
import type { ApiResponse } from '../types/common'

export const fetchCategories = async (): Promise<CategoryNode[]> => {
  const { data } = await apiClient.get<ApiResponse<CategoryNode[]>>('/api/categories')
  return unwrap(data)
}

export const importCategories = async (
  payload: ImportCategoriesRequest,
): Promise<ImportCategoriesResponse> => {
  const { data } = await apiClient.post<ApiResponse<ImportCategoriesResponse>>(
    '/api/categories/import',
    payload,
  )
  return unwrap(data)
}

export type { CategoryImportRow }
