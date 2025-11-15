import {
  AutoAwesomeMotion,
  Category,
  Dashboard,
  Inventory2,
  LocalShipping,
  ReceiptLong,
  Recycling,
  ShoppingCart,
  Warehouse,
} from '@mui/icons-material'
import {
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SIDEBAR_WIDTH } from '../../constants/layout'
import { useAuthStore } from '../../stores/auth-store'

type MasterDataStatusKey =
  | 'suppliers'
  | 'categories'
  | 'products'
  | 'margins'
  | 'purchaseOrders'
  | 'receiving'
  | 'inventory'

type NavItem = {
  label: string
  path: string
  icon: ReactNode
  sequence?: string
  statusKey?: MasterDataStatusKey
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/app', icon: <Dashboard fontSize="small" /> },
  {
    label: 'Suppliers',
    path: '/app/suppliers',
    icon: <LocalShipping fontSize="small" />,
    sequence: 'S1',
    statusKey: 'suppliers',
  },
  {
    label: 'Categories',
    path: '/app/categories',
    icon: <Category fontSize="small" />,
    sequence: 'S2',
    statusKey: 'categories',
  },
  {
    label: 'Products',
    path: '/app/products',
    icon: <Inventory2 fontSize="small" />,
    sequence: 'S3',
    statusKey: 'products',
  },
  {
    label: 'Margins',
    path: '/app/margins',
    icon: <AutoAwesomeMotion fontSize="small" />,
    sequence: 'S4',
    statusKey: 'margins',
  },
  {
    label: 'Purchase Orders',
    path: '/app/purchase-orders',
    icon: <ShoppingCart fontSize="small" />,
    sequence: 'S5',
    statusKey: 'purchaseOrders',
  },
  {
    label: 'Receiving (GRN)',
    path: '/app/receiving',
    icon: <ReceiptLong fontSize="small" />,
    sequence: 'S6',
    statusKey: 'receiving',
  },
  {
    label: 'Inventory',
    path: '/app/inventory',
    icon: <Warehouse fontSize="small" />,
    sequence: 'S7',
    statusKey: 'inventory',
  },
  { label: 'Markdowns', path: '/app/markdowns', icon: <Inventory2 fontSize="small" /> },
  { label: 'Waste', path: '/app/waste', icon: <Recycling fontSize="small" /> },
]

interface SidebarNavProps {
  mobileOpen: boolean
  onClose: () => void
}

export const SidebarNav = ({ mobileOpen, onClose }: SidebarNavProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const handleLogout = useCallback(() => {
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])
  const initials =
    user?.fullName
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2) || 'AD'

  const content = useMemo(
    () => (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box px={3} py={3}>
          <Typography variant="h5" fontWeight={700}>
            StockMind
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Inventory control cockpit
          </Typography>
        </Box>
        <Divider />
        <List sx={{ flexGrow: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path
            return (
              <ListItemButton
                key={item.path}
                selected={active}
                onClick={() => {
                  navigate(item.path)
                  onClose()
                }}
                sx={{
                  borderRadius: 2,
                  mx: 2,
                  my: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ noWrap: true, sx: { fontSize: 14 } }}
                  />
                </Box>
                {item.sequence && (
                  <Box
                    sx={{
                      borderRadius: '50%',
                      width: 30,
                      height: 30,
                      whiteSpace: 'nowrap',
                      bgcolor: active ? 'primary.main' : 'grey.200',
                      color: active ? 'primary.contrastText' : 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {item.sequence}
                  </Box>
                )}
              </ListItemButton>
            )
          })}
        </List>
        <Divider />
        <Box px={3} py={3} borderTop="1px solid" borderColor="divider">
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ width: 44, height: 44 }}>{initials}</Avatar>
              <Box>
                <Typography fontWeight={700}>{user?.fullName ?? 'Administrator'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.roles?.join(', ') || 'ADMIN'}
                </Typography>
              </Box>
            </Stack>
            <Button variant="outlined" size="small" onClick={handleLogout}>
              Logout
            </Button>
            <Typography variant="caption" color="text.secondary">
              v{import.meta.env.VITE_APP_VERSION ?? '0.1.0'}
            </Typography>
          </Stack>
        </Box>
      </Box>
    ),
    [handleLogout, initials, location.pathname, navigate, onClose, user?.fullName, user?.roles],
  )

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH },
        }}
      >
        {content}
      </Drawer>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            borderRight: 0,
            backgroundColor: 'background.paper',
          },
        }}
      >
        {content}
      </Drawer>
    </>
  )
}
