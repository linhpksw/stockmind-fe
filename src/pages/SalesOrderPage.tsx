import {
  Add,
  Delete,
  Loyalty,
  PersonAddAlt1,
  PointOfSale,
  Refresh,
  Search,
} from '@mui/icons-material'
import Autocomplete, { type AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  type AlertColor,
} from '@mui/material'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createCustomer, lookupCustomerByPhone } from '../api/customers'
import {
  createSalesOrder,
  fetchSalesOrderContext,
  getPendingSalesOrderStatus,
  searchSellableLots,
} from '../api/salesOrders'
import { SectionHeading } from '../components/common/SectionHeading'
import { useCategoryFilters } from '../hooks/useCategoryFilters'
import { useSupplierOptions } from '../hooks/useSupplierOptions'
import type { CategoryOption } from '../utils/categories'
import type { Customer } from '../types/customers'
import type { ParentCategoryOption } from '../hooks/useCategoryFilters'
import type {
  CreateSalesOrderLineInput,
  CreateSalesOrderRequest,
  CreateSalesOrderResponse,
  PendingSalesOrder,
  SellableLot,
  SellableLotQuery,
} from '../types/salesOrders'
import type { Supplier } from '../types/suppliers'

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

const formatCurrency = (value: number): string => currencyFormatter.format(value || 0)

interface ApiErrorResponse {
  code?: string
  message?: string
  errors?: string[]
}

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? fallback
  }
  return fallback
}

const useDebouncedValue = <T,>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

const roundQuantity = (value: number, uom: string): number => {
  if (uom.trim().toUpperCase() === 'KG') {
    return Math.round(value * 1000) / 1000
  }
  return Math.round(value)
}

interface OrderLine extends SellableLot {
  lineId: string
  quantity: number
  manual?: boolean
}

type AlertSource = 'manual' | 'derived'

interface AlertMessage {
  id: string
  text: string
  severity: AlertColor
  source: AlertSource
}

interface CustomerFormState {
  fullName: string
  phoneNumber: string
  email: string
  loyaltyCode: string
}

const defaultCustomerForm: CustomerFormState = {
  fullName: '',
  phoneNumber: '',
  email: '',
  loyaltyCode: '',
}

