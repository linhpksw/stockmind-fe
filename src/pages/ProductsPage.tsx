import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { createProduct, getProductById, updateProduct } from '../api/products'
import { SectionHeading } from '../components/common/SectionHeading'
import type { ProductRequest } from '../types/products'

interface ProductFormState {
  skuCode: string
  name: string
  categoryId: string
  isPerishable: boolean
  shelfLifeDays?: number | null
  uom: string
  price: number
  minStock: number
  supplierId: string
}

interface UpdateFormState extends ProductFormState {
  productId: string
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
  supplierId: '',
}

const normalizePayload = (form: ProductFormState): ProductRequest => ({
  skuCode: form.skuCode.trim(),
  name: form.name.trim(),
  categoryId: form.categoryId.trim() || undefined,
  isPerishable: form.isPerishable,
  shelfLifeDays: form.isPerishable ? (form.shelfLifeDays ?? undefined) : undefined,
  uom: form.uom.trim(),
  price: form.price,
  minStock: form.minStock,
  supplierId: form.supplierId.trim() || undefined,
})

const renderMutationError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unexpected error. Please try again.'
}

export const ProductsPage = () => {
  const [createForm, setCreateForm] = useState<ProductFormState>(defaultForm)
  const [updateForm, setUpdateForm] = useState<UpdateFormState>({ ...defaultForm, productId: '' })

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      setCreateForm(defaultForm)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductRequest }) =>
      updateProduct(id, payload),
    onSuccess: () => {
      setUpdateForm({ ...defaultForm, productId: '' })
    },
  })

  const loadProductMutation = useMutation({
    mutationFn: (id: string) => getProductById(id),
    onSuccess: product => {
      setUpdateForm({
        productId: product.id,
        skuCode: product.skuCode,
        name: product.name,
        categoryId: product.categoryId ?? '',
        isPerishable: product.isPerishable,
        shelfLifeDays: product.shelfLifeDays ?? null,
        uom: product.uom,
        price: product.price,
        minStock: product.minStock,
        supplierId: product.supplierId ?? '',
      })
    },
  })

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate(normalizePayload(createForm))
  }

  const handleUpdateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!updateForm.productId.trim()) {
      return
    }
    updateMutation.mutate({
      id: updateForm.productId.trim(),
      payload: normalizePayload(updateForm),
    })
  }

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
      setCreateForm(prev => ({
        ...prev,
        [field]: value,
      }))
    }

  const handleUpdateChange =
    (field: keyof UpdateFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      if (field === 'isPerishable') {
        const checked = event.target.checked
        setUpdateForm(prev => ({
          ...prev,
          isPerishable: checked,
          shelfLifeDays: checked ? prev.shelfLifeDays : null,
        }))
        return
      }

      if (field === 'shelfLifeDays') {
        const value = event.target.value === '' ? null : Number(event.target.value)
        setUpdateForm(prev => ({ ...prev, shelfLifeDays: value }))
        return
      }

      const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value
      setUpdateForm(prev => ({
        ...prev,
        [field]: value,
      }))
    }

  const handleLoadProduct = () => {
    const id = updateForm.productId.trim()
    if (!id) {
      return
    }
    loadProductMutation.mutate(id)
  }

  const createSuccessMessage = useMemo(() => {
    if (!createMutation.isSuccess || !createMutation.data) {
      return null
    }
    const product = createMutation.data
    return `SKU ${product.skuCode} created (ID ${product.id}).`
  }, [createMutation.isSuccess, createMutation.data])

  const updateSuccessMessage = useMemo(() => {
    if (!updateMutation.isSuccess || !updateMutation.data) {
      return null
    }
    const product = updateMutation.data
    return `SKU ${product.skuCode} updated successfully.`
  }, [updateMutation.isSuccess, updateMutation.data])

  return (
    <Stack spacing={4}>
      <SectionHeading
        title="Product master"
        subtitle="Register and update SKU attributes that drive downstream inventory logic."
      />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Register new SKU
              </Typography>
              <Box component="form" onSubmit={handleCreateSubmit}>
                <Stack spacing={2}>
                  <Grid container spacing={2}>
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
                      />
                    </Grid>
                  </Grid>
                  {createMutation.isError && (
                    <Alert severity="error">{renderMutationError(createMutation.error)}</Alert>
                  )}
                  {createSuccessMessage && <Alert severity="success">{createSuccessMessage}</Alert>}
                  <Box display="flex" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Saving...' : 'Create product'}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Update existing SKU
              </Typography>
              <Box component="form" onSubmit={handleUpdateSubmit}>
                <Stack spacing={2}>
                  <Box display="flex" gap={1} alignItems="flex-start">
                    <TextField
                      label="Product ID"
                      value={updateForm.productId}
                      onChange={handleUpdateChange('productId')}
                      helperText="Use the numeric product ID returned by APIs."
                      required
                      fullWidth
                    />
                    <Button
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                      onClick={handleLoadProduct}
                      disabled={!updateForm.productId.trim() || loadProductMutation.isPending}
                    >
                      {loadProductMutation.isPending ? 'Loading...' : 'Load'}
                    </Button>
                  </Box>
                  {loadProductMutation.isError && (
                    <Alert severity="error">{renderMutationError(loadProductMutation.error)}</Alert>
                  )}
                  {updateForm.productId && (
                    <Typography variant="caption" color="text.secondary">
                      Editing product ID {updateForm.productId}
                    </Typography>
                  )}
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="SKU code"
                        value={updateForm.skuCode}
                        onChange={handleUpdateChange('skuCode')}
                        required
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Name"
                        value={updateForm.name}
                        onChange={handleUpdateChange('name')}
                        required
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Category (ID or code)"
                        value={updateForm.categoryId}
                        onChange={handleUpdateChange('categoryId')}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Supplier ID"
                        value={updateForm.supplierId}
                        onChange={handleUpdateChange('supplierId')}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={updateForm.isPerishable}
                            onChange={handleUpdateChange('isPerishable')}
                          />
                        }
                        label="Perishable SKU"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Shelf life (days)"
                        type="number"
                        value={updateForm.shelfLifeDays ?? ''}
                        onChange={handleUpdateChange('shelfLifeDays')}
                        disabled={!updateForm.isPerishable}
                        required={updateForm.isPerishable}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Unit of measure"
                        value={updateForm.uom}
                        onChange={handleUpdateChange('uom')}
                        required
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Price"
                        type="number"
                        value={updateForm.price}
                        onChange={handleUpdateChange('price')}
                        required
                        fullWidth
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Min stock"
                        type="number"
                        value={updateForm.minStock}
                        onChange={handleUpdateChange('minStock')}
                        required
                        fullWidth
                        inputProps={{ min: 0, step: 1 }}
                      />
                    </Grid>
                  </Grid>
                  {updateMutation.isError && (
                    <Alert severity="error">{renderMutationError(updateMutation.error)}</Alert>
                  )}
                  {updateSuccessMessage && <Alert severity="success">{updateSuccessMessage}</Alert>}
                  <Box display="flex" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? 'Updating...' : 'Update product'}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}

export default ProductsPage
