import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { createPurchaseOrder, getPurchaseOrder } from '../api/purchaseOrders'
import { SectionHeading } from '../components/common/SectionHeading'
import type { PoItemInput } from '../types/purchaseOrders'
import { formatDateTime } from '../utils/formatters'

const buildItem = (): PoItemInput => ({
  productId: 0,
  qty: 1,
  unitCost: 0,
  expectedDate: new Date().toISOString().split('T')[0],
})

export const PurchaseOrdersPage = () => {
  const [supplierId, setSupplierId] = useState(0)
  const [items, setItems] = useState<PoItemInput[]>([buildItem()])
  const [poIdLookup, setPoIdLookup] = useState('')

  const createMutation = useMutation({
    mutationFn: createPurchaseOrder,
  })

  const lookupMutation = useMutation({
    mutationFn: getPurchaseOrder,
  })

  const handleAddItem = () => setItems(prev => [...prev, buildItem()])
  const handleRemoveItem = (index: number) => setItems(prev => prev.filter((_, idx) => idx !== index))

  const updateItem = (index: number, changes: Partial<PoItemInput>) =>
    setItems(prev => prev.map((item, idx) => (idx === index ? { ...item, ...changes } : item)))

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate({
      supplierId,
      items,
    })
  }

  const handleLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = Number(poIdLookup)
    if (!id) return
    lookupMutation.mutate(id)
  }

  const handleSupplierChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSupplierId(Number(event.target.value))
  }

  const handleLookupChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPoIdLookup(event.target.value)
  }

  return (
    <Stack spacing={4}>
      <SectionHeading
        title="Purchase orders"
        subtitle="Generate replenishment requests and check PO statuses."
      />
      <Card component="section">
        <CardContent>
          <SectionHeading title="Create PO" />
          <Stack spacing={3} component="form" onSubmit={handleCreate}>
            <TextField
              label="Supplier ID"
              type="number"
              value={supplierId}
              onChange={handleSupplierChange}
              required
            />
            <Stack spacing={2}>
              {items.map((item, index) => (
                <Card key={index} variant="outlined">
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label="Product ID"
                          type="number"
                          value={item.productId}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateItem(index, { productId: Number(event.target.value) })
                          }
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label="Quantity"
                          type="number"
                          value={item.qty}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateItem(index, { qty: Number(event.target.value) })
                          }
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label="Unit cost"
                          type="number"
                          value={item.unitCost}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateItem(index, { unitCost: Number(event.target.value) })
                          }
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label="Expected date"
                          type="date"
                          value={item.expectedDate}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateItem(index, { expectedDate: event.target.value })
                          }
                          required
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                    {items.length > 1 && (
                      <IconButton onClick={() => handleRemoveItem(index)}>
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
            <Button startIcon={<AddIcon />} onClick={handleAddItem} variant="text">
              Add item
            </Button>
            {createMutation.isError && (
              <Alert severity="error">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create PO.'}
              </Alert>
            )}
            {createMutation.isSuccess && (
              <Alert severity="success">PO #{createMutation.data.id} created successfully.</Alert>
            )}
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Submitting...' : 'Submit PO'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card component="section">
        <CardContent>
          <SectionHeading title="Check PO status" />
          <Stack spacing={2} component="form" onSubmit={handleLookup}>
            <TextField
              label="PO ID"
              value={poIdLookup}
              onChange={handleLookupChange}
              required
            />
            <Button type="submit" variant="outlined" disabled={lookupMutation.isPending}>
              {lookupMutation.isPending ? 'Loading...' : 'Fetch PO'}
            </Button>
          </Stack>
          {lookupMutation.isError && (
            <Alert severity="error">
              {lookupMutation.error instanceof Error
                ? lookupMutation.error.message
                : 'PO not found.'}
            </Alert>
          )}
          {lookupMutation.data && (
            <Box mt={3}>
              <Typography variant="subtitle1">PO #{lookupMutation.data.id}</Typography>
              <Typography>Status: {lookupMutation.data.status}</Typography>
              <Typography>Created at: {formatDateTime(lookupMutation.data.createdAt)}</Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default PurchaseOrdersPage
