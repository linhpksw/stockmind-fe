import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme =>
          `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.grey[900]})`,
        display: 'flex',
        alignItems: 'center',
        py: { xs: 6, md: 8 },
        px: 2,
      }}
    >
      <Container component="main" maxWidth="lg">
        <Paper
          elevation={16}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              flex: 1,
              background:
                'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 45%), #050b1e',
              color: 'common.white',
              p: { xs: 4, sm: 6 },
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              justifyContent: 'center',
            }}
          >
            <Box>
              <Typography variant="overline" letterSpacing={2} color="primary.light">
                StockMind
              </Typography>
              <Typography variant="h4" fontWeight={800} mt={1}>
                Inventory intelligence for modern retail teams
              </Typography>
              <Typography variant="body1" color="grey.200" mt={1.5}>
                Sign in to orchestrate buyers, store staff, and cashiers from a single source of
                truth. Rapid insights, proactive alerts, and confident decision making.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                textTransform="uppercase"
                letterSpacing={1}
                color="grey.300"
              >
                Quick test accounts
              </Typography>
              <Stack spacing={1.5} mt={2}>
                {demoAccounts.map(account => (
                  <Box
                    key={account.username}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.18)',
                      p: 2,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2,
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {account.role}
                      </Typography>
                      <Typography variant="body2" color="grey.100">
                        Username:{' '}
                        <Box component="span" fontWeight={600}>
                          {account.username}
                        </Box>{' '}
                        · Password:{' '}
                        <Box component="span" fontWeight={600}>
                          {DEMO_PASSWORD}
                        </Box>
                      </Typography>
                      <Typography variant="caption" color="grey.300">
                        {account.summary}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      color="inherit"
                      size="small"
                      onClick={() => handleUseDemoAccount(account.username)}
                    >
                      Autofill
                    </Button>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>
          <Box
            sx={{
              flex: 1,
              p: { xs: 4, sm: 6 },
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Stack spacing={3} width="100%" component="form" onSubmit={handleSubmit}>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Welcome back
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign in with your StockMind credentials to continue
                </Typography>
              </Box>
              <Divider />
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
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}

export default LoginPage
