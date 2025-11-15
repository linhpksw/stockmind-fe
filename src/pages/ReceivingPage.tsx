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
import { listGrnSummary, syncReceiving } from '../api/grn'
import { SectionHeading } from '../components/common/SectionHeading'
import type { GrnSummary } from '../types/grn'
import { formatDateTime } from '../utils/formatters'

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

const getInitials = (name: string) => name.trim().slice(0, 2).toUpperCase() || 'PD'

export const ReceivingPage = () => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const queryClient = useQueryClient()

  const summaryQuery = useQuery({
    queryKey: ['grn-summary', page, rowsPerPage],
    queryFn: () => listGrnSummary(page + 1, rowsPerPage),
  })

  const syncMutation = useMutation({
    mutationFn: () => syncReceiving(page + 1, rowsPerPage),
    onSuccess: data => {
      queryClient.setQueryData(['grn-summary', page, rowsPerPage], data)
      setExpanded({})
    },
  })

  const summaries = useMemo<GrnSummary[]>(() => summaryQuery.data?.data ?? [], [summaryQuery.data])
  const pendingCount = useMemo(
    () => summaries.filter(summary => summary.status !== 'RECEIVED').length,
    [summaries],
  )
  const totalRows = summaryQuery.data?.total ?? 0

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
    const isPending = grn.status !== 'RECEIVED'

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
                    {isPending ? 'Expected date' : 'Expiry'}
                  </Typography>
                  <Typography fontWeight={600}>
                    {isPending
                      ? formatDateTime(item.expectedDate ?? grn.receivedAt, 'dd MMM yyyy')
                      : item.expiryDate
                        ? formatDateTime(item.expiryDate, 'dd MMM yyyy')
                        : '—'}
                  </Typography>
                </Box>
                {!isPending && (
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
                {pendingCount} purchase order{pendingCount === 1 ? '' : 's'} ready to receive.
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                All purchase orders are already received; new GRNs will appear here automatically.
              </Typography>
            )}
          </Stack>
        }
      />

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
            ) : (
              summaries.map((grn, index) => {
                const key = buildRowKey(grn)
                const isExpanded = !!expanded[key]
                const isPending = grn.status !== 'RECEIVED'
                const itemLabel = `${grn.items.length} ${isPending ? 'item' : 'lot'}${
                  grn.items.length === 1 ? '' : 's'
                }`

                return (
                  <Fragment key={key}>
                    <TableRow>
                      <TableCell>
                        <Typography fontWeight={600}>{page * rowsPerPage + index + 1}</Typography>
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
                          <Chip
                            size="small"
                            label={isPending ? 'Awaiting receipt' : 'Received'}
                            color={isPending ? 'warning' : 'success'}
                          />
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
                        {isPending ? (
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
                        <Button size="small" onClick={() => toggleRow(grn)}>
                          {isExpanded ? 'Hide details' : `Show ${itemLabel}`}
                        </Button>
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

export default ReceivingPage
