import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { adjustInventory, getInventoryLedger } from '../api/inventory'
import { SectionHeading } from '../components/common/SectionHeading'
import { useAuthStore } from '../stores/auth-store'
import { useSearchStore } from '../stores/search-store'
import { formatDateTime } from '../utils/formatters'

export const InventoryPage = () => {
  const [productIdInput, setProductIdInput] = useState('')
  const [activeProductId, setActiveProductId] = useState('')
  const actorId = useAuthStore(state => state.user?.userId ?? 0)
  const globalSearch = useSearchStore(state => state.query).toLowerCase()
  const queryClient = useQueryClient()

  const ledgerQuery = useQuery({
    queryKey: ['inventory-ledger', activeProductId],
    queryFn: () => getInventoryLedger(activeProductId),
    enabled: Boolean(activeProductId),
  })

  const adjustmentMutation = useMutation({
    mutationFn: adjustInventory,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger', variables.productId] })
    },
  })

  const handleLookup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActiveProductId(productIdInput.trim())
  }

  const handleProductIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    setProductIdInput(event.target.value)
  }

  const handleAdjustmentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeProductId) return

    const formData = new FormData(event.currentTarget)
    const payload = {
      productId: activeProductId,
      lotId: (formData.get('lotId') as string) || undefined,
      qtyDelta: Number(formData.get('qtyDelta')),
      reason: String(formData.get('reason')),
      actorId,
    }
    adjustmentMutation.mutate(payload)
    event.currentTarget.reset()
  }

  const lots = ledgerQuery.data?.lots ?? []
  const movementSource =
    ledgerQuery.data?.movements && ledgerQuery.data.movements.length > 0
      ? ledgerQuery.data.movements
      : ledgerQuery.data?.recentMovements ?? []
  const filteredMovements = movementSource.filter(movement =>
      `${movement.id}${movement.type}${movement.lotId ?? ''}${movement.refType ?? ''}`
        .toLowerCase()
        .includes(globalSearch),
    )

  return (
    <Stack spacing={4}>
      <SectionHeading
        title="Inventory workspace"
        subtitle="Find a product, inspect lots, and perform stock adjustments."
      />
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            component="form"
            onSubmit={handleLookup}
          >
            <TextField
              label="Product ID"
              value={productIdInput}
              onChange={handleProductIdChange}
              required
            />
            <Button type="submit" variant="contained" size="large">
              Load ledger
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {ledgerQuery.isError && <Alert severity="error">Unable to load product ledger.</Alert>}

      {ledgerQuery.data && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <SectionHeading
                  title={`Lots for product ${ledgerQuery.data.productId}`}
                  subtitle={`On hand: ${ledgerQuery.data.onHand}`}
                />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Lot ID</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell>Received</TableCell>
                      <TableCell>Expiry</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lots.map(lot => (
                      <TableRow key={lot.lotId}>
                        <TableCell>{lot.lotId}</TableCell>
                        <TableCell align="right">{lot.qtyOnHand}</TableCell>
                        <TableCell>{formatDateTime(lot.receivedAt)}</TableCell>
                        <TableCell>{formatDateTime(lot.expiryDate)}</TableCell>
                      </TableRow>
                    ))}
                    {lots.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography color="text.secondary">No lots found.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <SectionHeading title="Adjust inventory" />
                <Stack spacing={2} component="form" onSubmit={handleAdjustmentSubmit}>
                  <TextField name="lotId" label="Lot ID (optional)" />
                  <TextField
                    name="qtyDelta"
                    label="Quantity delta"
                    type="number"
                    required
                    inputProps={{ step: '0.01' }}
                  />
                  <TextField name="reason" label="Reason" required />
                  {adjustmentMutation.isError && (
                    <Alert severity="error">
                      {adjustmentMutation.error instanceof Error
                        ? adjustmentMutation.error.message
                        : 'Adjustment failed'}
                    </Alert>
                  )}
                  <Button type="submit" variant="contained" disabled={adjustmentMutation.isPending}>
                    {adjustmentMutation.isPending ? 'Applying...' : 'Apply adjustment'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {ledgerQuery.data && (
        <Card>
          <CardContent>
            <SectionHeading title="Recent movements" subtitle="Latest 50 transactions." />
            <Divider sx={{ mb: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell>Lot</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMovements.map(movement => (
                  <TableRow key={movement.id}>
                    <TableCell>{movement.id}</TableCell>
                    <TableCell>{movement.type}</TableCell>
                    <TableCell align="right">{movement.qty}</TableCell>
                    <TableCell>{movement.lotId ?? '-'}</TableCell>
                    <TableCell>{movement.refType ?? '-'}</TableCell>
                    <TableCell>{formatDateTime(movement.at)}</TableCell>
                  </TableRow>
                ))}
                {filteredMovements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="text.secondary">No movements match the filter.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}

export default InventoryPage
