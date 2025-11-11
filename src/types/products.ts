import type { ApiResponse } from './common'

export interface Product {
  id: string
  skuCode: string
  name: string
  categoryId?: string | null
  isPerishable: boolean
  shelfLifeDays?: number | null
  uom: string
  price: number
  minStock: number
  leadTimeDays: number
  supplierId?: string | null
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
}

export type ProductResponse = ApiResponse<Product>
