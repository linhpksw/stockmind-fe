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
import { acceptGrn, cancelGrn, fetchAllGrnSummaries, syncReceiving } from '../api/grn'
import { SectionHeading } from '../components/common/SectionHeading'
import { useCategoryFilters, type ParentCategoryOption } from '../hooks/useCategoryFilters'
import { useProductCategoryMap } from '../hooks/useProductCategoryMap'
import { useSupplierOptions } from '../hooks/useSupplierOptions'
import type { CategoryOption } from '../utils/categories'
import type { GrnSummary } from '../types/grn'
import { formatDateTime } from '../utils/formatters'

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

const getInitials = (name: string) => name.trim().slice(0, 2).toUpperCase() || 'PD'

const BaseAutocomplete = Autocomplete as unknown as (props: Record<string, unknown>) => ReactElement

const useDebouncedValue = <T,>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debounced
}

export const ReceivingPage = () => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchFilter, setSearchFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [parentCategoryFilter, setParentCategoryFilter] = useState<ParentCategoryOption[]>([])
  const [childCategoryFilter, setChildCategoryFilter] = useState<CategoryOption[]>([])
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [activePo, setActivePo] = useState<{ poId: number; action: 'accept' | 'cancel' } | null>(
    null,
  )
  const queryClient = useQueryClient()

  const summaryQuery = useQuery({
    queryKey: ['grn-summary', 'all'],
    queryFn: fetchAllGrnSummaries,
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
    mutationFn: () => syncReceiving(page + 1, rowsPerPage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn-summary', 'all'] })
      setExpanded({})
    },
  })

  const summaries = useMemo<GrnSummary[]>(() => summaryQuery.data ?? [], [summaryQuery.data])
  const pendingCount = useMemo(
    () => summaries.filter(summary => summary.status === 'OPEN').length,
    [summaries],
  )
  const statusOptions = useMemo(
    () => Array.from(new Set(summaries.map(grn => grn.status))),
    [summaries],
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
    return summaries.filter(grn => {
      const matchesSupplier =
        supplierFilter.length === 0 || supplierFilter.includes(grn.supplierName)
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(grn.status)
      const matchesParent =
        selectedParentKeys.size === 0 ||
        grn.items.some(item => {
          const meta = productCategoryMap.get(item.productId)
          return meta && selectedParentKeys.has(meta.parentKey)
        })
      const matchesChild =
        selectedChildKeys.size === 0 ||
        grn.items.some(item => {
          const meta = productCategoryMap.get(item.productId)
          return meta && selectedChildKeys.has(meta.option.key)
        })
      const matchesSearch =
        !search ||
        grn.supplierName.toLowerCase().includes(search) ||
        grn.items.some(item => item.productName.toLowerCase().includes(search))
      return matchesSupplier && matchesStatus && matchesParent && matchesChild && matchesSearch
    })
  }, [
    summaries,
    supplierFilter,
    statusFilter,
    debouncedSearch,
    selectedParentKeys,
    selectedChildKeys,
    productCategoryMap,
  ])

  const hasFilters =
    Boolean(searchFilter) ||
    supplierFilter.length > 0 ||
    statusFilter.length > 0 ||
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
    setStatusFilter([])
    setParentCategoryFilter([])
    setChildCategoryFilter([])
  }

  const invalidateLists = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['grn-summary', 'all'] }),
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-summary', 'all'] }),
    ])
  }

  const acceptMutation = useMutation({
    mutationFn: (poId: number) => acceptGrn(poId),
    onMutate: poId => setActivePo({ poId, action: 'accept' }),
    onSuccess: async summary => {
      await invalidateLists()
      setActionFeedback({
        type: 'success',
        message: `PO #${summary.poId} marked as received.`,
      })
    },
    onError: error => {
      setActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to accept this PO.',
      })
    },
    onSettled: () => setActivePo(null),
  })

  const cancelMutation = useMutation({
    mutationFn: (poId: number) => cancelGrn(poId),
    onMutate: poId => setActivePo({ poId, action: 'cancel' }),
    onSuccess: async summary => {
      await invalidateLists()
      setActionFeedback({
        type: 'success',
        message: `PO #${summary.poId} cancelled.`,
      })
    },
    onError: error => {
      setActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to cancel this PO.',
      })
    },
    onSettled: () => setActivePo(null),
  })

  useEffect(() => {
    setExpanded({})
  }, [page, rowsPerPage])

  const buildRowKey = (grn: GrnSummary) =>
    grn.status === 'RECEIVED' ? `grn-${grn.grnId}` : `po-${grn.poId}`

  const toggleRow = (grn: GrnSummary) => {
    const key = buildRowKey(grn)
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const renderItems = (grn: GrnSummary) => {
    const isPending = grn.status === 'OPEN'
    const isCancelled = grn.status === 'CANCELLED'

    return (
      <Box sx={{ backgroundColor: 'grey.50', borderRadius: 2, p: 2 }}>
        <Stack spacing={1.5}>
          {grn.items.map(item => (
            <Stack
              key={`${grn.grnId}-${grn.status}-${item.productId}-${item.lotCode ?? 'pending'}`}
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
                      {isPending
                        ? `SKU #${item.productId}`
                        : `Lot ${item.lotCode ?? '—'} · SKU #${item.productId}`}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">
                    Quantity
                  </Typography>
                  <Typography fontWeight={600}>{item.qtyReceived}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">
                    Unit cost
                  </Typography>
                  <Typography fontWeight={700} color="success.main">
                    {currencyFormatter.format(item.unitCost)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', minWidth: 140 }}>
                  <Typography variant="caption" color="text.secondary">
                    {isPending || isCancelled ? 'Expected date' : 'Expiry'}
                  </Typography>
                  <Typography fontWeight={600}>
                    {isPending || isCancelled
                      ? formatDateTime(item.expectedDate ?? grn.receivedAt, 'dd MMM yyyy')
                      : item.expiryDate
                        ? formatDateTime(item.expiryDate, 'dd MMM yyyy')
                        : '—'}
                  </Typography>
                </Box>
                {!isPending && !isCancelled && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Lot code
                    </Typography>
                    <Typography fontWeight={600}>{item.lotCode ?? '—'}</Typography>
                  </Box>
                )}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Box>
    )
  }

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Receiving (GRN)"
        subtitle="Accept incoming purchase orders and capture lot details."
        action={
          <Stack spacing={0.5} alignItems="flex-end" textAlign="right">
            <Button
              variant="contained"
              onClick={() => syncMutation.mutate()}
              disabled={pendingCount === 0 || syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Syncing…' : 'Accept all PO'}
            </Button>
            {pendingCount > 0 ? (
              <Typography variant="caption" color="text.secondary">
                {pendingCount} open purchase order{pendingCount === 1 ? '' : 's'} ready to receive.
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                All purchase orders are already received or closed; new GRNs will appear here
                automatically.
              </Typography>
            )}
          </Stack>
        }
      />

      {actionFeedback && (
        <Alert
          severity={actionFeedback.type}
          onClose={() => setActionFeedback(null)}
          sx={{ maxWidth: 720 }}
        >
          {actionFeedback.message}
        </Alert>
      )}

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
          <BaseAutocomplete
            multiple
            options={statusOptions}
            value={statusFilter}
            onChange={(_event: SyntheticEvent<Element, Event>, value: string[]) =>
              setStatusFilter(value)
            }
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Status" size="small" />
            )}
            sx={{
              minWidth: { xs: '100%', md: 200 },
              flex: { xs: '1 1 100%', md: '0 1 200px' },
            }}
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
            {statusFilter.map(status => (
              <Chip key={status} label={`Status · ${status}`} />
            ))}
          </Stack>
        )}
      </Paper>

      {syncMutation.isError && <Alert severity="error">Unable to sync GRNs.</Alert>}
      {summaryQuery.isError && <Alert severity="error">Failed to load GRNs.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="60px">No.</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell>PO</TableCell>
              <TableCell align="center">Total qty</TableCell>
              <TableCell align="right">Total cost</TableCell>
              <TableCell>Received at</TableCell>
              <TableCell align="right">Lots</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaryQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography textAlign="center" py={3}>
                    Loading receipts…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : summaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Box py={4} textAlign="center">
                    <Typography variant="h6">No GRNs available</Typography>
                    <Typography color="text.secondary">
                      Sync purchase orders first, then accept them here.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : filteredSummaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography textAlign="center" py={3}>
                    No GRNs match the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedSummaries.map((grn, index) => {
                const globalIndex = page * rowsPerPage + index + 1
                const key = buildRowKey(grn)
                const isExpanded = !!expanded[key]
                const isOpen = grn.status === 'OPEN'
                const isCancelled = grn.status === 'CANCELLED'
                const isPending = isOpen
                const isWorking = activePo?.poId === grn.poId
                const statusLabel = isCancelled
                  ? 'Cancelled'
                  : isOpen
                    ? 'Awaiting receipt'
                    : 'Received'
                const statusColor = isCancelled ? 'error' : isOpen ? 'warning' : 'success'
                const itemLabel = `${grn.items.length} ${isPending ? 'item' : 'lot'}${grn.items.length === 1 ? '' : 's'}`

                return (
                  <Fragment key={key}>
                    <TableRow>
                      <TableCell>
                        <Typography fontWeight={600}>{globalIndex}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <IconButton size="small" onClick={() => toggleRow(grn)}>
                            {isExpanded ? (
                              <KeyboardArrowDown fontSize="small" />
                            ) : (
                              <KeyboardArrowRight fontSize="small" />
                            )}
                          </IconButton>
                          <Box>
                            <Typography fontWeight={600}>{grn.supplierName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {itemLabel}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          rowGap={0.5}
                        >
                          <Chip size="small" label={`PO #${grn.poId}`} />
                          <Chip size="small" label={statusLabel} color={statusColor} />
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontWeight={700} color="primary.main">
                          {grn.totalQty.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="success.main">
                          {currencyFormatter.format(grn.totalCost)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {isOpen ? (
                          <Box>
                            <Typography fontWeight={600}>
                              {formatDateTime(grn.receivedAt, 'dd MMM yyyy')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Expected arrival
                            </Typography>
                          </Box>
                        ) : (
                          <Typography fontWeight={600}>{formatDateTime(grn.receivedAt)}</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          flexWrap="wrap"
                        >
                          {isOpen && (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => acceptMutation.mutate(grn.poId)}
                                disabled={
                                  acceptMutation.isPending ||
                                  cancelMutation.isPending ||
                                  (isWorking && activePo?.action === 'cancel')
                                }
                              >
                                {isWorking && activePo?.action === 'accept'
                                  ? 'Accepting…'
                                  : 'Accept'}
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => cancelMutation.mutate(grn.poId)}
                                disabled={
                                  acceptMutation.isPending ||
                                  cancelMutation.isPending ||
                                  (isWorking && activePo?.action === 'accept')
                                }
                              >
                                {isWorking && activePo?.action === 'cancel'
                                  ? 'Cancelling…'
                                  : 'Cancel'}
                              </Button>
                            </>
                          )}
                          <Button size="small" onClick={() => toggleRow(grn)}>
                            {isExpanded ? 'Hide details' : 'Show details'}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ backgroundColor: 'grey.50' }}>
                          {renderItems(grn)}
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

export default ReceivingPage
