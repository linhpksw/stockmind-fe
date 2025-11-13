import { apiClient } from './client'
import type {
  CreateSupplierRequest,
  ImportSuppliersRequest,
  ImportSuppliersResponse,
  Supplier,
  SupplierResponse,
  SuppliersPageResponse,
  UpdateSupplierRequest,
} from '../types/suppliers'
import type { ApiResponse } from '../types/common'
import { unwrap, unwrapPage } from './helpers'

interface ListParams {
  pageNum?: number
  pageSize?: number
  query?: string
}

const DIRECTORY_PAGE_SIZE = 100

export const listSuppliers = async (params: ListParams): Promise<SuppliersPageResponse> => {
  const { data } = await apiClient.get<SuppliersPageResponse>('/api/suppliers', {
    params: {
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      q: params.query,
    },
  })
  return unwrapPage(data)
}

export const fetchAllSuppliers = async (query?: string): Promise<Supplier[]> => {
  const aggregated: Supplier[] = []
  let pageNum = 1
  let total = Number.POSITIVE_INFINITY

  while (aggregated.length < total) {
    const page = await listSuppliers({
      pageNum,
      pageSize: DIRECTORY_PAGE_SIZE,
      query,
    })

    aggregated.push(...page.data)
    total = page.total

    if (page.data.length === 0 || aggregated.length >= total) {
      break
    }

    pageNum += 1
  }

  return aggregated
}

export const createSupplier = async (payload: CreateSupplierRequest): Promise<Supplier> => {
  const { data } = await apiClient.post<SupplierResponse>('/api/suppliers', payload)
  return unwrap(data)
}

export const updateSupplier = async (
  id: string,
  payload: UpdateSupplierRequest,
): Promise<Supplier> => {
  const { data } = await apiClient.patch<SupplierResponse>(`/api/suppliers/${id}`, payload)
  return unwrap(data)
}

export const importSuppliers = async (
  payload: ImportSuppliersRequest,
): Promise<ImportSuppliersResponse> => {
  const { data } = await apiClient.post<ApiResponse<ImportSuppliersResponse>>(
    '/api/suppliers/import',
    payload,
  )
  return unwrap(data)
}
