import { apiClient } from './client'
import type {
  CreateSupplierRequest,
  Supplier,
  SupplierResponse,
  SuppliersPageResponse,
} from '../types/suppliers'
import { unwrap, unwrapPage } from './helpers'

interface ListParams {
  pageNum?: number
  pageSize?: number
  query?: string
}

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

export const createSupplier = async (payload: CreateSupplierRequest): Promise<Supplier> => {
  const { data } = await apiClient.post<SupplierResponse>('/api/suppliers', payload)
  return unwrap(data)
}
