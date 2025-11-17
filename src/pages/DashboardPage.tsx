import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Pagination,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlerts } from '../api/alerts'
import { listProducts } from '../api/products'
import { getReplenishmentSuggestions } from '../api/replenishment'
import { StatCard } from '../components/cards/StatCard'
import { SectionHeading } from '../components/common/SectionHeading'
import type { AlertsAggregate, LowStock } from '../types/alerts'
import type { ReplenishmentSuggestion } from '../types/replenishment'
import { setReplenishmentPrefill } from '../utils/replenishmentPrefill'

const EMPTY_ALERTS: AlertsAggregate = { lowStock: [], expirySoon: [], slowMovers: [] }
const EMPTY_REPLENISHMENT: ReplenishmentSuggestion[] = []
const REPLENISHMENT_PAGE_SIZE = 5
const PO_CREATE_DRAFT_STORAGE_KEY = 'po-create-draft'

const formatProductLabel = (productId: string | number) => `Product ID ${productId}`
const formatLotLabel = (lotId: string, lotCode?: string) =>
  lotCode && lotCode.trim().length > 0 ? `Lot ${lotCode.trim()}` : `Lot #${lotId}`
const resolveProductName = (
  productName: string | undefined,
  productId: string | number,
  fallbackName?: string,
) => {
  const trimmed = productName?.trim() || fallbackName?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : formatProductLabel(productId)
}
const formatUnits = (amount: number) => {
  const quantity = amount.toLocaleString()
  const suffix = Math.abs(amount) === 1 ? 'unit' : 'units'
  return `${quantity} ${suffix}`
}
const formatDays = (days: number) => `${days} day${days === 1 ? '' : 's'}`

const pruneDraftOrdersWithoutSupplier = () => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return
  }
  try {
    const raw = window.localStorage.getItem(PO_CREATE_DRAFT_STORAGE_KEY)
    if (!raw) {
      return
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.orders)) {
      return
    }
    const cleanedOrders = parsed.orders.filter((order: { supplierId?: string | null }) => {
      if (!order || typeof order !== 'object') {
        return false
      }
      const id = order.supplierId
      return typeof id === 'string' && id.trim().length > 0
    })
    if (cleanedOrders.length === parsed.orders.length) {
      return
    }
    if (cleanedOrders.length === 0) {
      window.localStorage.removeItem(PO_CREATE_DRAFT_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(
      PO_CREATE_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...parsed, orders: cleanedOrders }),
    )
  } catch {
    // ignore malformed drafts
  }
}

