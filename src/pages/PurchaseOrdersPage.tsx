import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
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
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { listPurchaseOrderSummary, syncPurchaseOrders } from '../api/purchaseOrders'
import { SectionHeading } from '../components/common/SectionHeading'
import type { PurchaseOrderSummary } from '../types/purchaseOrders'
import { formatDateTime } from '../utils/formatters'

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

const getInitials = (name: string) => name.trim().slice(0, 2).toUpperCase() || 'PD'

export const PurchaseOrdersPage = () => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [syncDisabled, setSyncDisabled] = useState(false)
  const queryClient = useQueryClient()

  const summaryQuery = useQuery({
    queryKey: ['purchase-orders-summary', page, rowsPerPage],
    queryFn: () => listPurchaseOrderSummary(page + 1, rowsPerPage),
  })

  const syncMutation = useMutation({
    mutationFn: () => syncPurchaseOrders(page + 1, rowsPerPage),
    onSuccess: data => {
      queryClient.setQueryData(['purchase-orders-summary', page, rowsPerPage], data)
      setExpanded({})
      setSyncDisabled(true)
    },
  })

  const summaries = useMemo<PurchaseOrderSummary[]>(
    () => summaryQuery.data?.data ?? [],
    [summaryQuery.data],
  )
  const totalRows = summaryQuery.data?.total ?? 0

  useEffect(() => {
    if (totalRows > 0) {
      setSyncDisabled(true)
    }
  }, [totalRows])

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
              summaries.map((order, index) => {
                const isExpanded = !!expanded[order.poId]
                return (
                  <Fragment key={order.poId}>
                    <TableRow>
                      <TableCell>
                        <Typography fontWeight={600}>{page * rowsPerPage + index + 1}</Typography>
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
        count={totalRows}
        page={page}
        onPageChange={(_event, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={event => {
          setRowsPerPage(parseInt(event.target.value, 10))
          setPage(0)
        }}
        rowsPerPageOptions={[10, 25, 50]}
      />
    </Stack>
  )
}

export default PurchaseOrdersPage
