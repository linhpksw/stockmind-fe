import { apiClient } from './client'
import { unwrap } from './helpers'
import type {
  CreateCustomerRequest,
  CreateCustomerResponse,
  Customer,
  CustomerResponse,
} from '../types/customers'

export const lookupCustomerByPhone = async (phoneNumber: string): Promise<Customer | null> => {
  const { data } = await apiClient.get<CustomerResponse>('/api/customers/lookup', {
    params: { phoneNumber },
  })
  return unwrap(data)
}

export const createCustomer = async (payload: CreateCustomerRequest): Promise<Customer> => {
  const { data } = await apiClient.post<CreateCustomerResponse>('/api/customers', payload)
  return unwrap(data)
}
