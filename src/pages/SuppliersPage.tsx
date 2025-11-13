import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import Autocomplete from '@mui/material/Autocomplete'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent, SyntheticEvent } from 'react'
import { useMemo, useRef, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProducts } from '../api/products'
import { createSupplier, fetchAllSuppliers } from '../api/suppliers'
import { SectionHeading } from '../components/common/SectionHeading'
import { exportRowsToXlsx, parseFirstSheet } from '../lib/xlsx'
import { useSearchStore } from '../stores/search-store'
import type { Product } from '../types/products'
import type { CreateSupplierRequest } from '../types/suppliers'
import { type CategoryOption, UNCATEGORIZED_CATEGORY, resolveCategory } from '../utils/categories'

const BaseAutocomplete = Autocomplete as unknown as (props: Record<string, unknown>) => ReactElement

type MultiSelectAutocompleteProps<T> = {
  options: T[]
  value: T[]
  onChange: (event: SyntheticEvent<Element, Event>, value: T[]) => void
  getOptionLabel: (option: T) => string
  isOptionEqualToValue: (option: T, value: T) => boolean
  renderInput: (params: Record<string, unknown>) => ReactElement
  loading?: boolean
}

const MultiSelectAutocomplete = <T,>(props: MultiSelectAutocompleteProps<T>) => (
  <BaseAutocomplete {...props} multiple />
)

