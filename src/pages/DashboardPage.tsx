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
import { getAlerts } from '../api/alerts'
import { getReplenishmentSuggestions } from '../api/replenishment'
import { StatCard } from '../components/cards/StatCard'
import { SectionHeading } from '../components/common/SectionHeading'
import { formatCurrency } from '../utils/formatters'

export const DashboardPage = () => {
  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: getAlerts })
  const replenishmentQuery = useQuery({
    queryKey: ['replenishment'],
    queryFn: getReplenishmentSuggestions,
  })

  if (alertsQuery.isLoading || replenishmentQuery.isLoading) {
    return <LinearProgress />
  }

  if (alertsQuery.isError) {
    return <Alert severity="error">Unable to load alerts</Alert>
  }

  const alerts = alertsQuery.data
  const replenishment = replenishmentQuery.data ?? []

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
                      primary={item.productId}
                      secondary={`On hand ${item.onHand} / Min ${item.minStock}`}
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
                      primary={`${item.productId} • Lot ${item.lotId}`}
                      secondary={`Expires in ${item.daysToExpiry} day(s)`}
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
                  <Typography variant="subtitle1">SKU #{item.productId}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Lead time: {item.leadTimeDays} day(s) • Safety stock:{' '}
                    {formatCurrency(item.safetyStock)}
                  </Typography>
                </Stack>
                <Chip
                  color={item.suggestedQty > 0 ? 'warning' : 'success'}
                  label={
                    item.suggestedQty > 0
                      ? `Suggest order ${item.suggestedQty}`
                      : 'Stock is healthy'
                  }
                />
              </Box>
            ))}
            {replenishment.length === 0 && (
              <Typography color="text.secondary">No replenishment suggestions right now.</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

export default DashboardPage
