import type { ApiResponse, PageResponse } from './common'

export interface Supplier {
  id: string
  name: string
  contact?: string | null
  leadTimeDays: number
  createdAt: string
  lastModifiedAt: string
  deleted: boolean
  deletedAt?: string | null
}

export interface CreateSupplierRequest {
  name: string
  contact?: string
  leadTimeDays: number
}

export interface UpdateSupplierRequest {
  name?: string
  contact?: string
  leadTimeDays?: number
}

export interface SupplierImportRow {
  supplierId?: string
  name: string
  contact?: string
  leadTimeDays?: number
}

export interface ImportSuppliersRequest {
  rows: SupplierImportRow[]
}

export interface ImportSuppliersResponse {
  created: number
  updated: number
  skippedInvalid: number
  total: number
}

export type SupplierResponse = ApiResponse<Supplier>
export type SuppliersPageResponse = PageResponse<Supplier>
