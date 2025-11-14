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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent, SyntheticEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProducts } from '../api/products'
import { createSupplier, fetchAllSuppliers, importSuppliers } from '../api/suppliers'
import { fetchCategories } from '../api/categories'
import { SectionHeading } from '../components/common/SectionHeading'
import { exportRowsToXlsx, parseFirstSheet } from '../lib/xlsx'
import { useSearchStore } from '../stores/search-store'
import type { Product } from '../types/products'
import type { CreateSupplierRequest, SupplierImportRow } from '../types/suppliers'
import { type CategoryOption, UNCATEGORIZED_CATEGORY, resolveCategory } from '../utils/categories'
import type { CategoryNode } from '../types/categories'

const BaseAutocomplete = Autocomplete as unknown as (props: Record<string, unknown>) => ReactElement

const EXCLUDED_CATEGORY_NAMES = new Set(['giá siêu rẻ', 'giá hội viên', 'ưu đãi hội viên'])
const isExcludedCategoryName = (value?: string | null): boolean =>
  value ? EXCLUDED_CATEGORY_NAMES.has(value.trim().toLowerCase()) : false

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

const getFormattedCategoryLabel = (categoryId?: string | null): string => {
  const option = resolveCategory(categoryId)
  if (
    option.key === UNCATEGORIZED_CATEGORY.key ||
    isExcludedCategoryName(option.parent) ||
    isExcludedCategoryName(option.child)
  ) {
    return '—'
  }
  return option.label
}

interface ParentCategoryOption {
  key: string
  label: string
}

interface CategoryMetaEntry {
  option: CategoryOption
  parentKey: string
}

