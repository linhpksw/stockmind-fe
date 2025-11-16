import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import { AxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuthStore } from '../stores/auth-store'

const DEMO_PASSWORD = '123' as const

const demoAccounts = [
  {
    role: 'Admin',
    username: 'admin',
    summary: 'Full control across StockMind modules.',
  },
  {
    role: 'Inventory Manager',
    username: 'inventory',
    summary: 'Owns replenishment, markdowns, and stock policies.',
  },
  {
    role: 'Buyer',
    username: 'buyer',
    summary: 'Plans assortment and negotiates supplier orders.',
  },
  {
    role: 'Store Staff',
    username: 'store',
    summary: 'Executes floor tasks and inventory counts.',
  },
  {
    role: 'Cashier (Mock)',
    username: 'cashier',
    summary: 'Tests POS-facing workflows with limited access.',
  },
] as const

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

  const handleUseDemoAccount = (username: string) => {
    setCredentials({ username, password: DEMO_PASSWORD })
  }

  const getFriendlyError = (err: unknown): string => {
    if (err instanceof AxiosError && err.response?.status === 401) {
      return 'Invalid username or password.'
    }
    if (err instanceof Error) {
      return err.message
    }
    return 'Login failed'
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 6, md: 8 },
        px: 2,
        backgroundImage: theme =>
          `radial-gradient(circle at 15% 20%, ${theme.palette.primary.light}11, transparent 25%),
           radial-gradient(circle at 80% 0%, ${theme.palette.secondary.light}14, transparent 22%),
           linear-gradient(120deg, ${theme.palette.background.default}, ${theme.palette.grey[50]})`,
      }}
    >
      <Container component="main" maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            border: theme => `2px dashed ${theme.palette.divider}`,
            borderRadius: 3,
            bgcolor: 'background.paper',
          }}
        >
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="overline" letterSpacing={2} color="primary.main">
                StockMind
              </Typography>
              <Typography variant="h5" fontWeight={800} mt={0.5}>
                Welcome back
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to continue
              </Typography>
            </Box>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems="stretch"
              justifyContent="space-between"
            >
              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  p: { xs: 2.5, sm: 3 },
                  borderStyle: 'dashed',
                }}
              >
                <Stack spacing={2} height="100%" component="form" onSubmit={handleSubmit}>
                  <TextField
                    label="Username"
                    value={credentials.username}
                    onChange={handleFieldChange('username')}
                    required
                    autoFocus
                    size="small"
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={credentials.password}
                    onChange={handleFieldChange('password')}
                    required
                    size="small"
                  />
                  {mutation.isError && (
                    <Alert severity="error">{getFriendlyError(mutation.error)}</Alert>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={mutation.isPending}
                    fullWidth
                  >
                    {mutation.isPending ? 'Signing in…' : 'Sign in'}
                  </Button>
                </Stack>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  p: { xs: 2.5, sm: 3 },
                  borderStyle: 'dashed',
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Quick test accounts (tap to autofill)
                </Typography>
                <Stack spacing={1.25}>
                  {demoAccounts.slice(0, 4).map(account => (
                    <Stack
                      key={account.username}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        border: theme => `1px dashed ${theme.palette.divider}`,
                        borderRadius: 2,
                        p: 1.25,
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Box>
                        <Typography fontWeight={700}>{account.role}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {account.summary}
                        </Typography>
                        <Typography variant="body2" mt={0.5}>
                          {account.username} / {DEMO_PASSWORD}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleUseDemoAccount(account.username)}
                      >
                        Autofill
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}

export default LoginPage
