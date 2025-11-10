import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthenticatedUser, LoginResponse } from '../types/auth'

const storage =
  typeof window !== 'undefined'
    ? createJSONStorage(() => localStorage)
    : createJSONStorage(() => ({
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      }))

interface AuthState {
  token: string | null
  tokenType: string | null
  expiresAt: string | null
  user: AuthenticatedUser | null
  login: (payload: LoginResponse) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      token: null,
      tokenType: null,
      expiresAt: null,
      user: null,
      login: payload =>
        set({
          token: payload.accessToken,
          tokenType: payload.tokenType,
          expiresAt: payload.expiresAt,
          user: payload.user,
        }),
      logout: () =>
        set({
          token: null,
          tokenType: null,
          expiresAt: null,
          user: null,
        }),
    }),
    {
      name: 'stockmind-auth',
      storage,
      partialize: state => ({
        token: state.token,
        tokenType: state.tokenType,
        expiresAt: state.expiresAt,
        user: state.user,
      }),
    },
  ),
)
