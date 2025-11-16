import type { ApiResponse } from './common'

export interface Customer {
  id: string
  fullName: string
  phoneNumber: string
  email?: string | null
  loyaltyCode?: string | null
  loyaltyPoints: number
  createdAt: string
  isUpdated?: boolean
}

export interface CreateCustomerRequest {
  fullName: string
  phoneNumber: string
  email: string
  loyaltyCode?: string
}

export type CustomerResponse = ApiResponse<Customer | null>
export type CreateCustomerResponse = ApiResponse<Customer>
