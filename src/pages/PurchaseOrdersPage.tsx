import AddIcon from '@mui/icons-material/Add'
import Autocomplete from '@mui/material/Autocomplete'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import type { ChangeEvent, SyntheticEvent } from 'react'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listProducts } from '../api/products'
import { createPurchaseOrder } from '../api/purchaseOrders'
import { fetchAllSuppliers } from '../api/suppliers'
import { SectionHeading } from '../components/common/SectionHeading'
import type { CreatePoRequest, PoItemInput } from '../types/purchaseOrders'
import type { Product } from '../types/products'
import type { Supplier } from '../types/suppliers'

const generateId = () => Math.random().toString(36).slice(2, 10)
const todayIso = () => new Date().toISOString().split('T')[0]

const BaseAutocomplete = Autocomplete as unknown as (props: Record<string, unknown>) => ReactElement

type SingleSelectAutocompleteProps<T> = {
  options: T[]
  value: T | null
  onChange: (event: SyntheticEvent<Element, Event>, value: T | null) => void
  getOptionLabel: (option: T) => string
  isOptionEqualToValue: (option: T, value: T) => boolean
  renderInput: (params: Record<string, unknown>) => ReactElement
  loading?: boolean
  disabled?: boolean
}

const SingleSelectAutocomplete = <T,>(props: SingleSelectAutocompleteProps<T>) => (
  <BaseAutocomplete {...props} />
)

interface DraftItem {
  id: string
  productId: string
  qty: number
  unitCost: number
  expectedDate: string
}

interface PurchaseOrderDraft {
  draftId: string
  supplierId: string
  items: DraftItem[]
}

