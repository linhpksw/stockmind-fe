import { apiClient } from './client'
import { unwrap } from './helpers'
import type {
  ImportProductsRequest,
  ImportProductsResponse,
  Product,
  ProductRequest,
  ProductResponse,
} from '../types/products'
import type { ApiResponse } from '../types/common'

export const createProduct = async (payload: ProductRequest): Promise<Product> => {
  const { data } = await apiClient.post<ProductResponse>('/api/products', payload)
  return unwrap(data)
}

export const updateProduct = async (id: string, payload: ProductRequest): Promise<Product> => {
  const { data } = await apiClient.put<ProductResponse>(`/api/products/${id}`, payload)
  return unwrap(data)
}

export const getProductById = async (id: string): Promise<Product> => {
  const { data } = await apiClient.get<ProductResponse>(`/api/products/${id}`)
  return unwrap(data)
}

export const listProducts = async (): Promise<Product[]> => {
  const { data } = await apiClient.get<ApiResponse<Product[]>>('/api/products')
  return unwrap(data)
}

export const importProducts = async (
  payload: ImportProductsRequest,
): Promise<ImportProductsResponse> => {
  const { data } = await apiClient.post<ApiResponse<ImportProductsResponse>>(
    '/api/products/import',
    payload,
  )
  return unwrap(data)
}
