import type { ApiResponse } from './common'

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthenticatedUser {
  userId: number
  username: string
  fullName: string
  email?: string | null
  phoneNumber?: string | null
  roles: string[]
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresAt: string
  expiresIn: number
  user: AuthenticatedUser
}

export type LoginApiResponse = ApiResponse<LoginResponse>
