import AddIcon from '@mui/icons-material/Add'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { createProduct, listProducts, updateProduct } from '../api/products'
import { SectionHeading } from '../components/common/SectionHeading'
import type { Product, ProductRequest } from '../types/products'

interface ProductFormState {
  skuCode: string
  name: string
  categoryId: string
  isPerishable: boolean
  shelfLifeDays?: number | null
  uom: string
  price: number
  minStock: number
  leadTimeDays: number
  supplierId: string
}

const defaultForm: ProductFormState = {
  skuCode: '',
  name: '',
  categoryId: '',
  isPerishable: false,
  shelfLifeDays: null,
  uom: '',
  price: 0,
  minStock: 0,
  leadTimeDays: 0,
  supplierId: '',
}

const normalizePayload = (form: ProductFormState): ProductRequest => ({
  skuCode: form.skuCode.trim(),
  name: form.name.trim(),
  categoryId: form.categoryId.trim() || undefined,
  isPerishable: form.isPerishable,
  shelfLifeDays: form.isPerishable ? (form.shelfLifeDays ?? undefined) : undefined,
  uom: form.uom.trim(),
  price: Number(form.price),
  minStock: Number(form.minStock),
  leadTimeDays: Number(form.leadTimeDays),
  supplierId: form.supplierId.trim() || undefined,
})

const mapProductToForm = (product: Product): ProductFormState => ({
  skuCode: product.skuCode,
  name: product.name,
  categoryId: product.categoryId ?? '',
  isPerishable: product.isPerishable,
  shelfLifeDays: product.shelfLifeDays ?? null,
  uom: product.uom,
  price: product.price,
  minStock: product.minStock,
  leadTimeDays: product.leadTimeDays,
  supplierId: product.supplierId ?? '',
})

const renderError = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error'