export const SuppliersPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateSupplierRequest>({
    name: '',
    contact: '',
    leadTimeDays: 0,
  })
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [selectedCategories, setSelectedCategories] = useState<CategoryOption[]>([])
  const [importing, setImporting] = useState(false)
  const [xlsxFeedback, setXlsxFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const globalQuery = useSearchStore(state => state.query)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-directory', globalQuery],
    queryFn: () => fetchAllSuppliers(globalQuery),
  })

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
  })

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers-directory'] })
      setDialogOpen(false)
      setForm({ name: '', contact: '', leadTimeDays: 0 })
    },
  })

  const suppliers = useMemo(() => suppliersQuery.data ?? [], [suppliersQuery.data])
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])

  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
  }, [suppliers])

  const supplierProductsMap = useMemo(() => {
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

  const categoryLookup = useMemo(() => {
    const map = new Map<string, CategoryOption>()
    map.set(UNCATEGORIZED_CATEGORY.key, UNCATEGORIZED_CATEGORY)
    products.forEach(product => {
      const option = resolveCategory(product.categoryId)
      map.set(option.key, option)
    })
    return map
  }, [products])

  const categoryOptions = useMemo(
    () =>
      Array.from(categoryLookup.values()).sort((a, b) => {
        if (a.parent === b.parent) {
          return a.child.localeCompare(b.child)
        }
        return a.parent.localeCompare(b.parent)
      }),
    [categoryLookup],
  )

  const productFilterIds = selectedProducts.map(product => product.id)
  const categoryFilterKeys = selectedCategories.map(category => category.key)

  const filteredSuppliers = useMemo(() => {
    return sortedSuppliers.filter(supplier => {
      const matchesSearch =
        !globalQuery ||
        supplier.name.toLowerCase().includes(globalQuery.toLowerCase()) ||
        supplier.contact?.toLowerCase().includes(globalQuery.toLowerCase())

      if (!matchesSearch) {
        return false
      }

      const supplierProducts = supplierProductsMap.get(supplier.id) ?? []

      const matchesProductFilter =
        productFilterIds.length === 0 ||
        supplierProducts.some(product => productFilterIds.includes(product.id))

      const matchesCategoryFilter =
        categoryFilterKeys.length === 0 ||
        supplierProducts.some(product => {
          const categoryKey = resolveCategory(product.categoryId).key
          return categoryFilterKeys.includes(categoryKey)
        })

      return matchesProductFilter && matchesCategoryFilter
    })
  }, [sortedSuppliers, supplierProductsMap, globalQuery, productFilterIds, categoryFilterKeys])

  const resetImportInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExportSuppliers = () => {
    if (sortedSuppliers.length === 0) {
      setXlsxFeedback({
        type: 'error',
        message: 'There are no suppliers to export yet.',
      })
      return
    }

    const rows = sortedSuppliers.map(supplier => ({
      supplier_id: supplier.id,
      name: supplier.name,
      contact: supplier.contact ?? '',
      lead_time_days: supplier.leadTimeDays,
      linked_sku_count: supplierProductsMap.get(supplier.id)?.length ?? 0,
    }))

    const today = new Date().toISOString().split('T')[0]
    exportRowsToXlsx(rows, `suppliers-${today}.xlsx`)
    setXlsxFeedback({
      type: 'success',
      message: `Exported ${rows.length} supplier${rows.length === 1 ? '' : 's'} to Excel.`,
    })
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setImporting(true)
    setXlsxFeedback(null)

    try {
      const rows = await parseFirstSheet(file)
      if (rows.length === 0) {
        throw new Error('No rows detected inside the spreadsheet.')
      }

      const normalizeString = (value: unknown) => (value == null ? '' : String(value).trim())
      const normalizeLeadTime = (value: unknown) => {
        const numeric = Number(value)
        return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 0
      }

      const payloads: CreateSupplierRequest[] = []
      let skipped = 0

      rows.forEach(row => {
        const name =
          normalizeString(
            row['name'] ??
              row['Name'] ??
              row['supplier_name'] ??
              row['Supplier Name'] ??
              row['SUPPLIER'],
          ) ?? ''

        if (!name) {
          skipped += 1
          return
        }

        const contact = normalizeString(row['contact'] ?? row['Contact'])
        const leadTimeDays = normalizeLeadTime(
          row['lead_time_days'] ??
            row['Lead Time Days'] ??
            row['leadTimeDays'] ??
            row['lead_time'] ??
            row['Lead Time'] ??
            row['lead time'],
        )

        payloads.push({
          name,
          contact: contact || undefined,
          leadTimeDays,
        })
      })

      if (payloads.length === 0) {
        throw new Error('No valid supplier rows found. A "name" column is required.')
      }

      let created = 0
      let failed = 0

      for (const payload of payloads) {
        try {
          await createSupplier(payload)
          created += 1
        } catch (error) {
          console.error('Supplier import failed', payload.name, error)
          failed += 1
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['suppliers-directory'] })

      const messages = [`Imported ${created} supplier${created === 1 ? '' : 's'}.`]

      if (skipped > 0) {
        messages.push(
          `${skipped} row${skipped === 1 ? '' : 's'} skipped because they were missing a name.`,
        )
      }

      if (failed > 0) {
        messages.push(
          `${failed} row${failed === 1 ? '' : 's'} could not be saved (often due to duplicates).`,
        )
      }

      setXlsxFeedback({
        type: failed > 0 ? 'error' : 'success',
        message: messages.join(' '),
      })
    } catch (error) {
      setXlsxFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to import suppliers from the spreadsheet.',
      })
    } finally {
      setImporting(false)
      resetImportInput()
    }
  }

  const handleCreateSupplier = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate(form)
  }

  const handleFormChange =
    (field: keyof CreateSupplierRequest) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({
        ...prev,
        [field]:
          field === 'leadTimeDays' ? Number(event.target.value ?? 0) : (event.target.value ?? ''),
      }))
    }

  const handleStartPurchaseOrder = (supplierId: string, productIds?: string[]) => {
    const params = new URLSearchParams()
    params.set('supplierId', supplierId)
    productIds?.forEach(productId => params.append('productId', productId))
    navigate(`/app/purchase-orders?${params.toString()}`)
  }

  const clearFilters = () => {
    setSelectedProducts([])
    setSelectedCategories([])
  }

  const supplierCountLabel =
    suppliersQuery.isLoading || productsQuery.isLoading
      ? 'Loading suppliers...'
      : `${filteredSuppliers.length} supplier${filteredSuppliers.length === 1 ? '' : 's'} match`

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Supplier marketplace"
        subtitle="Filter by category or SKU, then jump straight into PO creation."
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportSuppliers}
              disabled={sortedSuppliers.length === 0}
            >
              Export (.xlsx)
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importing...' : 'Import (.xlsx)'}
            </Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setDialogOpen(true)}>
              New supplier
            </Button>
          </Stack>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".xlsx,.xls"
        onChange={handleImportFileChange}
      />

      {xlsxFeedback && (
        <Alert
          severity={xlsxFeedback.type}
          onClose={() => setXlsxFeedback(null)}
          sx={{ maxWidth: 640 }}
        >
          {xlsxFeedback.message}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FilterAltIcon fontSize="small" color="primary" />
              <Typography variant="h6">Filter suppliers</Typography>
            </Stack>
            {(selectedProducts.length > 0 || selectedCategories.length > 0) && (
              <Button onClick={clearFilters}>Clear filters</Button>
            )}
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <MultiSelectAutocomplete<Product>
                options={products}
                getOptionLabel={(option: Product) => option.name}
                isOptionEqualToValue={(option: Product, value: Product) => option.id === value.id}
                value={selectedProducts}
                onChange={(_event: SyntheticEvent<Element, Event>, value: Product[]) =>
                  setSelectedProducts(value)
                }
                renderInput={params => (
                  <TextField {...params} label="Filter by product" placeholder="Type a SKU name" />
                )}
                loading={productsQuery.isLoading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MultiSelectAutocomplete<CategoryOption>
                options={categoryOptions}
                getOptionLabel={(option: CategoryOption) => option.label}
                isOptionEqualToValue={(option: CategoryOption, value: CategoryOption) =>
                  option.key === value.key
                }
                value={selectedCategories}
                onChange={(_event: SyntheticEvent<Element, Event>, value: CategoryOption[]) =>
                  setSelectedCategories(value)
                }
                renderInput={params => (
                  <TextField {...params} label="Filter by category" placeholder="Select category" />
                )}
                loading={productsQuery.isLoading}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip color="primary" label={supplierCountLabel} />
            {selectedProducts.map(product => (
              <Chip key={product.id} label={`SKU · ${product.name}`} variant="outlined" />
            ))}
            {selectedCategories.map(category => (
              <Chip key={category.key} label={`Category · ${category.label}`} variant="outlined" />
            ))}
          </Stack>
        </Stack>
      </Paper>

      {suppliersQuery.isError && <Alert severity="error">Failed to load suppliers.</Alert>}
      {productsQuery.isError && <Alert severity="error">Failed to load products.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="80px">No.</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Lead time (days)</TableCell>
              <TableCell>Categories</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliersQuery.isLoading || productsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box py={4} textAlign="center">
                    <Typography variant="h6">No suppliers match the filters.</Typography>
                    <Typography color="text.secondary">
                      Adjust the product or category selections to see more suppliers.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier, index) => {
                const supplierProducts = supplierProductsMap.get(supplier.id) ?? []
                const categoryBadges = Array.from(
                  new Map(
                    supplierProducts.map(product => {
                      const label =
                        product.categoryName?.trim() || resolveCategory(product.categoryId).label
                      return [label, label] as const
                    }),
                  ).values(),
                )

                return (
                  <TableRow hover key={supplier.id}>
                    <TableCell>
                      <Typography fontWeight={600}>{index + 1}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={600}>{supplier.name}</Typography>
                          {supplier.deleted && (
                            <Chip size="small" label="Inactive" color="warning" />
                          )}
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {supplier.contact ? (
                        <Typography>{supplier.contact}</Typography>
                      ) : (
                        <Typography color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>{supplier.leadTimeDays}</TableCell>
                    <TableCell>
                      {categoryBadges.length === 0 ? (
                        <Typography color="text.secondary">—</Typography>
                      ) : (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {categoryBadges.slice(0, 3).map(label => (
                            <Chip key={label} size="small" label={label} />
                          ))}
                          {categoryBadges.length > 3 && (
                            <Chip size="small" label={`+${categoryBadges.length - 3} more`} />
                          )}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleStartPurchaseOrder(supplier.id)}
                          startIcon={<ShoppingCartCheckoutIcon fontSize="small" />}
                        >
                          Start PO
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleCreateSupplier}>
          <DialogTitle>Add supplier</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Name"
                value={form.name}
                onChange={handleFormChange('name')}
                required
              />
              <TextField
                label="Contact"
                value={form.contact}
                onChange={handleFormChange('contact')}
              />
              <TextField
                label="Lead time (days)"
                type="number"
                value={form.leadTimeDays}
                onChange={handleFormChange('leadTimeDays')}
                required
              />
              {createMutation.isError && (
                <Alert severity="error">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Unable to create supplier.'}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  )
}

export default SuppliersPage
