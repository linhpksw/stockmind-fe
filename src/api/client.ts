import axios from 'axios'
import { useAuthStore } from '../stores/auth-store'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(config => {
  const { token, tokenType } = useAuthStore.getState()
  if (token) {
    config.headers.Authorization = `${tokenType ?? 'Bearer'} ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)