interface DraftFeedback {
  state: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

const createDraftItem = (overrides?: Partial<DraftItem>): DraftItem => ({
  id: generateId(),
  productId: '',
  qty: 1,
  unitCost: 0,
  expectedDate: todayIso(),
  ...overrides,
})

const createDraft = (overrides?: Partial<PurchaseOrderDraft>): PurchaseOrderDraft => ({
  draftId: generateId(),
  supplierId: overrides?.supplierId ?? '',
  items: overrides?.items ?? [createDraftItem()],
})

export const PurchaseOrdersPage = () => {
  const [drafts, setDrafts] = useState<PurchaseOrderDraft[]>([createDraft()])
  const [draftFeedback, setDraftFeedback] = useState<Record<string, DraftFeedback>>({})
  const [appliedQueryKey, setAppliedQueryKey] = useState('')
  const [searchParams] = useSearchParams()

  const supplierParam = searchParams.get('supplierId')
  const productParams = useMemo(() => searchParams.getAll('productId'), [searchParams])
  const productParamKey = productParams.join(',')
  const searchKey = `${supplierParam ?? ''}|${productParamKey}`

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-directory'],
    queryFn: () => fetchAllSuppliers(),
  })

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
  })

  const suppliers = useMemo<Supplier[]>(() => suppliersQuery.data ?? [], [suppliersQuery.data])
  const products = useMemo<Product[]>(() => productsQuery.data ?? [], [productsQuery.data])

  const supplierMap = useMemo(
    () => new Map(suppliers.map(supplier => [supplier.id, supplier])),
    [suppliers],
  )

  const productsBySupplier = useMemo(() => {
    const map = new Map<string, Product[]>()
    products.forEach(product => {
      if (!product.supplierId) {
        return
      }
      const current = map.get(product.supplierId) ?? []
      current.push(product)
      map.set(product.supplierId, current)
    })
    return map
  }, [products])

  useEffect(() => {
    if (!supplierParam && productParams.length === 0) {
      return
    }

    if (searchKey === appliedQueryKey) {
      return
    }

    setDrafts(prev => {
      const baseDraft = prev[0] ?? createDraft()
      const derivedItems =
        productParams.length > 0
          ? productParams.map(productId => {
              const matchedProduct = products.find(product => product.id === productId)
              return createDraftItem({
                productId,
                unitCost: matchedProduct?.price ?? 0,
              })
            })
          : baseDraft.items

      const patchedDraft = {
        ...baseDraft,
        supplierId: supplierParam ?? baseDraft.supplierId,
        items: derivedItems.length > 0 ? derivedItems : baseDraft.items,
      }

      if (prev.length === 0) {
        return [patchedDraft]
      }

      const [, ...rest] = prev
      return [patchedDraft, ...rest]
    })

    setAppliedQueryKey(searchKey)
  }, [searchKey, supplierParam, productParamKey, appliedQueryKey, productParams, products])

  const setDraftFeedbackState = (draftId: string, feedback: DraftFeedback) => {
    setDraftFeedback(prev => ({ ...prev, [draftId]: feedback }))
  }

  const handleSupplierSelect = (draftId: string, supplierId: string) => {
    setDrafts(prev =>
      prev.map(draft =>
        draft.draftId === draftId
          ? {
              ...draft,
              supplierId,
              items: draft.items.map(item => ({ ...item, productId: '' })),
            }
          : draft,
      ),
    )
    setDraftFeedbackState(draftId, { state: 'idle' })
  }

  const handleItemChange = (draftId: string, itemId: string, changes: Partial<DraftItem>) => {
    setDrafts(prev =>
      prev.map(draft =>
        draft.draftId === draftId
          ? {
              ...draft,
              items: draft.items.map(item => (item.id === itemId ? { ...item, ...changes } : item)),
            }
          : draft,
      ),
    )
  }

  const handleAddItem = (draftId: string) => {
    setDrafts(prev =>
      prev.map(draft =>
        draft.draftId === draftId
          ? { ...draft, items: [...draft.items, createDraftItem()] }
          : draft,
      ),
    )
  }

  const handleRemoveItem = (draftId: string, itemId: string) => {
    setDrafts(prev =>
      prev.map(draft => {
        if (draft.draftId !== draftId) {
          return draft
        }
        const nextItems = draft.items.filter(item => item.id !== itemId)
        return { ...draft, items: nextItems.length > 0 ? nextItems : [createDraftItem()] }
      }),
    )
  }

  const handleAddDraft = () => {
    setDrafts(prev => [...prev, createDraft()])
  }

  const handleRemoveDraft = (draftId: string) => {
    setDrafts(prev => {
      const remaining = prev.filter(draft => draft.draftId !== draftId)
      return remaining.length === 0 ? [createDraft()] : remaining
    })

    setDraftFeedback(prev => {
      const next = { ...prev }
      delete next[draftId]
      return next
    })
  }

  const handleSubmitDraft = async (draft: PurchaseOrderDraft) => {
    const supplierNumericId = Number(draft.supplierId)
    if (!supplierNumericId) {
      setDraftFeedbackState(draft.draftId, {
        state: 'error',
        message: 'Select a supplier before submitting.',
      })
      return
    }

    if (draft.items.length === 0) {
      setDraftFeedbackState(draft.draftId, {
        state: 'error',
        message: 'Add at least one product line.',
      })
      return
    }

    const payloadItems: PoItemInput[] = []
    for (const item of draft.items) {
      const productNumericId = Number(item.productId)
      if (!productNumericId) {
        setDraftFeedbackState(draft.draftId, {
          state: 'error',
          message: 'Each line item requires a product selection.',
        })
        return
      }

      if (!item.expectedDate) {
        setDraftFeedbackState(draft.draftId, {
          state: 'error',
          message: 'Provide an expected arrival date for each item.',
        })
        return
      }

      if (!Number.isFinite(item.qty) || item.qty <= 0) {
        setDraftFeedbackState(draft.draftId, {
          state: 'error',
          message: 'Quantity must be greater than zero.',
        })
        return
      }

      if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
        setDraftFeedbackState(draft.draftId, {
          state: 'error',
          message: 'Unit cost cannot be negative.',
        })
        return
      }

      payloadItems.push({
        productId: productNumericId,
        qty: Number(item.qty),
        unitCost: Number(item.unitCost),
        expectedDate: item.expectedDate,
      })
    }

    const request: CreatePoRequest = {
      supplierId: supplierNumericId,
      items: payloadItems,
    }

    setDraftFeedbackState(draft.draftId, { state: 'loading' })
    try {
      const response = await createPurchaseOrder(request)
      setDraftFeedbackState(draft.draftId, {
        state: 'success',
        message: `PO #${response.id} created.`,
      })
      setDrafts(prev =>
        prev.map(existing =>
          existing.draftId === draft.draftId
            ? {
                ...existing,
                items: [createDraftItem()],
              }
            : existing,
        ),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create purchase order.'
      setDraftFeedbackState(draft.draftId, { state: 'error', message })
    }
  }

  return (
    <Stack spacing={4}>
      <SectionHeading
        title="Purchase orders"
        subtitle="Create role-specific replenishment requests and review existing PO statuses."
      />

      <Stack spacing={3}>
        {drafts.map((draft, index) => {
          const supplier = draft.supplierId ? supplierMap.get(draft.supplierId) : null
          const availableProducts = draft.supplierId
            ? (productsBySupplier.get(draft.supplierId) ?? [])
            : products
          const feedback = draftFeedback[draft.draftId]
          const isSubmitting = feedback?.state === 'loading'

          return (
            <Card key={draft.draftId} component="section">
              <CardContent>
                <Stack spacing={3}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box>
                      <Typography variant="overline">PO draft #{index + 1}</Typography>
                      <Typography variant="h6">
                        {supplier ? supplier.name : 'Select a supplier'}
                      </Typography>
                      {supplier && (
                        <Typography variant="body2" color="text.secondary">
                          Lead time: {supplier.leadTimeDays} day
                          {supplier.leadTimeDays === 1 ? '' : 's'} · Contact:{' '}
                          {supplier.contact ?? '—'}
                        </Typography>
                      )}
                    </Box>
                    {drafts.length > 1 && (
                      <Button color="inherit" onClick={() => handleRemoveDraft(draft.draftId)}>
                        Remove draft
                      </Button>
                    )}
                  </Stack>

                  <SingleSelectAutocomplete<Supplier>
                    options={suppliers}
                    loading={suppliersQuery.isLoading}
                    getOptionLabel={(option: Supplier) => option.name}
                    isOptionEqualToValue={(option: Supplier, value: Supplier) =>
                      option.id === value.id
                    }
                    value={supplier ?? null}
                    onChange={(_event: SyntheticEvent<Element, Event>, value: Supplier | null) =>
                      handleSupplierSelect(draft.draftId, value?.id ?? '')
                    }
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Supplier"
                        placeholder="Start typing a supplier name"
                        required
                      />
                    )}
                  />

                  <Divider />

                  <Stack spacing={2}>
                    {draft.items.map(item => {
                      const selectedProduct =
                        item.productId && availableProducts
                          ? (availableProducts.find(product => product.id === item.productId) ??
                            products.find(product => product.id === item.productId))
                          : null
                      return (
                        <Paper
                          key={item.id}
                          variant="outlined"
                          sx={{ p: 2, borderRadius: 3, borderStyle: 'dashed' }}
                        >
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                              <SingleSelectAutocomplete<Product>
                                options={availableProducts}
                                loading={productsQuery.isLoading}
                                getOptionLabel={(option: Product) => option.name}
                                isOptionEqualToValue={(option: Product, value: Product) =>
                                  option.id === value.id
                                }
                                value={selectedProduct ?? null}
                                onChange={(
                                  _event: SyntheticEvent<Element, Event>,
                                  value: Product | null,
                                ) =>
                                  handleItemChange(draft.draftId, item.id, {
                                    productId: value?.id ?? '',
                                    unitCost: value?.price ?? item.unitCost,
                                  })
                                }
                                renderInput={params => (
                                  <TextField
                                    {...params}
                                    label="Product"
                                    placeholder={
                                      draft.supplierId
                                        ? 'Select a product from this supplier'
                                        : 'Choose supplier first'
                                    }
                                    required
                                  />
                                )}
                                disabled={!draft.supplierId}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {selectedProduct
                                  ? `SKU ${selectedProduct.skuCode} • ${selectedProduct.uom}`
                                  : 'Supplier & product are required for PO submission.'}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} md={2}>
                              <TextField
                                label="Quantity"
                                type="number"
                                value={item.qty}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleItemChange(draft.draftId, item.id, {
                                    qty: Number(event.target.value ?? 0),
                                  })
                                }
                                required
                                inputProps={{ min: 1 }}
                              />
                            </Grid>
                            <Grid item xs={6} md={2}>
                              <TextField
                                label="Unit cost"
                                type="number"
                                value={item.unitCost}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleItemChange(draft.draftId, item.id, {
                                    unitCost: Number(event.target.value ?? 0),
                                  })
                                }
                                required
                                inputProps={{ min: 0, step: 0.01 }}
                              />
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <TextField
                                label="Expected date"
                                type="date"
                                value={item.expectedDate}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleItemChange(draft.draftId, item.id, {
                                    expectedDate: event.target.value,
                                  })
                                }
                                required
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} md={1} display="flex" alignItems="flex-end">
                              <Button
                                color="inherit"
                                onClick={() => handleRemoveItem(draft.draftId, item.id)}
                              >
                                Remove
                              </Button>
                            </Grid>
                          </Grid>
                        </Paper>
                      )
                    })}
                  </Stack>

                  <Box>
                    <Button
                      startIcon={<AddIcon />}
                      variant="text"
                      onClick={() => handleAddItem(draft.draftId)}
                    >
                      Add SKU
                    </Button>
                  </Box>

                  {feedback?.state === 'error' && (
                    <Alert severity="error">{feedback.message ?? 'Unable to submit PO.'}</Alert>
                  )}
                  {feedback?.state === 'success' && (
                    <Alert severity="success">{feedback.message}</Alert>
                  )}

                  <Stack direction="row" gap={2} flexWrap="wrap" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {draft.items.length} line item{draft.items.length === 1 ? '' : 's'} ·{' '}
                      {draft.supplierId ? 'Ready to submit' : 'Select a supplier to continue'}
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => handleSubmitDraft(draft)}
                      disabled={isSubmitting || suppliersQuery.isLoading || productsQuery.isLoading}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit purchase order'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )
        })}
      </Stack>

      <Box textAlign="center">
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddDraft}
          sx={{ borderStyle: 'dashed' }}
        >
          Add another purchase order
        </Button>
      </Box>
    </Stack>
  )
}

export default PurchaseOrdersPage
