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
import { listInventorySummary, syncInventory } from '../api/inventory'
import { SectionHeading } from '../components/common/SectionHeading'
import type { InventoryProductSummary } from '../types/inventory'
import { formatDateTime } from '../utils/formatters'

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

export const InventoryPage = () => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const queryClient = useQueryClient()

  const summaryQuery = useQuery({
    queryKey: ['inventory-summary', page, rowsPerPage],
    queryFn: () => listInventorySummary(page + 1, rowsPerPage),
  })

  const syncMutation = useMutation({
    mutationFn: () => syncInventory(page + 1, rowsPerPage),
    onSuccess: data => {
      queryClient.setQueryData(['inventory-summary', page, rowsPerPage], data)
      setExpanded({})
    },
  })

  const summaries = useMemo<InventoryProductSummary[]>(
    () => summaryQuery.data?.data ?? [],
    [summaryQuery.data],
  )
  const totalRows = summaryQuery.data?.total ?? 0

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

  const renderLots = (product: InventoryProductSummary) => (
    <Box sx={{ backgroundColor: 'grey.50', borderRadius: 2, p: 2 }}>
      {product.lots.length === 0 ? (
        <Typography color="text.secondary">No lots received yet.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {product.lots.map(lot => (
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
            ) : (
              summaries.map((product, index) => {
                const isExpanded = !!expanded[product.productId]
                return (
                  <Fragment key={product.productId}>
                    <TableRow>
                      <TableCell>
                        <Typography fontWeight={600}>{page * rowsPerPage + index + 1}</Typography>
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

export default InventoryPage