export const DashboardPage = () => {
  const navigate = useNavigate()
  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: getAlerts })
  const replenishmentQuery = useQuery({
    queryKey: ['replenishment'],
    queryFn: getReplenishmentSuggestions,
  })
  const alerts = alertsQuery.data ?? EMPTY_ALERTS
  const replenishment = replenishmentQuery.data ?? EMPTY_REPLENISHMENT
  const lowStockItems = alerts.lowStock
  const expiringLots = alerts.expirySoon
  const shouldFetchProductNames = useMemo(
    () =>
      lowStockItems.some(item => !item.productName || item.productName.trim().length === 0) ||
      expiringLots.length > 0 ||
      replenishment.length > 0,
    [expiringLots, lowStockItems, replenishment],
  )
  const productLookupQuery = useQuery({
    queryKey: ['products', 'lookup'],
    queryFn: async (): Promise<
      Record<string, { name: string; minStock?: number; supplierId?: string | null }>
    > => {
      const products = await listProducts()
      return products.reduce<
        Record<string, { name: string; minStock?: number; supplierId?: string | null }>
      >((acc, product) => {
        acc[product.id] = {
          name: product.name,
          minStock: product.minStock,
          supplierId: product.supplierId ?? null,
        }
        return acc
      }, {})
    },
    enabled: shouldFetchProductNames,
    staleTime: 5 * 60 * 1000,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [missingSupplierWarning, setMissingSupplierWarning] = useState<string | null>(null)

  useEffect(() => {
    setCurrentPage(1)
  }, [replenishment.length])

  if (alertsQuery.isLoading || replenishmentQuery.isLoading) {
    return <LinearProgress />
  }

  if (alertsQuery.isError) {
    return <Alert severity="error">Unable to load alerts</Alert>
  }

  const productLookup = productLookupQuery.data ?? {}
  const resolveProductNameById = (productId: string | number, providedName?: string) =>
    resolveProductName(providedName, productId, productLookup[String(productId)]?.name)
  const resolveProductSafetyStock = (productId: string | number) =>
    productLookup[String(productId)]?.minStock
  const getProductSupplierId = (productId: string | number) =>
    productLookup[String(productId)]?.supplierId
  const resolveLowStockProductName = (item: LowStock) =>
    resolveProductNameById(item.productId, item.productName)
  const handleCreatePoFromSuggestion = (item: ReplenishmentSuggestion) => {
    pruneDraftOrdersWithoutSupplier()
    const supplierId = getProductSupplierId(item.productId)
    if (!supplierId || `${supplierId}`.trim().length === 0) {
      setMissingSupplierWarning(
        `${resolveProductNameById(item.productId)} does not have a supplier assigned yet. Please assign a supplier before creating a purchase order.`,
      )
      return
    }
    setReplenishmentPrefill({
      productId: item.productId,
      suggestedQty: item.suggestedQty,
      clearDraftPlaceholders: true,
    })
    navigate('/app/purchase-orders')
  }
  const totalReplenishmentPages = Math.ceil(replenishment.length / REPLENISHMENT_PAGE_SIZE)
  const paginatedReplenishment = replenishment.slice(
    (currentPage - 1) * REPLENISHMENT_PAGE_SIZE,
    currentPage * REPLENISHMENT_PAGE_SIZE,
  )

  return (
    <Stack spacing={4}>
      <SectionHeading title="Inventory Pulse" subtitle="Stay ahead of low stock and expiry risk." />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <StatCard
            label="Low stock SKUs"
            value={alerts?.lowStock.length ?? 0}
            helperText="Below min stock."
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StatCard
            label="Lots expiring soon"
            value={alerts?.expirySoon.length ?? 0}
            helperText="Within configured window."
            accent="secondary"
          />
        </Grid>
      </Grid>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <SectionHeading title="Low stock watchlist" />
              <List dense>
                {alerts?.lowStock.slice(0, 6).map(item => (
                  <ListItem key={item.productId} divider>
                    <ListItemText
                      primary={resolveLowStockProductName(item)}
                      secondary={
                        <Typography component="span" variant="body2" color="text.secondary">
                          {formatProductLabel(item.productId)} •{' '}
                          <strong>{formatUnits(item.onHand)}</strong> on hand (minimum{' '}
                          <strong>{formatUnits(item.minStock)}</strong>)
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
                {alerts?.lowStock.length === 0 && (
                  <Typography color="text.secondary">All products above minimum stock.</Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <SectionHeading title="Expiring lots" />
              <List dense>
                {alerts?.expirySoon.slice(0, 6).map(item => (
                  <ListItem key={`${item.productId}-${item.lotId}`} divider>
                    <ListItemText
                      primary={`${resolveProductNameById(item.productId)} | ${formatLotLabel(item.lotId, item.lotCode)}`}
                      secondary={
                        <Typography component="span" variant="body2" color="text.secondary">
                          Expires in <strong>{formatDays(item.daysToExpiry)}</strong>
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
                {alerts?.expirySoon.length === 0 && (
                  <Typography color="text.secondary">No upcoming expiries.</Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Card>
        <CardContent>
          <SectionHeading
            title="Replenishment suggestions"
            subtitle="Calculated from the last 30 days of sales."
          />
          <Stack spacing={2}>
            {paginatedReplenishment.map(item => {
              const safetyStock = resolveProductSafetyStock(item.productId)
              return (
                <Box
                  key={item.productId}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  py={1}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">
                      {resolveProductNameById(item.productId)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Safety stock:{' '}
                      {typeof safetyStock === 'number' ? formatUnits(safetyStock) : 'Not set'}
                    </Typography>
                  </Stack>
                  {item.suggestedQty > 0 ? (
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() => handleCreatePoFromSuggestion(item)}
                    >
                      Suggest ordering {formatUnits(item.suggestedQty)}
                    </Button>
                  ) : (
                    <Chip color="success" label="Stock is healthy" />
                  )}
                </Box>
              )
            })}
            {replenishment.length === 0 && (
              <Typography color="text.secondary">
                No replenishment suggestions right now.
              </Typography>
            )}
            {totalReplenishmentPages > 1 && (
              <Pagination
                count={totalReplenishmentPages}
                page={currentPage}
                onChange={(_, page) => setCurrentPage(page)}
                color="standard"
                shape="rounded"
              />
            )}
          </Stack>
        </CardContent>
      </Card>
      <Snackbar
        open={Boolean(missingSupplierWarning)}
        autoHideDuration={5000}
        onClose={() => setMissingSupplierWarning(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          onClose={() => setMissingSupplierWarning(null)}
          sx={{ width: '100%' }}
        >
          {missingSupplierWarning}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

export default DashboardPage
