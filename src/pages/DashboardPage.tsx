import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getAlerts } from '../api/alerts'
import { listProducts } from '../api/products'
import { getReplenishmentSuggestions } from '../api/replenishment'
import { StatCard } from '../components/cards/StatCard'
import { SectionHeading } from '../components/common/SectionHeading'
import type { AlertsAggregate, LowStock } from '../types/alerts'
import type { ReplenishmentSuggestion } from '../types/replenishment'

const EMPTY_ALERTS: AlertsAggregate = { lowStock: [], expirySoon: [], slowMovers: [] }
const EMPTY_REPLENISHMENT: ReplenishmentSuggestion[] = []

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

export const DashboardPage = () => {
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
  const productNameLookupQuery = useQuery({
    queryKey: ['products', 'name-lookup'],
    queryFn: async (): Promise<Record<string, string>> => {
      const products = await listProducts()
      return products.reduce<Record<string, string>>((acc, product) => {
        acc[product.id] = product.name
        return acc
      }, {})
    },
    enabled: shouldFetchProductNames,
    staleTime: 5 * 60 * 1000,
  })

  if (alertsQuery.isLoading || replenishmentQuery.isLoading) {
    return <LinearProgress />
  }

  if (alertsQuery.isError) {
    return <Alert severity="error">Unable to load alerts</Alert>
  }

  const productNameLookup = productNameLookupQuery.data ?? {}
  const resolveProductNameById = (productId: string | number, providedName?: string) =>
    resolveProductName(providedName, productId, productNameLookup[String(productId)])
  const resolveLowStockProductName = (item: LowStock) =>
    resolveProductNameById(item.productId, item.productName)

  return (
    <Stack spacing={4}>
      <SectionHeading
        title="Inventory Pulse"
        subtitle="Stay ahead of low stock, expiry risk, and slow movers."
      />
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <StatCard
            label="Low stock SKUs"
            value={alerts?.lowStock.length ?? 0}
            helperText="Below min stock."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            label="Lots expiring soon"
            value={alerts?.expirySoon.length ?? 0}
            helperText="Within configured window."
            accent="secondary"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            label="Slow movers"
            value={alerts?.slowMovers.length ?? 0}
            helperText="Need attention."
            accent="error"
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
            {replenishment.slice(0, 10).map(item => (
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
                    Lead time: {formatDays(item.leadTimeDays)} | Safety stock:{' '}
                    {formatUnits(item.safetyStock)}
                  </Typography>
                </Stack>
                <Chip
                  color={item.suggestedQty > 0 ? 'warning' : 'success'}
                  label={
                    item.suggestedQty > 0
                      ? `Suggest ordering ${formatUnits(item.suggestedQty)}`
                      : 'Stock is healthy'
                  }
                />
              </Box>
            ))}
            {replenishment.length === 0 && (
              <Typography color="text.secondary">
                No replenishment suggestions right now.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

export default DashboardPage
