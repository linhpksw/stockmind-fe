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
import { fetchAllInventorySummaries, syncInventory } from '../api/inventory'
import { SectionHeading } from '../components/common/SectionHeading'
import { useCategoryFilters, type ParentCategoryOption } from '../hooks/useCategoryFilters'
import { useProductCategoryMap } from '../hooks/useProductCategoryMap'
import { useSupplierOptions } from '../hooks/useSupplierOptions'
import type { CategoryOption } from '../utils/categories'
import type { InventoryLotSummary, InventoryProductSummary } from '../types/inventory'
import { formatDateTime } from '../utils/formatters'

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

const BaseAutocomplete = Autocomplete as unknown as (props: Record<string, unknown>) => ReactElement

const useDebouncedValue = <T,>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debounced
}

export const InventoryPage = () => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchFilter, setSearchFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string[]>([])
  const [parentCategoryFilter, setParentCategoryFilter] = useState<ParentCategoryOption[]>([])
  const [childCategoryFilter, setChildCategoryFilter] = useState<CategoryOption[]>([])
  const queryClient = useQueryClient()

  const summaryQuery = useQuery({
    queryKey: ['inventory-summary', 'all'],
    queryFn: fetchAllInventorySummaries,
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
    mutationFn: () => syncInventory(page + 1, rowsPerPage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-summary', 'all'] })
      setExpanded({})
    },
  })

  const summaries = useMemo<InventoryProductSummary[]>(
    () => summaryQuery.data ?? [],
    [summaryQuery.data],
  )

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
    return summaries.filter(product => {
      const meta = productCategoryMap.get(product.productId)
      const supplierName = product.supplierName ?? ''
      const matchesSupplier =
        supplierFilter.length === 0 ||
        (supplierName !== '' && supplierFilter.includes(supplierName))
      const matchesParent =
        selectedParentKeys.size === 0 || (meta && selectedParentKeys.has(meta.parentKey))
      const matchesChild =
        selectedChildKeys.size === 0 || (meta && selectedChildKeys.has(meta.option.key))
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.skuCode.toLowerCase().includes(search)
      return matchesSupplier && matchesParent && matchesChild && matchesSearch
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

  useEffect(() => {
    setExpanded({})
  }, [page, rowsPerPage])

  const toggleRow = (productId: number) => {
    setExpanded(prev => ({ ...prev, [productId]: !prev[productId] }))
  }

  const badgePalette = ['#1e88e5', '#7b1fa2', '#00897b', '#f4511e', '#6d4c41']

  const getBadgeStyles = (key: string) => {
    const baseColor = key
      ? badgePalette[
          key
            .trim()
            .toLowerCase()
            .split('')
            .reduce((acc, char) => acc + char.charCodeAt(0), 0) % badgePalette.length
        ]
      : '#546e7a'

    return {
      bgcolor: baseColor,
      color: '#fff',
      border: 'none',
      fontWeight: 500,
      letterSpacing: 0.2,
    }
  }

  const getSortedLots = (lots: InventoryLotSummary[]): InventoryLotSummary[] => {
    if (!lots || lots.length === 0) {
      return []
    }

    const sorted = [...lots].sort((a, b) => {
      const aTime = a.receivedAt ? Date.parse(a.receivedAt) : 0
      const bTime = b.receivedAt ? Date.parse(b.receivedAt) : 0

      if (aTime !== bTime) {
        return bTime - aTime
      }

      return b.lotId - a.lotId
    })

    return sorted
  }

  const renderLots = (product: InventoryProductSummary) => (
    <Box sx={{ backgroundColor: 'grey.50', borderRadius: 2, p: 2 }}>
      {product.lots.length === 0 ? (
        <Typography color="text.secondary">No lots received yet.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {getSortedLots(product.lots).map(lot => (
            <Stack
              key={lot.lotId}
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography fontWeight={600}>{lot.lotCode}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Received {lot.receivedAt ? formatDateTime(lot.receivedAt) : 'n/a'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Qty on hand
                  </Typography>
                  <Typography fontWeight={600}>{lot.qtyOnHand}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Expiry
                  </Typography>
                  <Typography fontWeight={600}>
                    {lot.expiryDate ? formatDateTime(lot.expiryDate) : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Unit cost
                  </Typography>
                  <Typography fontWeight={700} color="success.main">
                    {currencyFormatter.format(lot.unitCost)}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  )

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Inventory (lots)"
        subtitle="Review received stock grouped by product."
        action={
          <Stack spacing={0.5} alignItems="flex-end" textAlign="right">
            <Button variant="contained" disabled>
              Sync inventory
            </Button>
            <Typography variant="caption" color="text.secondary">
              No new GRN receipts are waiting, so sync is temporarily paused.
            </Typography>
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
            label="Search product or SKU"
            value={searchFilter}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchFilter(event.target.value)}
            size="small"
            sx={{
              minWidth: { xs: '100%', md: 240 },
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
              minWidth: { xs: '100%', md: 200 },
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
              minWidth: { xs: '100%', md: 200 },
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
              minWidth: { xs: '100%', md: 200 },
              flex: { xs: '1 1 100%', md: '0 1 220px' },
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

      {syncMutation.isError && <Alert severity="error">Unable to sync inventory snapshot.</Alert>}
      {summaryQuery.isError && <Alert severity="error">Failed to load inventory snapshot.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="60px">No.</TableCell>
              <TableCell>Product</TableCell>
              <TableCell align="center">Category</TableCell>
              <TableCell align="center">Supplier</TableCell>
              <TableCell align="right">On hand</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaryQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography textAlign="center" py={3}>
                    Loading inventory…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box py={4} textAlign="center">
                    <Typography variant="h6">No inventory available</Typography>
                    <Typography color="text.secondary">
                      Receive purchase orders to populate stock levels.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : filteredSummaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography textAlign="center" py={3}>
                    No inventory records match the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedSummaries.map((product, index) => {
                const globalIndex = page * rowsPerPage + index + 1
                const isExpanded = !!expanded[product.productId]
                return (
                  <Fragment key={product.productId}>
                    <TableRow>
                      <TableCell>
                        <Typography fontWeight={600}>{globalIndex}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <IconButton size="small" onClick={() => toggleRow(product.productId)}>
                            {isExpanded ? (
                              <KeyboardArrowDown fontSize="small" />
                            ) : (
                              <KeyboardArrowRight fontSize="small" />
                            )}
                          </IconButton>
                          {product.mediaUrl ? (
                            <Avatar src={product.mediaUrl} alt={product.name} variant="rounded" />
                          ) : (
                            <Avatar variant="rounded">
                              {product.name.slice(0, 2).toUpperCase()}
                            </Avatar>
                          )}
                          <Box>
                            <Typography fontWeight={600}>{product.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {product.skuCode} · {product.uom}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        {product.categoryName ? (
                          <Chip
                            size="small"
                            label={product.categoryName}
                            sx={getBadgeStyles(product.categoryName)}
                          />
                        ) : (
                          <Typography color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {product.supplierName ? (
                          <Chip
                            size="small"
                            label={product.supplierName}
                            sx={getBadgeStyles(product.supplierName)}
                          />
                        ) : (
                          <Typography color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>{product.onHand.toFixed(2)}</Typography>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ backgroundColor: 'grey.50' }}>
                          {renderLots(product)}
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

export default InventoryPage
