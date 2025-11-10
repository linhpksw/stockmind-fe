import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '../stores/auth-store'

interface GuestRouteProps {
  children: ReactNode
}

export const GuestRoute = ({ children }: GuestRouteProps) => {
  const token = useAuthStore(state => state.token)

  if (token) {
    return <Navigate to="/app" replace />
  }

  return children
}
