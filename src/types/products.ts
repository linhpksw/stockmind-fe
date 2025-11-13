import type { ApiResponse } from './common'

export interface Product {
  id: string
  skuCode: string
  name: string
  categoryId?: string | null
  categoryName?: string | null
  isPerishable: boolean
  shelfLifeDays?: number | null
  uom: string
  price: number
  minStock: number
  leadTimeDays: number
  supplierId?: string | null
  brandName?: string | null
  mediaUrl?: string | null
  createdAt: string
  lastModifiedAt: string
  updatedAt?: string
}

export interface ProductRequest {
  skuCode: string
  name: string
  categoryId?: string
  isPerishable: boolean
  shelfLifeDays?: number | null
  uom: string
  price: number
  minStock: number
  leadTimeDays: number
  supplierId?: string
  mediaUrl?: string
}

export type ProductResponse = ApiResponse<Product>

export interface ProductImportRow {
  productId?: string | null
  skuCode: string
  name: string
  uom: string
  price: number
  mediaUrl?: string | null
  categoryName?: string | null
  brandName?: string | null
  isPerishable?: boolean | null
  shelfLifeDays?: number | null
  minStock?: number | null
  leadTimeDays?: number | null
}

export interface ImportProductsRequest {
  rows: ProductImportRow[]
}

export interface ImportProductsResponse {
  created: number
  updated: number
  skippedInvalid: number
  skippedMissingCategory: number
  skippedMissingSupplier: number
  total: number
}