export const ProductManagementPage = () => {
  const queryClient = useQueryClient()
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<ProductFormState>(defaultForm)
  const [editForm, setEditForm] = useState<ProductFormState | null>(null)

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
  })

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const selectedProduct = useMemo(
    () => products.find(product => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id)
    }
  }, [products, selectedProductId])

  useEffect(() => {
    if (selectedProduct) {
      setEditForm(mapProductToForm(selectedProduct))
    } else {
      setEditForm(null)
    }
  }, [selectedProduct])

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      setCreateDialogOpen(false)
      setCreateForm(defaultForm)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductRequest }) =>
      updateProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const handleCreateChange =
    (field: keyof ProductFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      if (field === 'isPerishable') {
        const checked = event.target.checked
        setCreateForm(prev => ({
          ...prev,
          isPerishable: checked,
          shelfLifeDays: checked ? prev.shelfLifeDays : null,
        }))
        return
      }

      if (field === 'shelfLifeDays') {
        const value = event.target.value === '' ? null : Number(event.target.value)
        setCreateForm(prev => ({ ...prev, shelfLifeDays: value }))
        return
      }

      const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value
      setCreateForm(prev => ({ ...prev, [field]: value }))
    }

  const handleEditChange =
    (field: keyof ProductFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      if (!editForm) {
        return
      }

      if (field === 'isPerishable') {
        const checked = event.target.checked
        setEditForm(prev =>
          prev
            ? { ...prev, isPerishable: checked, shelfLifeDays: checked ? prev.shelfLifeDays : null }
            : prev,
        )
        return
      }

      if (field === 'shelfLifeDays') {
        const value = event.target.value === '' ? null : Number(event.target.value)
        setEditForm(prev => (prev ? { ...prev, shelfLifeDays: value } : prev))
        return
      }

      const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value
      setEditForm(prev => (prev ? { ...prev, [field]: value } : prev))
    }

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate(normalizePayload(createForm))
  }

  const handleUpdateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProduct || !editForm) {
      return
    }
    updateMutation.mutate({ id: selectedProduct.id, payload: normalizePayload(editForm) })
  }

  const detailRows = selectedProduct
    ? [
        { label: 'SKU', value: selectedProduct.skuCode },
        { label: 'Category ID', value: selectedProduct.categoryId ?? '—' },
        { label: 'Supplier ID', value: selectedProduct.supplierId ?? '—' },
        { label: 'Perishable', value: selectedProduct.isPerishable ? 'Yes' : 'No' },
        { label: 'Shelf life (days)', value: selectedProduct.shelfLifeDays ?? '—' },
        { label: 'UoM', value: selectedProduct.uom },
        { label: 'Price', value: selectedProduct.price.toLocaleString() },
        { label: 'Min stock', value: selectedProduct.minStock },
        { label: 'Lead time (days)', value: selectedProduct.leadTimeDays },
        { label: 'Created at', value: new Date(selectedProduct.createdAt).toLocaleString() },
        {
          label: 'Updated at',
          value: new Date(
            selectedProduct.updatedAt ?? selectedProduct.lastModifiedAt,
          ).toLocaleString(),
        },
      ]
    : []

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Product catalog"
        subtitle="Browse, create, and update SKUs in the master catalog."
        action={
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setCreateDialogOpen(true)}
          >
            Add product
          </Button>
        }
      />

      {productsQuery.isLoading && <LinearProgress />}
      {productsQuery.isError && <Alert severity="error">Failed to load products.</Alert>}

      {!productsQuery.isLoading && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ maxHeight: 600, overflow: 'auto' }}>
              <List>
                {products.map(product => (
                  <ListItemButton
                    key={product.id}
                    selected={product.id === selectedProductId}
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    <ListItemText
                      primary={product.name}
                      secondary={`SKU ${product.skuCode} • ${product.isPerishable ? 'Perishable' : 'Non-perishable'}`}
                    />
                  </ListItemButton>
                ))}
                {products.length === 0 && (
                  <Box px={3} py={3}>
                    <Typography color="text.secondary">
                      No products found. Add one to get started.
                    </Typography>
                  </Box>
                )}
              </List>
            </Paper>
          </Grid>
          <Grid item xs={12} md={8}>
            {selectedProduct && editForm ? (
              <Stack spacing={2}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Product details
                    </Typography>
                    <Grid container spacing={2}>
                      {detailRows.map(row => (
                        <Grid item xs={12} sm={6} key={row.label}>
                          <Typography variant="body2" color="text.secondary">
                            {row.label}
                          </Typography>
                          <Typography variant="subtitle1">{row.value}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Update product
                    </Typography>
                    <Box component="form" onSubmit={handleUpdateSubmit}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="SKU code"
                            value={editForm.skuCode}
                            onChange={handleEditChange('skuCode')}
                            required
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Name"
                            value={editForm.name}
                            onChange={handleEditChange('name')}
                            required
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Category (ID or code)"
                            value={editForm.categoryId}
                            onChange={handleEditChange('categoryId')}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Supplier ID"
                            value={editForm.supplierId}
                            onChange={handleEditChange('supplierId')}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={editForm.isPerishable}
                                onChange={handleEditChange('isPerishable')}
                              />
                            }
                            label="Perishable SKU"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Shelf life (days)"
                            type="number"
                            value={editForm.shelfLifeDays ?? ''}
                            onChange={handleEditChange('shelfLifeDays')}
                            disabled={!editForm.isPerishable}
                            required={editForm.isPerishable}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Unit of measure"
                            value={editForm.uom}
                            onChange={handleEditChange('uom')}
                            required
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Price"
                            type="number"
                            value={editForm.price}
                            onChange={handleEditChange('price')}
                            required
                            fullWidth
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Min stock"
                            type="number"
                            value={editForm.minStock}
                            onChange={handleEditChange('minStock')}
                            required
                            fullWidth
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Lead time (days)"
                            type="number"
                            value={editForm.leadTimeDays}
                            onChange={handleEditChange('leadTimeDays')}
                            required
                            fullWidth
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </Grid>
                      </Grid>
                      {updateMutation.isError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                          {renderError(updateMutation.error)}
                        </Alert>
                      )}
                      <Box mt={2} display="flex" justifyContent="flex-end">
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Stack>
            ) : (
              <Alert severity="info">Select a product to view details.</Alert>
            )}
          </Grid>
        </Grid>
      )}

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <Box component="form" onSubmit={handleCreateSubmit}>
          <DialogTitle>Add product</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} mt={1}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="SKU code"
                  value={createForm.skuCode}
                  onChange={handleCreateChange('skuCode')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Name"
                  value={createForm.name}
                  onChange={handleCreateChange('name')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Category (ID or code)"
                  value={createForm.categoryId}
                  onChange={handleCreateChange('categoryId')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Supplier ID"
                  value={createForm.supplierId}
                  onChange={handleCreateChange('supplierId')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={createForm.isPerishable}
                      onChange={handleCreateChange('isPerishable')}
                    />
                  }
                  label="Perishable SKU"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Shelf life (days)"
                  type="number"
                  value={createForm.shelfLifeDays ?? ''}
                  onChange={handleCreateChange('shelfLifeDays')}
                  disabled={!createForm.isPerishable}
                  required={createForm.isPerishable}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Unit of measure"
                  value={createForm.uom}
                  onChange={handleCreateChange('uom')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Price"
                  type="number"
                  value={createForm.price}
                  onChange={handleCreateChange('price')}
                  required
                  fullWidth
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Min stock"
                  type="number"
                  value={createForm.minStock}
                  onChange={handleCreateChange('minStock')}
                  required
                  fullWidth
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Lead time (days)"
                  type="number"
                  value={createForm.leadTimeDays}
                  onChange={handleCreateChange('leadTimeDays')}
                  required
                  fullWidth
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
            </Grid>
            {createMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {renderError(createMutation.error)}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}

export default ProductManagementPage
