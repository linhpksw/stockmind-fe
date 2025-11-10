import AddIcon from '@mui/icons-material/Add'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { useMutation } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { createGrn, getGrnById } from '../api/grn'
import { SectionHeading } from '../components/common/SectionHeading'
import type { GrnItemInput } from '../types/grn'

const newItem = (): GrnItemInput => ({
  productId: 0,
  qtyReceived: 0,
  unitCost: 0,
  lotCode: '',
  expiryDate: '',
})

export const ReceivingPage = () => {
  const [poId, setPoId] = useState(0)
  const [items, setItems] = useState<GrnItemInput[]>([newItem()])
  const [grnLookup, setGrnLookup] = useState('')

  const createMutation = useMutation({
    mutationFn: createGrn,
  })

  const lookupMutation = useMutation({
    mutationFn: getGrnById,
  })

  const updateItem = (index: number, changes: Partial<GrnItemInput>) =>
    setItems(prev => prev.map((item, idx) => (idx === index ? { ...item, ...changes } : item)))

  const handleAddItem = () => setItems(prev => [...prev, newItem()])
  const handleRemoveItem = (index: number) => setItems(prev => prev.filter((_, idx) => idx !== index))

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate({
      poId,
      items: items.map(item => ({
        ...item,
        expiryDate: item.expiryDate || undefined,
      })),
    })
  }

  const handleLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = Number(grnLookup)
    if (!id) return
    lookupMutation.mutate(id)
  }

  const handlePoChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPoId(Number(event.target.value))
  }

  const handleLookupChange = (event: ChangeEvent<HTMLInputElement>) => {
    setGrnLookup(event.target.value)
  }

  return (
    <Stack spacing={4}>
      <SectionHeading title="Goods receipt" subtitle="Convert delivered POs into stock." />
      <Card>
        <CardContent>
          <SectionHeading title="Capture GRN" />
          <Stack spacing={3} component="form" onSubmit={handleCreate}>
            <TextField
              label="PO ID"
              type="number"
              value={poId}
              onChange={handlePoChange}
              required
            />
            <Stack spacing={2}>
              {items.map((item, index) => (
                <Card key={index} variant="outlined">
                  <CardContent>
                    <Grid container spacing={2}>
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
                          label="Qty received"
                          type="number"
                          value={item.qtyReceived}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateItem(index, { qtyReceived: Number(event.target.value) })
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
                          label="Lot code"
                          value={item.lotCode}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateItem(index, { lotCode: event.target.value })
                          }
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          label="Expiry date"
                          type="date"
                          value={item.expiryDate ?? ''}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateItem(index, { expiryDate: event.target.value })
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                    {items.length > 1 && (
                      <Button color="error" onClick={() => handleRemoveItem(index)}>
                        Remove line
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
            <Button startIcon={<AddIcon />} onClick={handleAddItem} variant="text">
              Add line
            </Button>
            {createMutation.isError && (
              <Alert severity="error">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create GRN.'}
              </Alert>
            )}
            {createMutation.isSuccess && (
              <Alert severity="success">GRN #{createMutation.data.id} recorded.</Alert>
            )}
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Capture GRN'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeading title="Inspect GRN" />
          <Stack spacing={2} component="form" onSubmit={handleLookup}>
            <TextField
              label="GRN ID"
              value={grnLookup}
              onChange={handleLookupChange}
              required
            />
            <Button type="submit" variant="outlined" disabled={lookupMutation.isPending}>
              {lookupMutation.isPending ? 'Loading...' : 'Fetch GRN'}
            </Button>
          </Stack>
          {lookupMutation.isError && <Alert severity="error">GRN not found.</Alert>}
          {lookupMutation.data && (
            <Box mt={3}>
              <Typography variant="subtitle1">GRN #{lookupMutation.data.id}</Typography>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Lot</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lookupMutation.data.stockMovements.map(move => (
                    <TableRow key={`${move.productId}-${move.lotId}`}>
                      <TableCell>{move.productId}</TableCell>
                      <TableCell>{move.lotId}</TableCell>
                      <TableCell align="right">{move.qty}</TableCell>
                      <TableCell>{move.type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default ReceivingPage