export const SalesOrderPage = () => {
  const queryClient = useQueryClient()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [searchText, setSearchText] = useState('')
  const [parentCategoryFilter, setParentCategoryFilter] = useState<ParentCategoryOption[]>([])
  const [childCategoryFilter, setChildCategoryFilter] = useState<CategoryOption[]>([])
  const [supplierFilter, setSupplierFilter] = useState<string[]>([])
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])
  const [manualAlerts, setManualAlerts] = useState<AlertMessage[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(defaultCustomerForm)
  const [feedback, setFeedback] = useState<{ type: AlertColor; message: string } | null>(null)
  const [pendingOrder, setPendingOrder] = useState<PendingSalesOrder | null>(null)

  const pushManualAlert = useCallback((text: string, severity: AlertColor = 'warning') => {
    setManualAlerts(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        text,
        severity,
        source: 'manual',
      },
    ])
  }, [])

  const { parentCategoryOptions, childCategoryLookup, childCategoryOptions } = useCategoryFilters()
  const { suppliers } = useSupplierOptions()

  const contextQuery = useQuery({
    queryKey: ['sales-order-context'],
    queryFn: fetchSalesOrderContext,
  })

  const debouncedSearch = useDebouncedValue(searchText, 300)

  const searchFilters = useMemo<SellableLotQuery>(() => {
    const normalizeIds = (values: Array<string | number>): number[] =>
      values
        .map(value => (typeof value === 'number' ? value : Number(value)))
        .filter(value => Number.isFinite(value) && value > 0)

    const parentIds = normalizeIds(parentCategoryFilter.map(option => option.key))
    const childIds = normalizeIds(childCategoryFilter.map(option => option.key))
    const supplierIds = normalizeIds(supplierFilter)
    const trimmedQuery = debouncedSearch.trim()

    return {
      query: trimmedQuery.length > 0 ? trimmedQuery : undefined,
      parentCategoryIds: parentIds,
      categoryIds: childIds,
      supplierIds,
      limit: 30,
    }
  }, [debouncedSearch, parentCategoryFilter, childCategoryFilter, supplierFilter])

  const searchQuery = useQuery({
    queryKey: ['sellable-lots', searchFilters] as const,
    queryFn: ({ queryKey }) => {
      const [, params] = queryKey
      return searchSellableLots(params)
    },
  })
  const refetchSellableLots = searchQuery.refetch

  const lookupCustomerMutation = useMutation({
    mutationFn: lookupCustomerByPhone,
    onSuccess: result => {
      if (!result) {
        setSelectedCustomer(null)
        setLoyaltyPointsToRedeem(0)
        pushManualAlert('No customer found for that phone number.', 'info')
        return
      }
      setSelectedCustomer(result)
      setLoyaltyPointsToRedeem(0)
      setFeedback({ type: 'success', message: `Customer ${result.fullName} loaded.` })
    },
    onError: () => {
      pushManualAlert('Unable to lookup customer. Please try again.', 'error')
    },
  })

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: result => {
      setSelectedCustomer(result)
      setCustomerForm(defaultCustomerForm)
      setCustomerPhone(result.phoneNumber)
      setLoyaltyPointsToRedeem(0)
      setCustomerDialogOpen(false)
      const message = result.isUpdated
        ? 'Existing loyalty customer updated from phone number.'
        : 'Loyalty customer created successfully.'
      pushManualAlert(message, 'success')
      setFeedback({ type: 'success', message })
    },
    onError: error => {
      const message = extractApiErrorMessage(
        error,
        'Unable to create customer. Please check the form and try again.',
      )
      pushManualAlert(message, 'error')
    },
  })

  const createOrderMutation = useMutation({
    mutationFn: (payload: CreateSalesOrderRequest) => createSalesOrder(payload),
    onSuccess: async (result: CreateSalesOrderResponse) => {
      if (result.status === 'PENDING') {
        pushManualAlert('Customer confirmation email sent. Waiting for approval.', 'info')
        setFeedback({
          type: 'info',
          message:
            'Customer confirmation email sent. Order will be finalized after the customer confirms the redemption.',
        })
        if (result.pending) {
          setPendingOrder(result.pending)
        }
        await queryClient.invalidateQueries({ queryKey: ['sales-order-context'] })
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['sales-order-context'] })
      await refetchSellableLots()
      pushManualAlert('Sales order finalized successfully.', 'success')
      setFeedback({ type: 'success', message: 'Sales order finalized successfully.' })
      clearOrderState(false)
      setPendingOrder(null)
    },
    onError: () => {
      pushManualAlert('Failed to finalize the sales order. Please try again.', 'error')
    },
  })

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!pendingOrder) {
      return
    }

    let cancelled = false
    const checkStatus = async () => {
      try {
        const status = await getPendingSalesOrderStatus(pendingOrder.pendingId)
        if (cancelled) {
          return
        }
        const normalizedStatus = status.status?.toUpperCase()
        if (status.isConfirmed) {
          pushManualAlert('Customer confirmed the order.', 'success')
          setFeedback({ type: 'success', message: 'Customer confirmed the order.' })
          await refetchSellableLots()
          await queryClient.invalidateQueries({ queryKey: ['sales-order-context'] })
          clearOrderState(false)
          setPendingOrder(null)
        } else if (normalizedStatus === 'EXPIRED' || normalizedStatus === 'CANCELLED') {
          const message =
            normalizedStatus === 'EXPIRED'
              ? 'Customer confirmation expired. Please finalize again.'
              : 'Customer cancelled this order. Please finalize again.'
          pushManualAlert(message, 'warning')
          setPendingOrder(null)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to check pending order status', error)
        }
      }
    }

    const interval = setInterval(() => {
      void checkStatus()
    }, 5000)
    void checkStatus()

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [pendingOrder, pushManualAlert, queryClient, refetchSellableLots])

  const removeManualAlert = (id: string) => {
    setManualAlerts(prev => prev.filter(alert => alert.id !== id))
  }

  const addLineFromLot = (lot: SellableLot) => {
    setOrderLines(prev => {
      const existing = prev.find(
        line => line.productId === lot.productId && line.lotId === lot.lotId,
      )
      if (existing) {
        const increment = lot.uom.toUpperCase() === 'KG' ? 0.1 : 1
        const nextQty = Math.min(existing.quantity + increment, lot.qtyOnHand)
        if (nextQty === existing.quantity) {
          pushManualAlert(
            `Only ${lot.qtyOnHand} ${lot.uom} of ${lot.productName} available.`,
            'info',
          )
          return prev
        }
        return prev.map(line =>
          line.lineId === existing.lineId
            ? {
                ...line,
                quantity: roundQuantity(nextQty, line.uom),
              }
            : line,
        )
      }

      const defaultQty = lot.uom.toUpperCase() === 'KG' ? 0 : 1
      return [
        ...prev,
        {
          ...lot,
          lineId:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
          quantity: defaultQty,
        },
      ]
    })
  }

  const handleQuantityChange = (
    lineId: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const raw = Number(event.target.value)
    setOrderLines(prev =>
      prev.map(line => {
        if (line.lineId !== lineId) {
          return line
        }
        const maxQty = line.qtyOnHand
        if (!Number.isFinite(raw) || raw < 0) {
          return { ...line, quantity: 0 }
        }
        if (raw > maxQty) {
          pushManualAlert(`Only ${maxQty} ${line.uom} available; quantity adjusted.`, 'warning')
          return { ...line, quantity: maxQty }
        }
        return {
          ...line,
          quantity: roundQuantity(raw, line.uom),
        }
      }),
    )
  }

  const handleRemoveLine = (lineId: string) => {
    setOrderLines(prev => prev.filter(line => line.lineId !== lineId))
  }

  const orderTotals = useMemo(() => {
    const subtotal = orderLines.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0)
    const discountTotal = orderLines.reduce(
      (acc, line) => acc + line.unitPrice * line.quantity * line.discountPercent,
      0,
    )
    const totalAfterDiscount = Math.max(subtotal - discountTotal, 0)
    const loyaltyEligible =
      selectedCustomer && totalAfterDiscount > 0
        ? Math.min(
            Math.floor(selectedCustomer.loyaltyPoints / 1000) * 1000,
            Math.floor(totalAfterDiscount / 1000) * 1000,
          )
        : 0

    const appliedLoyalty = Math.min(loyaltyPointsToRedeem, loyaltyEligible)
    const finalTotal = Math.max(totalAfterDiscount - appliedLoyalty, 0)
    const pointsEarned = Math.floor(finalTotal / 100)

    return {
      subtotal,
      discountTotal,
      totalAfterDiscount,
      loyaltyEligible,
      appliedLoyalty,
      finalTotal,
      pointsEarned,
    }
  }, [orderLines, loyaltyPointsToRedeem, selectedCustomer])

  useEffect(() => {
    if (!selectedCustomer) {
      setLoyaltyPointsToRedeem(0)
      return
    }
    const maxByPoints = Math.floor(selectedCustomer.loyaltyPoints / 1000) * 1000
    const maxByTotal = Math.floor(orderTotals.totalAfterDiscount / 1000) * 1000
    const allowed = Math.max(Math.min(maxByPoints, maxByTotal), 0)
    setLoyaltyPointsToRedeem(prev => Math.min(prev, allowed))
  }, [selectedCustomer, orderTotals.totalAfterDiscount])

  const derivedAlerts = useMemo<AlertMessage[]>(() => {
    const alerts: AlertMessage[] = []
    const now = Date.now()
    orderLines.forEach(line => {
      const remaining = Math.max(line.qtyOnHand - line.quantity, 0)
      if (line.suggestedQty && remaining < line.suggestedQty) {
        alerts.push({
          id: `${line.lineId}-low-stock`,
          text: `${line.productName} will be below suggested stock after this sale (${remaining.toFixed(
            2,
          )} left).`,
          severity: 'warning',
          source: 'derived',
        })
      }

      if (line.expiryDate) {
        const expiry = new Date(line.expiryDate).getTime()
        const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
        if (diffDays >= 0 && diffDays <= 3) {
          alerts.push({
            id: `${line.lineId}-expiry`,
            text: `${line.productName} expires in ${diffDays} day(s).`,
            severity: 'warning',
            source: 'derived',
          })
        }
      }

      if (line.hasPricingGaps) {
        alerts.push({
          id: `${line.lineId}-pricing`,
          text: `Missing cost or margin data for ${line.productName}.`,
          severity: 'info',
          source: 'derived',
        })
      } else {
        const margin =
          line.unitCost > 0
            ? (line.unitPrice - line.unitCost) / line.unitCost
            : Number.POSITIVE_INFINITY
        const minMargin = line.minMarginPct > 1 ? line.minMarginPct / 100 : line.minMarginPct
        if (Number.isFinite(margin) && minMargin > 0 && margin < minMargin) {
          alerts.push({
            id: `${line.lineId}-margin`,
            text: `${line.productName} margin (${(margin * 100).toFixed(
              1,
            )}%) is below minimum target.`,
            severity: 'warning',
            source: 'derived',
          })
        }
      }
    })

    return alerts
  }, [orderLines])

  const combinedAlerts = useMemo(() => {
    const map = new Map<string, AlertMessage>()
    manualAlerts.forEach(alert => map.set(alert.id, alert))
    derivedAlerts.forEach(alert => map.set(alert.id, alert))
    return Array.from(map.values())
  }, [manualAlerts, derivedAlerts])

  const finalizeDisabled = createOrderMutation.isPending || Boolean(pendingOrder)

  const handleLookupCustomer = () => {
    if (!customerPhone.trim()) {
      pushManualAlert('Enter a phone number before searching.', 'info')
      return
    }
    lookupCustomerMutation.mutate(customerPhone.trim())
  }

  const handleCreateCustomer = () => {
    if (!customerForm.fullName || !customerForm.phoneNumber || !customerForm.email) {
      pushManualAlert('All loyalty card fields are required.', 'warning')
      return
    }
    createCustomerMutation.mutate({
      fullName: customerForm.fullName,
      phoneNumber: customerForm.phoneNumber,
      email: customerForm.email,
      loyaltyCode: customerForm.loyaltyCode || undefined,
    })
  }

  const finalizeOrder = () => {
    if (pendingOrder) {
      pushManualAlert('Waiting for customer confirmation before finalizing another order.', 'info')
      return
    }
    if (orderLines.length === 0) {
      pushManualAlert('Add at least one product to the order before finalizing.', 'error')
      return
    }
    if (!contextQuery.data) {
      pushManualAlert('Unable to prepare order context. Reload the page and try again.', 'error')
      return
    }

    const payload: CreateSalesOrderRequest = {
      orderCode: contextQuery.data.orderCode,
      customerId: selectedCustomer ? Number(selectedCustomer.id) : undefined,
      loyaltyPointsToRedeem: orderTotals.appliedLoyalty,
      lines: orderLines.map<CreateSalesOrderLineInput>(line => ({
        productId: line.productId,
        lotId: line.lotId,
        quantity: line.quantity,
      })),
    }

    createOrderMutation.mutate(payload)
  }

  const clearOrderState = (clearAlerts: boolean) => {
    setOrderLines([])
    setSelectedCustomer(null)
    setCustomerPhone('')
    setLoyaltyPointsToRedeem(0)
    if (clearAlerts) {
      setManualAlerts([])
    }
    setFeedback(null)
  }
  const resetOrderState = () => {
    clearOrderState(true)
    setPendingOrder(null)
  }

  const applyMaxLoyalty = () => {
    if (!selectedCustomer || orderTotals.loyaltyEligible <= 0) {
      return
    }
    setLoyaltyPointsToRedeem(orderTotals.loyaltyEligible)
  }

  const clearFilters = () => {
    setSearchText('')
    setParentCategoryFilter([])
    setChildCategoryFilter([])
    setSupplierFilter([])
  }

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

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Sales Order Builder"
        subtitle="Search products, build the basket, and finalize the checkout."
        action={<PointOfSale color="primary" fontSize="large" />}
      />

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color="text.secondary">
              Cashier
            </Typography>
            <Typography variant="h6">
              {contextQuery.data?.cashierName || '—'}{' '}
              <Typography component="span" variant="body2" color="text.secondary">
                #{contextQuery.data?.cashierId ?? '-'}
              </Typography>
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color="text.secondary">
              Order Code
            </Typography>
            <Typography variant="h6">{contextQuery.data?.orderCode ?? 'Loading…'}</Typography>
            <Typography variant="caption" color="text.secondary">
              Generated at:{' '}
              {contextQuery.data
                ? new Date(contextQuery.data.generatedAt).toLocaleString()
                : 'Loading…'}
            </Typography>
          </Stack>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Customer loyalty
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Phone number"
                value={customerPhone}
                onChange={event => setCustomerPhone(event.target.value)}
              />
              <Button
                variant="outlined"
                startIcon={<Search />}
                onClick={handleLookupCustomer}
                disabled={lookupCustomerMutation.isPending}
              >
                Find
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<PersonAddAlt1 />}
                onClick={() => setCustomerDialogOpen(true)}
              >
                Assign loyalty card
              </Button>
            </Stack>
            {selectedCustomer && (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                <Typography>
                  {selectedCustomer.fullName} •{' '}
                  <strong>{selectedCustomer.loyaltyPoints.toLocaleString()} pts</strong>
                </Typography>
                <Button size="small" onClick={() => setSelectedCustomer(null)}>
                  Clear customer
                </Button>
              </Stack>
            )}
          </Stack>
        </Stack>
      </Paper>

      {feedback && (
        <Alert severity={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {combinedAlerts.length > 0 && (
        <Stack spacing={1}>
          {combinedAlerts.map(alert => (
            <Alert
              key={alert.id}
              severity={alert.severity}
              action={
                alert.source === 'manual' ? (
                  <IconButton
                    size="small"
                    aria-label="close alert"
                    onClick={() => removeManualAlert(alert.id)}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                ) : undefined
              }
            >
              {alert.text}
            </Alert>
          ))}
        </Stack>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Stack spacing={2}>
              <TextField
                inputRef={searchInputRef}
                label="Search products or SKU"
                placeholder="Type product name or SKU"
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Autocomplete<ParentCategoryOption, true, false, false>
                multiple
                options={parentCategoryOptions}
                value={parentCategoryFilter}
                onChange={(_event, value) => setParentCategoryFilter(value)}
                getOptionLabel={(option: ParentCategoryOption) => option.label}
                isOptionEqualToValue={(a: ParentCategoryOption, b: ParentCategoryOption) =>
                  a.key === b.key
                }
                renderInput={(params: AutocompleteRenderInputParams) => (
                  <TextField {...params} label="Parent categories" />
                )}
              />
              <Autocomplete<CategoryOption, true, false, false>
                multiple
                options={derivedChildCategoryOptions}
                value={childCategoryFilter}
                onChange={(_event, value) => setChildCategoryFilter(value)}
                getOptionLabel={(option: CategoryOption) => option.label}
                isOptionEqualToValue={(a: CategoryOption, b: CategoryOption) => a.key === b.key}
                renderInput={(params: AutocompleteRenderInputParams) => (
                  <TextField {...params} label="Child categories" />
                )}
              />
              <Autocomplete<Supplier, true, false, false>
                multiple
                options={suppliers}
                value={suppliers.filter(option => supplierFilter.includes(option.id))}
                onChange={(_event, value) => setSupplierFilter(value.map(option => option.id))}
                getOptionLabel={(option: Supplier) => option.name}
                isOptionEqualToValue={(a: Supplier, b: Supplier) => a.id === b.id}
                renderInput={(params: AutocompleteRenderInputParams) => (
                  <TextField {...params} label="Suppliers" />
                )}
              />
              <Button variant="text" onClick={clearFilters}>
                Clear filters
              </Button>
              <Typography variant="subtitle2">Matching lots</Typography>
              <Stack spacing={1} sx={{ maxHeight: 420, overflow: 'auto', pr: 1 }}>
                {searchQuery.isLoading && <Typography>Loading products…</Typography>}
                {!searchQuery.isLoading && searchQuery.data?.length === 0 && (
                  <Typography color="text.secondary">No products found.</Typography>
                )}
                {searchQuery.data?.map(lot => (
                  <Paper key={`${lot.lotId}-${lot.lotCode}`} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600}>{lot.productName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        SKU: {lot.skuCode} • Lot: {lot.lotCode}
                      </Typography>
                      <Typography variant="body2">
                        Available: <strong>{lot.qtyOnHand}</strong> {lot.uom}
                      </Typography>
                      {lot.expiryDate && (
                        <Typography variant="body2">
                          Expiry: {new Date(lot.expiryDate).toLocaleDateString()}
                        </Typography>
                      )}
                      <Typography variant="body2">Supplier: {lot.supplierName ?? 'N/A'}</Typography>
                      <Typography variant="body2">
                        Price:{' '}
                        <strong>
                          {formatCurrency(lot.unitPrice)}{' '}
                          {lot.discountPercent > 0 && (
                            <Typography component="span" color="success.main">
                              (disc {(lot.discountPercent * 100).toFixed(0)}%)
                            </Typography>
                          )}
                        </strong>
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => addLineFromLot(lot)}
                      >
                        Add to order
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Qty / Weight</TableCell>
                    <TableCell>Unit Price</TableCell>
                    <TableCell>Discount</TableCell>
                    <TableCell>Line Total</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderLines.map((line, index) => {
                    const lineSubtotal = line.unitPrice * line.quantity
                    const lineDiscount = lineSubtotal * line.discountPercent
                    const lineTotal = lineSubtotal - lineDiscount
                    const remaining = Math.max(line.qtyOnHand - line.quantity, 0)
                    return (
                      <TableRow key={line.lineId}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography fontWeight={600}>{line.productName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            SKU: {line.skuCode} • Lot: {line.lotCode}
                          </Typography>
                        </TableCell>
                        <TableCell>{line.uom}</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={line.quantity}
                            onChange={event => handleQuantityChange(line.lineId, event)}
                            inputProps={{
                              min: 0,
                              max: line.qtyOnHand,
                              step: line.uom.toUpperCase() === 'KG' ? 0.1 : 1,
                              style: { textAlign: 'right' },
                            }}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(line.unitPrice)}</TableCell>
                        <TableCell>
                          {line.discountPercent > 0
                            ? `${(line.discountPercent * 100).toFixed(0)}%`
                            : '—'}
                        </TableCell>
                        <TableCell>{formatCurrency(lineTotal)}</TableCell>
                        <TableCell>
                          {line.qtyOnHand.toFixed(line.uom.toUpperCase() === 'KG' ? 2 : 0)} →{' '}
                          <strong>
                            {remaining.toFixed(line.uom.toUpperCase() === 'KG' ? 2 : 0)}
                          </strong>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Remove line">
                            <IconButton onClick={() => handleRemoveLine(line.lineId)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {orderLines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Typography color="text.secondary" align="center">
                          No products in the basket. Use the search panel to add items.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={3}>
              <Paper sx={{ p: 2, flexGrow: 1 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Summary</Typography>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Items</Typography>
                    <Typography>{orderLines.length}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Subtotal</Typography>
                    <Typography>{formatCurrency(orderTotals.subtotal)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Discounts</Typography>
                    <Typography>-{formatCurrency(orderTotals.discountTotal)}</Typography>
                  </Stack>
                  {orderTotals.appliedLoyalty > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary">Loyalty redemption</Typography>
                      <Typography>-{formatCurrency(orderTotals.appliedLoyalty)}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight={700}>Total</Typography>
                    <Typography fontWeight={700}>
                      {formatCurrency(orderTotals.finalTotal)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Points earned: <strong>{orderTotals.pointsEarned}</strong>
                  </Typography>
                  {pendingOrder && (
                    <Alert severity="info">
                      Waiting for customer confirmation sent to{' '}
                      {pendingOrder.customerEmail ?? 'the customer'}.
                    </Alert>
                  )}
                </Stack>
              </Paper>
              <Paper sx={{ p: 2, minWidth: 280 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2" display="flex" alignItems="center" gap={1}>
                    <Loyalty fontSize="small" /> Use loyalty points
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Every 1,000 points converts into 1,000 VND. Available:{' '}
                    <strong>
                      {selectedCustomer ? selectedCustomer.loyaltyPoints.toLocaleString() : 0} pts
                    </strong>
                  </Typography>
                  <TextField
                    label="Points to redeem"
                    type="number"
                    size="small"
                    value={loyaltyPointsToRedeem}
                    onChange={event => {
                      const raw = Math.max(Number(event.target.value) || 0, 0)
                      const normalized = Math.floor(raw / 1000) * 1000
                      setLoyaltyPointsToRedeem(normalized)
                    }}
                    disabled={!selectedCustomer}
                    helperText={`Max allowed now: ${orderTotals.loyaltyEligible.toLocaleString()} pts`}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={applyMaxLoyalty}
                    disabled={!selectedCustomer || orderTotals.loyaltyEligible === 0}
                  >
                    Use max ({orderTotals.loyaltyEligible.toLocaleString()} pts)
                  </Button>
                </Stack>
              </Paper>
            </Stack>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              justifyContent="flex-end"
              mt={3}
            >
              <Button
                variant="outlined"
                onClick={resetOrderState}
                startIcon={<Refresh />}
                disabled={Boolean(pendingOrder)}
              >
                New Order
              </Button>
              <Button
                variant="text"
                color="inherit"
                onClick={resetOrderState}
                disabled={Boolean(pendingOrder)}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PointOfSale />}
                onClick={finalizeOrder}
                disabled={finalizeDisabled}
              >
                Finalize &amp; Print
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assign loyalty card</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Full name"
              value={customerForm.fullName}
              onChange={event =>
                setCustomerForm(form => ({ ...form, fullName: event.target.value }))
              }
            />
            <TextField
              label="Phone number"
              value={customerForm.phoneNumber}
              onChange={event =>
                setCustomerForm(form => ({ ...form, phoneNumber: event.target.value }))
              }
            />
            <TextField
              label="Email"
              type="email"
              value={customerForm.email}
              onChange={event => setCustomerForm(form => ({ ...form, email: event.target.value }))}
            />
            <TextField
              label="Loyalty code (optional)"
              value={customerForm.loyaltyCode}
              onChange={event =>
                setCustomerForm(form => ({ ...form, loyaltyCode: event.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={handleCreateCustomer}
            disabled={createCustomerMutation.isPending}
          >
            Save customer
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default SalesOrderPage
