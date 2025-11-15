import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import Autocomplete, { type AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import { fetchAllPurchaseOrderSummaries, syncPurchaseOrders } from '../api/purchaseOrders'
import { SectionHeading } from '../components/common/SectionHeading'
import { useCategoryFilters, type ParentCategoryOption } from '../hooks/useCategoryFilters'
import { useProductCategoryMap } from '../hooks/useProductCategoryMap'
import { useSupplierOptions } from '../hooks/useSupplierOptions'
import type { CategoryOption } from '../utils/categories'
import type { PurchaseOrderSummary } from '../types/purchaseOrders'
import { formatDateTime } from '../utils/formatters'

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

const BaseAutocomplete = Autocomplete as unknown as (props: Record<string, unknown>) => ReactElement

const getInitials = (name: string) => name.trim().slice(0, 2).toUpperCase() || 'PD'

const useDebouncedValue = <T,>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debounced
}

export const PurchaseOrdersPage = () => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [syncDisabled, setSyncDisabled] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string[]>([])
  const [parentCategoryFilter, setParentCategoryFilter] = useState<ParentCategoryOption[]>([])
  const [childCategoryFilter, setChildCategoryFilter] = useState<CategoryOption[]>([])
  const queryClient = useQueryClient()

  const summaryQuery = useQuery({
    queryKey: ['purchase-orders-summary', 'all'],
    queryFn: fetchAllPurchaseOrderSummaries,
  })
  const {
    parentCategoryOptions,
    childCategoryLookup,
    childCategoryOptions,
    categoryMeta,
    isLoading: isCategoryLoading,
  } = useCategoryFilters()
  const { productCategoryMap } = useProductCategoryMap(categoryMeta)
  const { supplierOptions, isLoading: isSupplierLoading } = useSupplierOptions()

  const syncMutation = useMutation({
    mutationFn: () => syncPurchaseOrders(page + 1, rowsPerPage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-summary', 'all'] })
      setExpanded({})
      setSyncDisabled(true)
    },
  })

  const summaries = useMemo<PurchaseOrderSummary[]>(
    () => summaryQuery.data ?? [],
    [summaryQuery.data],
  )
  const totalRows = summaries.length

  useEffect(() => {
    if (totalRows > 0) {
      setSyncDisabled(true)
    }
  }, [totalRows])

  const debouncedSearch = useDebouncedValue(searchFilter)

  const derivedChildCategoryOptions = useMemo(() => {
    if (parentCategoryFilter.length === 0) {
      return childCategoryOptions
    }
    const aggregated = parentCategoryFilter.flatMap(
      option => childCategoryLookup.get(option.key) ?? [],
    )
    const unique = new Map(aggregated.map(option => [option.key, option]))
    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [parentCategoryFilter, childCategoryLookup, childCategoryOptions])

  const selectedParentKeys = useMemo(
    () => new Set(parentCategoryFilter.map(option => option.key)),
    [parentCategoryFilter],
  )
  const selectedChildKeys = useMemo(
    () => new Set(childCategoryFilter.map(option => option.key)),
    [childCategoryFilter],
  )

  const filteredSummaries = useMemo(() => {
    const search = debouncedSearch.trim().toLowerCase()
    return summaries.filter(order => {
      const matchesSupplier =
        supplierFilter.length === 0 || supplierFilter.includes(order.supplierName)
      const matchesParent =
        selectedParentKeys.size === 0 ||
        order.items.some(item => {
          const meta = productCategoryMap.get(item.productId)
          return meta && selectedParentKeys.has(meta.parentKey)
        })
      const matchesChild =
        selectedChildKeys.size === 0 ||
        order.items.some(item => {
          const meta = productCategoryMap.get(item.productId)
          return meta && selectedChildKeys.has(meta.option.key)
        })
      const matchesSearch =
        !search ||
        order.supplierName.toLowerCase().includes(search) ||
        order.items.some(item => item.productName.toLowerCase().includes(search))
      return matchesSupplier && matchesSearch && matchesParent && matchesChild
    })
  }, [
    summaries,
    supplierFilter,
    debouncedSearch,
    selectedParentKeys,
    selectedChildKeys,
    productCategoryMap,
  ])

  const hasFilters =
    Boolean(searchFilter) ||
    supplierFilter.length > 0 ||
    parentCategoryFilter.length > 0 ||
    childCategoryFilter.length > 0

  const totalFilteredSummaries = filteredSummaries.length
  const paginatedSummaries = useMemo(() => {
    const start = page * rowsPerPage
    return filteredSummaries.slice(start, start + rowsPerPage)
  }, [filteredSummaries, page, rowsPerPage])

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(totalFilteredSummaries / rowsPerPage) - 1, 0)
    if (page > maxPage) {
      setPage(maxPage)
    }
  }, [page, rowsPerPage, totalFilteredSummaries])

  const clearFilters = () => {
    setSearchFilter('')
    setSupplierFilter([])
    setParentCategoryFilter([])
    setChildCategoryFilter([])
  }

  const toggleSupplier = (poId: number) => {
    setExpanded(prev => ({ ...prev, [poId]: !prev[poId] }))
  }

  const renderItems = (order: PurchaseOrderSummary) => (
    <Box sx={{ backgroundColor: 'grey.50', borderRadius: 2, p: 2 }}>
      <Stack spacing={1.5}>
        {order.items.map(item => (
          <Stack
            key={`${order.poId}-${item.productId}`}
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            sx={{
              p: 1.5,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box flex={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                {item.mediaUrl ? (
                  <Avatar src={item.mediaUrl} alt={item.productName} variant="rounded" />
                ) : (
                  <Avatar variant="rounded">{getInitials(item.productName)}</Avatar>
                )}
                <Box>
                  <Typography fontWeight={600}>{item.productName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    SKU #{item.productId} · {item.uom}
                  </Typography>
                </Box>
              </Stack>
            </Box>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary">
                  Quantity
                </Typography>
                <Typography fontWeight={600}>{item.qty}</Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">
                  Unit cost
                </Typography>
                <Typography fontWeight={700} color="success.main">
                  {currencyFormatter.format(item.unitCost)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">
                  Expected date
                </Typography>
                <Typography fontWeight={600}>
                  {item.expectedDate ? formatDateTime(item.expectedDate, 'dd MMM yyyy') : '—'}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Box>
  )

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Purchase orders"
        subtitle="Auto-generate replenishment orders per supplier."
        action={
          <Stack spacing={0.5} alignItems="flex-end" textAlign="right">
            <Button
              variant="contained"
              onClick={() => syncMutation.mutate()}
              disabled={syncDisabled || syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Syncing…' : 'Sync master data'}
            </Button>
            {syncDisabled && (
              <Typography variant="caption" color="text.secondary">
                Master data is already synced; new purchase orders will appear once upstream records
                change.
              </Typography>
            )}
          </Stack>
        }
      />

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterAltIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={600}>
              Filter catalog
            </Typography>
          </Stack>
          {hasFilters && (
            <Button size="small" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Stack>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          mt={2}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            label="Search supplier or product"
            value={searchFilter}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchFilter(event.target.value)}
            size="small"
            sx={{
              minWidth: { xs: '100%', md: 260 },
              flex: { xs: '1 1 100%', md: '1 1 260px' },
            }}
          />
          <BaseAutocomplete
            multiple
            options={parentCategoryOptions}
            value={parentCategoryFilter}
            onChange={(_event: SyntheticEvent<Element, Event>, value: ParentCategoryOption[]) =>
              setParentCategoryFilter(value)
            }
            getOptionLabel={(option: ParentCategoryOption) => option.label}
            isOptionEqualToValue={(option: ParentCategoryOption, value: ParentCategoryOption) =>
              option.key === value.key
            }
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Category level 1" size="small" placeholder="All" />
            )}
            sx={{
              minWidth: { xs: '100%', md: 220 },
              flex: { xs: '1 1 100%', md: '0 1 220px' },
            }}
            loading={isCategoryLoading}
          />
          <BaseAutocomplete
            multiple
            options={derivedChildCategoryOptions}
            value={childCategoryFilter}
            onChange={(_event: SyntheticEvent<Element, Event>, value: CategoryOption[]) =>
              setChildCategoryFilter(value)
            }
            getOptionLabel={(option: CategoryOption) => option.child}
            isOptionEqualToValue={(option: CategoryOption, value: CategoryOption) =>
              option.key === value.key
            }
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Category level 2" size="small" placeholder="All" />
            )}
            sx={{
              minWidth: { xs: '100%', md: 220 },
              flex: { xs: '1 1 100%', md: '0 1 220px' },
            }}
            loading={isCategoryLoading}
          />
          <BaseAutocomplete
            multiple
            options={supplierOptions}
            value={supplierFilter}
            onChange={(_event: SyntheticEvent<Element, Event>, value: string[]) =>
              setSupplierFilter(value)
            }
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Suppliers" size="small" />
            )}
            sx={{
              minWidth: { xs: '100%', md: 240 },
              flex: { xs: '1 1 100%', md: '0 1 240px' },
            }}
            loading={isSupplierLoading}
          />
        </Stack>
        {hasFilters && (
          <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
            {searchFilter && <Chip label={`Search · "${searchFilter}"`} />}
            {parentCategoryFilter.map(option => (
              <Chip key={`parent-${option.key}`} label={`Cat 1 · ${option.label}`} />
            ))}
            {childCategoryFilter.map(option => (
              <Chip key={`child-${option.key}`} label={`Cat 2 · ${option.child}`} />
            ))}
            {supplierFilter.map(name => (
              <Chip key={name} label={`Supplier · ${name}`} />
            ))}
          </Stack>
        )}
      </Paper>

      {syncMutation.isError && (
        <Alert severity="error">Unable to sync purchase orders. Please try again.</Alert>
      )}

      {summaryQuery.isError && <Alert severity="error">Failed to load purchase orders.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="60px">No.</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Total qty</TableCell>
              <TableCell align="right">Total cost</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Items</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaryQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography py={3} textAlign="center">
                    Loading purchase orders…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Box py={4} textAlign="center">
                    <Typography variant="h6">No purchase orders yet</Typography>
                    <Typography color="text.secondary">
                      Click “Sync master data” to auto-generate orders for each supplier.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedSummaries.map((order, index) => {
                const globalIndex = page * rowsPerPage + index + 1
                const isExpanded = !!expanded[order.poId]
                return (
                  <Fragment key={order.poId}>
                    <TableRow>
                      <TableCell>
                        <Typography fontWeight={600}>{globalIndex}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <IconButton size="small" onClick={() => toggleSupplier(order.poId)}>
                            {isExpanded ? (
                              <KeyboardArrowDown fontSize="small" />
                            ) : (
                              <KeyboardArrowRight fontSize="small" />
                            )}
                          </IconButton>
                          <Box>
                            <Typography fontWeight={600}>{order.supplierName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {order.items.length} SKU{order.items.length === 1 ? '' : 's'}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={order.status}
                          color={order.status === 'OPEN' ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontWeight={700} color="primary.main">
                          {order.totalQty.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="success.main">
                          {currencyFormatter.format(order.totalCost)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => toggleSupplier(order.poId)}>
                          {isExpanded ? 'Hide items' : 'Show items'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ backgroundColor: 'grey.50' }}>
                          {renderItems(order)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalFilteredSummaries}
        page={page}
        onPageChange={(_event: unknown, newPage: number) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          setRowsPerPage(parseInt(event.target.value, 10))
          setPage(0)
        }}
        rowsPerPageOptions={[10, 25, 50]}
      />
    </Stack>
  )
}

export default PurchaseOrdersPage
