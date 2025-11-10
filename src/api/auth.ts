import { apiClient } from './client'
import type { LoginApiResponse, LoginRequest, LoginResponse } from '../types/auth'
import { unwrap } from './helpers'

export const login = async (payload: LoginRequest): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginApiResponse>('/api/auth/login', payload)
  return unwrap(data)
}
