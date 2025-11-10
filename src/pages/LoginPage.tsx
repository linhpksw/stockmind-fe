import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuthStore } from '../stores/auth-store'

export const LoginPage = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const navigate = useNavigate()
  const location = useLocation()
  const loginStore = useAuthStore(state => state.login)

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: data => {
      loginStore(data)
      const redirectState = location.state as { from?: { pathname?: string } } | null
      const redirectPath = redirectState?.from?.pathname ?? '/app'
      navigate(redirectPath, { replace: true })
    },
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    mutation.mutate(credentials)
  }

  const handleFieldChange =
    (field: 'username' | 'password') => (event: ChangeEvent<HTMLInputElement>) => {
      setCredentials(prev => ({ ...prev, [field]: event.target.value }))
    }

  return (
    <Container
      component="main"
      maxWidth="xs"
      sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit}>
          <Box textAlign="center">
            <Typography variant="h5" fontWeight={700}>
              StockMind Console
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in with your corporate credentials
            </Typography>
          </Box>
          <TextField
            label="Username"
            value={credentials.username}
            onChange={handleFieldChange('username')}
            required
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            value={credentials.password}
            onChange={handleFieldChange('password')}
            required
          />
          {mutation.isError && (
            <Alert severity="error">
              {mutation.error instanceof Error ? mutation.error.message : 'Login failed'}
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={mutation.isPending}
            fullWidth
          >
            {mutation.isPending ? 'Signing in...' : 'Sign in'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  )
}

export default LoginPage
