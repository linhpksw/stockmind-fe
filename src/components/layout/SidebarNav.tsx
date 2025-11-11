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
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SIDEBAR_WIDTH } from '../../constants/layout'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/app', icon: <Dashboard fontSize="small" /> },
  { label: 'Inventory', path: '/app/inventory', icon: <Warehouse fontSize="small" /> },
  { label: 'Products', path: '/app/products', icon: <Category fontSize="small" /> },
  { label: 'Suppliers', path: '/app/suppliers', icon: <LocalShipping fontSize="small" /> },
  {
    label: 'Purchase Orders',
    path: '/app/purchase-orders',
    icon: <ShoppingCart fontSize="small" />,
  },
  { label: 'Receiving (GRN)', path: '/app/receiving', icon: <ReceiptLong fontSize="small" /> },
  { label: 'Markdowns', path: '/app/markdowns', icon: <Inventory2 fontSize="small" /> },
  {
    label: 'Replenishment',
    path: '/app/replenishment',
    icon: <AutoAwesomeMotion fontSize="small" />,
  },
  { label: 'Waste', path: '/app/waste', icon: <Recycling fontSize="small" /> },
]

interface SidebarNavProps {
  mobileOpen: boolean
  onClose: () => void
}

export const SidebarNav = ({ mobileOpen, onClose }: SidebarNavProps) => {
  const location = useLocation()
  const navigate = useNavigate()

  const content = useMemo(
    () => (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box px={3} py={4}>
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
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            )
          })}
        </List>
        <Box px={3} py={2}>
          <Typography variant="caption" color="text.secondary">
            v{import.meta.env.VITE_APP_VERSION ?? '0.1.0'}
          </Typography>
        </Box>
      </Box>
    ),
    [location.pathname, navigate, onClose],
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
