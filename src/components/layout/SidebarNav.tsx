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
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listSuppliers } from '../../api/suppliers'
import { fetchCategories } from '../../api/categories'
import { listProducts } from '../../api/products'
import { listMarginProfiles } from '../../api/margins'
import { SIDEBAR_WIDTH } from '../../constants/layout'

type MasterDataStatusKey = 'suppliers' | 'categories' | 'products' | 'margins'

type MasterDataStatus = Record<MasterDataStatusKey, boolean>

const DEFAULT_STATUS: MasterDataStatus = {
  suppliers: false,
  categories: false,
  products: false,
  margins: false,
}

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
  { label: 'Inventory', path: '/app/inventory', icon: <Warehouse fontSize="small" /> },
  {
    label: 'Purchase Orders',
    path: '/app/purchase-orders',
    icon: <ShoppingCart fontSize="small" />,
  },
  { label: 'Receiving (GRN)', path: '/app/receiving', icon: <ReceiptLong fontSize="small" /> },
  { label: 'Markdowns', path: '/app/markdowns', icon: <Inventory2 fontSize="small" /> },
  { label: 'Waste', path: '/app/waste', icon: <Recycling fontSize="small" /> },
]

const useMasterDataStatus = () => {
  return useQuery({
    queryKey: ['master-data-status'],
    queryFn: async (): Promise<MasterDataStatus> => {
      const [suppliersResult, categoriesResult, productsResult, marginsResult] =
        await Promise.allSettled([
          listSuppliers({ pageNum: 1, pageSize: 1 }),
          fetchCategories(),
          listProducts(),
          listMarginProfiles(),
        ])

      const status: MasterDataStatus = { ...DEFAULT_STATUS }

      if (suppliersResult.status === 'fulfilled') {
        status.suppliers = suppliersResult.value.data.length > 0
      }
      if (categoriesResult.status === 'fulfilled') {
        status.categories = categoriesResult.value.length > 0
      }
      if (productsResult.status === 'fulfilled') {
        status.products = productsResult.value.length > 0
      }
      if (marginsResult.status === 'fulfilled') {
        status.margins = marginsResult.value.length > 0
      }

      return status
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface SidebarNavProps {
  mobileOpen: boolean
  onClose: () => void
}

export const SidebarNav = ({ mobileOpen, onClose }: SidebarNavProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: masterDataStatus } = useMasterDataStatus()

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
            const isCompleted = item.statusKey ? masterDataStatus?.[item.statusKey] : false
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
                  <ListItemText primary={item.label} />
                </Box>
                {item.sequence && (
                  <Box
                    sx={{
                      borderRadius: '50%',
                      width: 30,
                      height: 30,
                      bgcolor: theme =>
                        isCompleted
                          ? theme.palette.success.main
                          : active
                            ? theme.palette.primary.main
                            : theme.palette.grey[200],
                      color: theme =>
                        isCompleted
                          ? theme.palette.success.contrastText
                          : active
                            ? theme.palette.primary.contrastText
                            : theme.palette.text.secondary,
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
        <Box px={3} py={2}>
          <Typography variant="caption" color="text.secondary">
            v{import.meta.env.VITE_APP_VERSION ?? '0.1.0'}
          </Typography>
        </Box>
      </Box>
    ),
    [location.pathname, masterDataStatus, navigate, onClose],
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