export const SuppliersPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateSupplierRequest>({
    name: '',
    contact: '',
    leadTimeDays: 0,
  })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [parentCategoryFilter, setParentCategoryFilter] = useState<ParentCategoryOption[]>([])
  const [childCategoryFilter, setChildCategoryFilter] = useState<CategoryOption[]>([])
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

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: fetchCategories,
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

  const {
    parentCategoryOptions,
    childCategoryLookup,
    categoryMeta,
  }: {
    parentCategoryOptions: ParentCategoryOption[]
    childCategoryLookup: Map<string, CategoryOption[]>
    categoryMeta: Map<string, CategoryMetaEntry>
  } = useMemo(() => {
    const parentOptions: ParentCategoryOption[] = []
    const childLookup = new Map<string, CategoryOption[]>()
    const meta = new Map<string, CategoryMetaEntry>()

    const registerParent = (key: string, label: string) => {
      if (isExcludedCategoryName(label)) {
        return
      }
      parentOptions.push({ key, label })
      const option: CategoryOption = { key, parent: label, child: label, label }
      meta.set(key, { option, parentKey: key })
    }

    const registerChild = (
      key: string,
      parentKey: string,
      parentLabel: string,
      childLabel: string,
    ) => {
      if (isExcludedCategoryName(parentLabel) || isExcludedCategoryName(childLabel)) {
        return
      }
      const option: CategoryOption = {
        key,
        parent: parentLabel,
        child: childLabel,
        label: `${parentLabel} › ${childLabel}`,
      }
      const list = childLookup.get(parentKey) ?? []
      list.push(option)
      childLookup.set(parentKey, list)
      meta.set(key, { option, parentKey })
    }

    const registerFromTree = (nodes: CategoryNode[]) => {
      const sortedParents = [...nodes].sort((a, b) => a.name.localeCompare(b.name))
      sortedParents.forEach(parent => {
        const parentKey = String(parent.categoryId)
        registerParent(parentKey, parent.name)
        parent.children
          ?.slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach(child => {
            registerChild(String(child.categoryId), parentKey, parent.name, child.name)
          })
      })
    }

    const categoriesData = categoriesQuery.data ?? []
    if (categoriesData.length > 0) {
      registerFromTree(categoriesData)
      return {
        parentCategoryOptions: parentOptions,
        childCategoryLookup: childLookup,
        categoryMeta: meta,
      }
    }

    const fallbackChildren = new Map<string, CategoryOption>()
    products.forEach(product => {
      const option = resolveCategory(product.categoryId)
      if (
        option.key === UNCATEGORIZED_CATEGORY.key ||
        isExcludedCategoryName(option.parent) ||
        isExcludedCategoryName(option.child)
      ) {
        return
      }
      fallbackChildren.set(option.key, option)
    })
    const childValues = Array.from(fallbackChildren.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    )
    const parentMap = new Map<string, ParentCategoryOption>()
    childValues.forEach(option => {
      if (isExcludedCategoryName(option.parent)) {
        return
      }
      parentMap.set(option.parent, { key: option.parent, label: option.parent })
      meta.set(option.key, { option, parentKey: option.parent })
      const list = childLookup.get(option.parent) ?? []
      list.push(option)
      childLookup.set(option.parent, list)
    })
    const parentValues = Array.from(parentMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    )
    parentValues.forEach(parent => {
      if (!meta.has(parent.key)) {
        const parentOption: CategoryOption = {
          key: parent.key,
          parent: parent.label,
          child: parent.label,
          label: parent.label,
        }
        meta.set(parent.key, { option: parentOption, parentKey: parent.key })
      }
    })

    return {
      parentCategoryOptions: parentValues,
      childCategoryLookup: childLookup,
      categoryMeta: meta,
    }
  }, [categoriesQuery.data, products])

  const derivedChildCategoryOptions = useMemo<CategoryOption[]>(() => {
    if (parentCategoryFilter.length === 0) {
      const all = Array.from(childCategoryLookup.values()).flat()
      const unique = new Map(all.map(option => [option.key, option]))
      return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label))
    }

    const selectedParents = parentCategoryFilter.map(option => option.key)
    const aggregated = selectedParents.flatMap(
      parentKey => childCategoryLookup.get(parentKey) ?? [],
    )
    const unique = new Map(aggregated.map(option => [option.key, option]))
    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [childCategoryLookup, parentCategoryFilter])

  const getCategoryInfo = useCallback(
    (categoryId?: string | null): CategoryMetaEntry => {
      const normalized = categoryId?.trim() ?? ''
      const existing = categoryMeta.get(normalized)
      if (existing) {
        return existing
      }
      const fallback = resolveCategory(categoryId)
      return {
        option: fallback,
        parentKey: fallback.parent,
      }
    },
    [categoryMeta],
  )

  const productFilterIds = selectedProducts.map(product => product.id)
  const parentFilterKeys = parentCategoryFilter.map(option => option.key)
  const childFilterKeys = childCategoryFilter.map(option => option.key)

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
        (parentFilterKeys.length === 0 && childFilterKeys.length === 0) ||
        supplierProducts.some(product => {
          const info = getCategoryInfo(product.categoryId)
          const matchesParent =
            parentFilterKeys.length === 0 || parentFilterKeys.includes(info.parentKey)
          const matchesChild =
            childFilterKeys.length === 0 || childFilterKeys.includes(info.option.key)
          return matchesParent && matchesChild
        })

      return matchesProductFilter && matchesCategoryFilter
    })
  }, [
    sortedSuppliers,
    supplierProductsMap,
    globalQuery,
    productFilterIds,
    parentFilterKeys,
    childFilterKeys,
    getCategoryInfo,
  ])

  const totalFilteredSuppliers = filteredSuppliers.length
  const paginatedSuppliers = useMemo(() => {
    const start = page * rowsPerPage
    return filteredSuppliers.slice(start, start + rowsPerPage)
  }, [filteredSuppliers, page, rowsPerPage])

  const resetImportInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (parentCategoryFilter.length === 0) {
      return
    }
    const allowed = new Set(derivedChildCategoryOptions.map(option => option.key))
    setChildCategoryFilter(prev => {
      const next = prev.filter(option => allowed.has(option.key))
      return next.length === prev.length ? prev : next
    })
  }, [parentCategoryFilter, derivedChildCategoryOptions])

  useEffect(() => {
    setPage(0)
  }, [globalQuery, parentCategoryFilter, childCategoryFilter, selectedProducts])

  useEffect(() => {
    if (page * rowsPerPage >= Math.max(totalFilteredSuppliers, 1) && page !== 0) {
      setPage(0)
    }
  }, [page, rowsPerPage, totalFilteredSuppliers])

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

      const importRows: SupplierImportRow[] = []
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
        const supplierId = normalizeString(
          row['supplier_id'] ??
            row['Supplier ID'] ??
            row['SupplierId'] ??
            row['SUPPLIER_ID'] ??
            row['id'] ??
            row['ID'],
        )
        const leadTimeDays = normalizeLeadTime(
          row['lead_time_days'] ??
            row['Lead Time Days'] ??
            row['leadTimeDays'] ??
            row['lead_time'] ??
            row['Lead Time'] ??
            row['lead time'],
        )

        importRows.push({
          supplierId: supplierId || undefined,
          name,
          contact: contact || undefined,
          leadTimeDays,
        })
      })

      if (importRows.length === 0) {
        throw new Error('No valid supplier rows found. Include at least a "name" column.')
      }

      const result = await importSuppliers({ rows: importRows })

      await queryClient.invalidateQueries({ queryKey: ['suppliers-directory'] })

      const messages: string[] = []

      if (result.created > 0) {
        messages.push(`Created ${result.created} supplier${result.created === 1 ? '' : 's'}.`)
      }

      if (result.updated > 0) {
        messages.push(`Updated ${result.updated} supplier${result.updated === 1 ? '' : 's'}.`)
      }

      const totalSkipped = result.skippedInvalid + skipped
      if (totalSkipped > 0) {
        messages.push(
          `${totalSkipped} row${totalSkipped === 1 ? '' : 's'} skipped because they were invalid or missing a name.`,
        )
      }

      setXlsxFeedback({
        type: result.skippedInvalid > 0 ? 'error' : 'success',
        message:
          messages.length > 0
            ? messages.join(' ')
            : 'No rows were imported. Verify the spreadsheet contents and try again.',
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
    setParentCategoryFilter([])
    setChildCategoryFilter([])
  }

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
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
            {(selectedProducts.length > 0 ||
              parentCategoryFilter.length > 0 ||
              childCategoryFilter.length > 0) && (
              <Button onClick={clearFilters}>Clear filters</Button>
            )}
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
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
            <Grid item xs={12} md={4}>
              <MultiSelectAutocomplete<ParentCategoryOption>
                options={parentCategoryOptions}
                value={parentCategoryFilter}
                onChange={(_event: SyntheticEvent<Element, Event>, value: ParentCategoryOption[]) =>
                  setParentCategoryFilter(value)
                }
                getOptionLabel={(option: ParentCategoryOption) => option.label}
                isOptionEqualToValue={(option: ParentCategoryOption, value: ParentCategoryOption) =>
                  option.key === value.key
                }
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Category level 1"
                    placeholder="All parent categories"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <MultiSelectAutocomplete<CategoryOption>
                options={derivedChildCategoryOptions}
                value={childCategoryFilter}
                onChange={(_event: SyntheticEvent<Element, Event>, value: CategoryOption[]) =>
                  setChildCategoryFilter(value)
                }
                getOptionLabel={(option: CategoryOption) => option.label}
                isOptionEqualToValue={(option: CategoryOption, value: CategoryOption) =>
                  option.key === value.key
                }
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Category level 2"
                    placeholder="All child categories"
                  />
                )}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip color="primary" label={supplierCountLabel} />
            {selectedProducts.map(product => (
              <Chip key={product.id} label={`SKU · ${product.name}`} variant="outlined" />
            ))}
            {parentCategoryFilter.map(option => (
              <Chip
                key={`parent-${option.key}`}
                label={`Cat 1 · ${option.label}`}
                variant="outlined"
              />
            ))}
            {childCategoryFilter.map(option => (
              <Chip
                key={`child-${option.key}`}
                label={`Cat 2 · ${option.child}`}
                variant="outlined"
              />
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
              <TableCell align="center">Contact</TableCell>
              <TableCell align="center">Lead time (days)</TableCell>
              <TableCell>Categories</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliersQuery.isLoading || productsQuery.isLoading ? (
              Array.from({ length: rowsPerPage }).map((_, skeletonIndex) => (
                <TableRow key={`supplier-skeleton-${skeletonIndex}`}>
                  <TableCell colSpan={6}>
                    <Skeleton variant="rectangular" height={48} animation="wave" />
                  </TableCell>
                </TableRow>
              ))
            ) : totalFilteredSuppliers === 0 ? (
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
              paginatedSuppliers.map((supplier, index) => {
                const supplierProducts = supplierProductsMap.get(supplier.id) ?? []
                const categoryBadges = Array.from(
                  new Map(
                    supplierProducts.map(product => {
                      const label =
                        product.categoryName?.trim() ||
                        getFormattedCategoryLabel(product.categoryId)
                      return [label, label] as const
                    }),
                  ).values(),
                ).filter(label => label !== '—')

                return (
                  <TableRow hover key={supplier.id}>
                    <TableCell>
                      <Typography fontWeight={600}>{page * rowsPerPage + index + 1}</Typography>
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
                    <TableCell align="center">
                      {supplier.contact ? (
                        <Typography>{supplier.contact}</Typography>
                      ) : (
                        <Typography color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography>{supplier.leadTimeDays}</Typography>
                    </TableCell>
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
      <TablePagination
        component="div"
        count={totalFilteredSuppliers}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
      />

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
