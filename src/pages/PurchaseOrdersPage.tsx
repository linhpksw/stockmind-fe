import AddCircleOutline from '@mui/icons-material/AddCircleOutline'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
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
import { alpha } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import {
  createPurchaseOrder,
  fetchAllPurchaseOrderSummaries,
  syncPurchaseOrders,
} from '../api/purchaseOrders'
import { listProducts } from '../api/products'
import { listMarginProfiles } from '../api/margins'
import { SectionHeading } from '../components/common/SectionHeading'
import { useCategoryFilters, type ParentCategoryOption } from '../hooks/useCategoryFilters'
import { useProductCategoryMap } from '../hooks/useProductCategoryMap'
import { useSupplierOptions } from '../hooks/useSupplierOptions'
import type { CategoryOption } from '../utils/categories'
import { consumeReplenishmentPrefill } from '../utils/replenishmentPrefill'
import type {
  CreatePurchaseOrderItemRequest,
  CreatePurchaseOrderRequest,
  PurchaseOrderSummary,
} from '../types/purchaseOrders'
import type { Product } from '../types/products'
import type { Supplier } from '../types/suppliers'
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

type PurchaseOrderItemForm = {
  productId: string
  qty: string
  unitCost: string
  expectedDate: string
}

type SupplierOrderForm = {
  id: string
  supplierId: string
  items: PurchaseOrderItemForm[]
}

type PurchaseOrderFormState = {
  orders: SupplierOrderForm[]
}

const createEmptyOrderItem = (): PurchaseOrderItemForm => ({
  productId: '',
  qty: '',
  unitCost: '',
  expectedDate: '',
})

const createSupplierOrder = (): SupplierOrderForm => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  supplierId: '',
  items: [createEmptyOrderItem()],
})

const createInitialOrderState = (): PurchaseOrderFormState => ({
  orders: [createSupplierOrder()],
})

type ReplenishmentPrefill = {
  productId: string
  suggestedQty: number
}

const PO_CREATE_DRAFT_STORAGE_KEY = 'po-create-draft'

const sanitizeDraft = (draft: unknown): PurchaseOrderFormState | null => {
  if (
    !draft ||
    typeof draft !== 'object' ||
    !Array.isArray((draft as PurchaseOrderFormState).orders)
  ) {
    return null
  }

  const orders: SupplierOrderForm[] = (draft as PurchaseOrderFormState).orders
    .map(order => {
      if (!order || typeof order !== 'object') {
        return null
      }
      const orderObj = order as SupplierOrderForm
      const items =
        Array.isArray(orderObj.items) && orderObj.items.length > 0
          ? orderObj.items.map(item => ({
              productId: item?.productId ?? '',
              qty: item?.qty ?? '',
              unitCost: item?.unitCost ?? '',
              expectedDate: item?.expectedDate ?? '',
            }))
          : [createEmptyOrderItem()]
      return {
        id: orderObj.id || createSupplierOrder().id,
        supplierId: orderObj.supplierId ?? '',
        items,
      }
    })
    .filter(Boolean) as SupplierOrderForm[]

  if (orders.length === 0) {
    return null
  }

  return { orders }
}

const loadDraftFromStorage = (): PurchaseOrderFormState | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(PO_CREATE_DRAFT_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    return sanitizeDraft(parsed)
  } catch {
    return null
  }
}

const persistDraftToStorage = (state: PurchaseOrderFormState) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(PO_CREATE_DRAFT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage write errors
  }
}

const clearDraftFromStorage = () => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(PO_CREATE_DRAFT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

const parsePositiveNumber = (value: string): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const computeItemTotal = (item: PurchaseOrderItemForm): number => {
  const qty = parsePositiveNumber(item.qty)
  const unitCost = parsePositiveNumber(item.unitCost)
  return qty * unitCost
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
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<PurchaseOrderFormState>(
    () => loadDraftFromStorage() ?? createInitialOrderState(),
  )
  const [createFormError, setCreateFormError] = useState<string | null>(null)
  const [pendingReplenishmentPrefill, setPendingReplenishmentPrefill] =
    useState<ReplenishmentPrefill | null>(null)
  const [missingSupplierWarning, setMissingSupplierWarning] = useState<string | null>(null)
  const [, startCreateFormTransition] = useTransition()
  const queryClient = useQueryClient()
  const replenishmentPrefillConsumedRef = useRef(false)

  const resetCreateForm = () => {
    setCreateForm(createInitialOrderState())
    setCreateFormError(null)
    clearDraftFromStorage()
  }

  const discardDraft = () => {
    resetCreateForm()
  }

  useEffect(() => {
    persistDraftToStorage(createForm)
  }, [createForm])
  const scheduleFormUpdate = useCallback(
    (updater: (prev: PurchaseOrderFormState) => PurchaseOrderFormState) => {
      startCreateFormTransition(() => {
        setCreateForm(prev => updater(prev))
      })
    },
    [startCreateFormTransition],
  )

  const summaryQuery = useQuery({
    queryKey: ['purchase-orders-summary', 'all'],
    queryFn: fetchAllPurchaseOrderSummaries,
  })
  const getSupplierTotal = useCallback((order: SupplierOrderForm) => {
    return order.items.reduce((sum, item) => sum + computeItemTotal(item), 0)
  }, [])
  const formGrandTotal = useMemo(
    () => createForm.orders.reduce((sum, order) => sum + getSupplierTotal(order), 0),
    [createForm.orders, getSupplierTotal],
  )
  const {
    parentCategoryOptions,
    childCategoryLookup,
    childCategoryOptions,
    categoryMeta,
    isLoading: isCategoryLoading,
  } = useCategoryFilters()
  const { productCategoryMap } = useProductCategoryMap(categoryMeta)
  const { supplierOptions, suppliers, isLoading: isSupplierLoading } = useSupplierOptions()
  const supplierLookup = useMemo(() => {
    const map = new Map<string, Supplier>()
    suppliers.forEach(supplier => map.set(supplier.id, supplier))
    return map
  }, [suppliers])
  const productsQuery = useQuery({
    queryKey: ['products-directory'],
    queryFn: listProducts,
    enabled: createDialogOpen,
  })
  const marginProfilesQuery = useQuery({
    queryKey: ['margin-profiles'],
    queryFn: listMarginProfiles,
    staleTime: 5 * 60 * 1000,
  })
  const marginLookup = useMemo(() => {
    const lookup = new Map<string, number>()
    marginProfilesQuery.data?.forEach(profile => {
      lookup.set(String(profile.parentCategoryId), profile.targetMarginPct)
    })
    return lookup
  }, [marginProfilesQuery.data])
  const resolveParentKey = useCallback(
    (categoryId?: string | null) => {
      const normalized = categoryId?.trim()
      if (!normalized) {
        return undefined
      }
      const metaEntry = categoryMeta.get(normalized)
      if (!metaEntry) {
        return undefined
      }
      return metaEntry.parentKey
    },
    [categoryMeta],
  )
  const computeSuggestedUnitCost = useCallback(
    (product?: Product | null) => {
      if (!product) {
        return ''
      }
      const basePrice = Number(product.price ?? 0)
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        return ''
      }
      const parentKey = resolveParentKey(product.categoryId)
      const targetMarginPct = parentKey ? (marginLookup.get(parentKey) ?? 0) : 0
      const cost = basePrice - basePrice * (targetMarginPct / 100)
      if (!Number.isFinite(cost) || cost <= 0) {
        return basePrice.toFixed(2)
      }
      return cost.toFixed(2)
    },
    [marginLookup, resolveParentKey],
  )

  const getDefaultExpectedDate = useCallback((leadTimeDays?: number) => {
    const offset = Number.isFinite(leadTimeDays) ? (leadTimeDays ?? 0) : 0
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + offset)
    return date.toISOString().slice(0, 10)
  }, [])

  const syncMutation = useMutation({
    mutationFn: () => syncPurchaseOrders(page + 1, rowsPerPage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-summary', 'all'] })
      setExpanded({})
      setSyncDisabled(true)
    },
  })
  const products = useMemo<Product[]>(() => productsQuery.data ?? [], [productsQuery.data])
  const productLookup = useMemo(() => {
    const lookup = new Map<string, Product>()
    products.forEach(product => lookup.set(product.id, product))
    return lookup
  }, [products])
  const sortedProducts = useMemo(
    () => products.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  )
  const productsBySupplier = useMemo(() => {
    const map = new Map<string, Product[]>()
    products.forEach(product => {
      if (!product.supplierId) {
        return
      }
      const list = map.get(product.supplierId) ?? []
      list.push(product)
      map.set(product.supplierId, list)
    })
    map.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)))
    return map
  }, [products])
  useEffect(() => {
    if (!pendingReplenishmentPrefill || !createDialogOpen) {
      return
    }
    if (products.length === 0) {
      return
    }

    const product = products.find(item => String(item.id) === pendingReplenishmentPrefill.productId)
    if (!product) {
      return
    }

    if (!product.supplierId) {
      setMissingSupplierWarning(
        `${product.name ?? 'This product'} does not have a supplier assigned yet. Please set a supplier before creating a purchase order.`,
      )
      setPendingReplenishmentPrefill(null)
      return
    }

    const supplierId = product.supplierId
    const supplierLeadTime = supplierId ? supplierLookup.get(supplierId)?.leadTimeDays : undefined
    const expectedDate = getDefaultExpectedDate(supplierLeadTime)
    const normalizedQty =
      pendingReplenishmentPrefill.suggestedQty > 0
        ? Math.max(1, Math.ceil(pendingReplenishmentPrefill.suggestedQty))
        : 0

    scheduleFormUpdate(prev => {
      const orders =
        prev.orders.length > 0
          ? prev.orders.map(order => ({
              ...order,
              items: order.items.map(item => ({ ...item })),
            }))
          : []

      let targetIndex =
        supplierId && supplierId.length > 0
          ? orders.findIndex(order => order.supplierId === supplierId)
          : -1

      if (targetIndex === -1) {
        const newOrder = createSupplierOrder()
        newOrder.supplierId = supplierId
        newOrder.items = [{ ...createEmptyOrderItem(), expectedDate }]
        orders.unshift(newOrder)
        targetIndex = 0
      }

      const targetOrder = orders[targetIndex]
      const items =
        targetOrder.items.length > 0
          ? targetOrder.items.slice()
          : [{ ...createEmptyOrderItem(), expectedDate }]
      const existingProductIndex = items.findIndex(
        item => item.productId && String(item.productId) === String(product.id),
      )
      const emptySlotIndex = items.findIndex(
        item => !item.productId || String(item.productId).trim().length === 0,
      )
      let targetItemIndex = existingProductIndex
      if (targetItemIndex === -1) {
        targetItemIndex = emptySlotIndex
      }
      if (targetItemIndex === -1) {
        items.push({ ...createEmptyOrderItem(), expectedDate })
        targetItemIndex = items.length - 1
      }
      const qtyValue = normalizedQty > 0 ? String(normalizedQty) : ''
      items[targetItemIndex] = {
        ...items[targetItemIndex],
        productId: String(product.id),
        qty: qtyValue,
        unitCost: computeSuggestedUnitCost(product),
        expectedDate,
      }

      orders[targetIndex] = {
        ...targetOrder,
        supplierId,
        items,
      }

      return { orders }
    })

    setPendingReplenishmentPrefill(null)
    setCreateFormError(null)
  }, [
    pendingReplenishmentPrefill,
    createDialogOpen,
    products,
    supplierLookup,
    scheduleFormUpdate,
    computeSuggestedUnitCost,
    getDefaultExpectedDate,
  ])
  const getProductsForSupplier = useCallback(
    (supplierId: string) => {
      if (!supplierId) {
        return sortedProducts
      }
      const list = productsBySupplier.get(supplierId)
      return list && list.length > 0 ? list : sortedProducts
    },
    [productsBySupplier, sortedProducts],
  )
  const createPoMutation = useMutation({
    mutationFn: async (payloads: CreatePurchaseOrderRequest[]) => {
      for (const payload of payloads) {
        await createPurchaseOrder(payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-summary', 'all'] })
      resetCreateForm()
      setCreateDialogOpen(false)
    },
  })
  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true)
    createPoMutation.reset()
    setCreateFormError(null)
  }, [createPoMutation])

  const closeCreateDialog = () => {
    if (createPoMutation.isPending) {
      return
    }
    setCreateDialogOpen(false)
    setCreateFormError(null)
    createPoMutation.reset()
  }

  useEffect(() => {
    if (replenishmentPrefillConsumedRef.current) {
      return
    }
    const stored = consumeReplenishmentPrefill()
    replenishmentPrefillConsumedRef.current = true
    if (!stored) {
      return
    }
    setPendingReplenishmentPrefill({
      productId: String(stored.productId),
      suggestedQty: stored.suggestedQty,
    })
    if (!createDialogOpen) {
      openCreateDialog()
    }
  }, [createDialogOpen, openCreateDialog])

  const handleSupplierChange = (
    orderIndex: number,
    _event: SyntheticEvent<Element, Event>,
    value: Supplier | null,
  ) => {
    scheduleFormUpdate(prev => {
      const orders = prev.orders.slice()
      const leadTimeDays = value?.leadTimeDays ?? 0
      const expectedDate = getDefaultExpectedDate(leadTimeDays)
      orders[orderIndex] = {
        ...orders[orderIndex],
        supplierId: value?.id ?? '',
        items: [{ ...createEmptyOrderItem(), expectedDate }],
      }
      return { orders }
    })
    setCreateFormError(null)
  }

  const handleItemFieldChange = (
    orderIndex: number,
    itemIndex: number,
    field: keyof PurchaseOrderItemForm,
    value: string,
  ) => {
    scheduleFormUpdate(prev => {
      const orders = prev.orders.slice()
      const items = orders[orderIndex].items.slice()
      items[itemIndex] = { ...items[itemIndex], [field]: value }
      orders[orderIndex] = { ...orders[orderIndex], items }
      return { orders }
    })
    setCreateFormError(null)
  }

  const handleProductChange = (orderIndex: number, itemIndex: number, productId: string) => {
    scheduleFormUpdate(prev => {
      const orders = prev.orders.slice()
      const items = orders[orderIndex].items.slice()
      const current = items[itemIndex]
      const product = productLookup.get(productId)
      items[itemIndex] = {
        ...current,
        productId,
        unitCost: computeSuggestedUnitCost(product),
      }
      orders[orderIndex] = { ...orders[orderIndex], items }
      return { orders }
    })
    setCreateFormError(null)
  }

  const addItemRow = (orderIndex: number) => {
    scheduleFormUpdate(prev => {
      const orders = prev.orders.slice()
      const templateDate = orders[orderIndex].items[0]?.expectedDate ?? getDefaultExpectedDate()
      const items = [
        ...orders[orderIndex].items,
        { ...createEmptyOrderItem(), expectedDate: templateDate },
      ]
      orders[orderIndex] = { ...orders[orderIndex], items }
      return { orders }
    })
    setCreateFormError(null)
  }

  const removeItemRow = (orderIndex: number, itemIndex: number) => {
    scheduleFormUpdate(prev => {
      const orders = prev.orders.slice()
      const currentItems = orders[orderIndex].items
      if (currentItems.length === 1) {
        return prev
      }
      const items = currentItems.filter((_, idx) => idx !== itemIndex)
      orders[orderIndex] = { ...orders[orderIndex], items }
      return { orders }
    })
    setCreateFormError(null)
  }

  const addSupplierOrder = () => {
    scheduleFormUpdate(prev => ({
      orders: [...prev.orders, createSupplierOrder()],
    }))
    setCreateFormError(null)
  }

  const removeSupplierOrder = (orderIndex: number) => {
    scheduleFormUpdate(prev => {
      if (prev.orders.length === 1) {
        return prev
      }
      const orders = prev.orders.filter((_, idx) => idx !== orderIndex)
      return { orders }
    })
    setCreateFormError(null)
  }

  const handleSupplierExpectedDateChange = (orderIndex: number, value: string) => {
    scheduleFormUpdate(prev => {
      const orders = prev.orders.slice()
      const items = orders[orderIndex].items.map(item => ({ ...item, expectedDate: value }))
      orders[orderIndex] = { ...orders[orderIndex], items }
      return { orders }
    })
  }

  const handleCreatePo = () => {
    if (createPoMutation.isPending) {
      return
    }
    if (createForm.orders.length === 0) {
      setCreateFormError('Add at least one supplier before creating purchase orders.')
      return
    }
    const payloads: CreatePurchaseOrderRequest[] = []
    for (let orderIndex = 0; orderIndex < createForm.orders.length; orderIndex += 1) {
      const order = createForm.orders[orderIndex]
      if (!order.supplierId) {
        setCreateFormError(`Select a supplier for block #${orderIndex + 1}.`)
        return
      }
      if (order.items.length === 0) {
        setCreateFormError(`Add at least one item for supplier #${orderIndex + 1}.`)
        return
      }
      const normalizedItems: CreatePurchaseOrderItemRequest[] = []
      for (const item of order.items) {
        const qty = Number(item.qty)
        const unitCost = Number(item.unitCost)
        if (
          !item.productId ||
          !item.expectedDate ||
          !Number.isInteger(qty) ||
          qty <= 0 ||
          Number.isNaN(unitCost) ||
          unitCost <= 0
        ) {
          setCreateFormError('Please complete every item with valid quantities, costs, and date.')
          return
        }
        normalizedItems.push({
          productId: item.productId,
          qty,
          unitCost,
          expectedDate: item.expectedDate,
        })
      }
      payloads.push({
        supplierId: order.supplierId,
        items: normalizedItems,
      })
    }

    if (payloads.length === 0) {
      setCreateFormError('Add at least one supplier with valid items.')
      return
    }

    setCreateFormError(null)
    createPoMutation.mutate(payloads)
  }

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
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(order.status)
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
      return matchesSupplier && matchesStatus && matchesSearch && matchesParent && matchesChild
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
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<AddCircleOutline />}
                onClick={openCreateDialog}
                disabled={createPoMutation.isPending}
              >
                Create purchase order
              </Button>
              <Button
                variant="contained"
                onClick={() => syncMutation.mutate()}
                disabled={syncDisabled || syncMutation.isPending}
              >
                {syncMutation.isPending ? 'Syncing…' : 'Sync master data'}
              </Button>
            </Stack>
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
          <BaseAutocomplete
            multiple
            options={Array.from(new Set(summaries.map(order => order.status)))}
            value={statusFilter}
            onChange={(_event: SyntheticEvent<Element, Event>, value: string[]) =>
              setStatusFilter(value)
            }
            renderInput={(params: AutocompleteRenderInputParams) => (
              <TextField {...params} label="Status" size="small" />
            )}
            sx={{
              minWidth: { xs: '100%', md: 180 },
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
                        {(() => {
                          const isOpen = order.status === 'OPEN'
                          const isReceived = order.status === 'RECEIVED'
                          const statusLabel = isReceived
                            ? 'Received'
                            : isOpen
                              ? 'Awaiting receipt'
                              : order.status
                          const statusColor = isOpen
                            ? 'warning'
                            : isReceived
                              ? 'success'
                              : 'default'
                          return <Chip size="small" label={statusLabel} color={statusColor} />
                        })()}
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

      <Dialog
        open={createDialogOpen}
        onClose={closeCreateDialog}
        disableEscapeKeyDown={createPoMutation.isPending}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle
          component="div"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pr: 3,
            gap: 2,
          }}
        >
          <Typography component="h2" variant="h6">
            Create purchase order
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label="Draft autosaved" color="info" size="small" variant="outlined" />
            <Button
              size="small"
              color="inherit"
              onClick={discardDraft}
              disabled={createPoMutation.isPending}
            >
              Discard draft
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Stack spacing={3}>
              {createForm.orders.map((order, orderIndex) => {
                const supplierRecord =
                  suppliers.find(supplier => supplier.id === order.supplierId) ?? null
                const productOptions = getProductsForSupplier(order.supplierId)
                const supplierTotal = getSupplierTotal(order)
                const supplierExpectedDate = order.items[0]?.expectedDate ?? ''
                const leadTimeBadge =
                  supplierRecord && supplierRecord.leadTimeDays
                    ? `${supplierRecord.leadTimeDays} day${supplierRecord.leadTimeDays === 1 ? '' : 's'} lead time`
                    : null
                return (
                  <Box
                    key={order.id}
                    sx={{
                      border: '1px dashed',
                      borderColor: order.supplierId ? 'primary.main' : 'divider',
                      backgroundColor: theme =>
                        alpha(theme.palette.primary.main, order.supplierId ? 0.07 : 0.03),
                      borderRadius: 2,
                      p: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      spacing={1.5}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          label={`Supplier #${orderIndex + 1}`}
                          color={order.supplierId ? 'primary' : 'default'}
                          variant="outlined"
                          size="small"
                        />
                        {supplierRecord && (
                          <Chip
                            label={supplierRecord.name}
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {leadTimeBadge && (
                          <Chip
                            label={leadTimeBadge}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: 'warning.light',
                              color: 'warning.dark',
                              backgroundColor: theme => alpha(theme.palette.warning.light, 0.1),
                            }}
                          />
                        )}
                        {supplierRecord?.contact && (
                          <Chip
                            label={supplierRecord.contact}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: 'info.light',
                              color: 'info.dark',
                              backgroundColor: theme => alpha(theme.palette.info.light, 0.1),
                            }}
                          />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                          Total
                        </Typography>
                        <Chip
                          label={currencyFormatter.format(supplierTotal)}
                          color="secondary"
                          variant="filled"
                          size="small"
                        />
                        {createForm.orders.length > 1 && (
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => removeSupplierOrder(orderIndex)}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>

                    <Box
                      sx={{
                        display: 'grid',
                        gap: 2,
                        gridTemplateColumns: { xs: '1fr', md: '2fr 220px' },
                        alignItems: 'center',
                      }}
                    >
                      <BaseAutocomplete
                        options={suppliers}
                        value={supplierRecord}
                        onChange={(
                          event: SyntheticEvent<Element, Event>,
                          supplier: Supplier | null,
                        ) => handleSupplierChange(orderIndex, event, supplier)}
                        getOptionLabel={(option: Supplier) => option.name}
                        isOptionEqualToValue={(option: Supplier, value: Supplier) =>
                          option.id === value.id
                        }
                        renderInput={(params: AutocompleteRenderInputParams) => (
                          <TextField
                            {...params}
                            label="Supplier"
                            placeholder="Select supplier"
                            size="small"
                          />
                        )}
                        loading={isSupplierLoading}
                      />
                      <TextField
                        label="Expected date"
                        type="date"
                        size="small"
                        value={supplierExpectedDate}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleSupplierExpectedDateChange(orderIndex, event.target.value)
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </Box>

                    <Stack spacing={2}>
                      {order.items.map((item, itemIndex) => {
                        const itemTotal = computeItemTotal(item)
                        return (
                          <Box
                            key={`${order.id}-item-${itemIndex}`}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2,
                              p: 2,
                              backgroundColor: 'background.paper',
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              mb={2}
                              spacing={1}
                            >
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                  label={`Item ${itemIndex + 1}`}
                                  color="secondary"
                                  size="small"
                                  variant="outlined"
                                />
                                {item.productId && (
                                  <Chip
                                    label={productLookup.get(item.productId)?.skuCode ?? 'SKU'}
                                    size="small"
                                  />
                                )}
                              </Stack>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" color="text.secondary">
                                  Line total
                                </Typography>
                                <Chip
                                  label={currencyFormatter.format(itemTotal)}
                                  color="info"
                                  variant="outlined"
                                  size="small"
                                />
                                {order.items.length > 1 && (
                                  <IconButton
                                    size="small"
                                    onClick={() => removeItemRow(orderIndex, itemIndex)}
                                  >
                                    <DeleteOutline fontSize="small" />
                                  </IconButton>
                                )}
                              </Stack>
                            </Stack>

                            <Box
                              sx={{
                                display: 'grid',
                                gap: 2,
                                gridTemplateColumns: {
                                  xs: '1fr',
                                  md: '2fr repeat(2, minmax(130px, 1fr))',
                                },
                              }}
                            >
                              <BaseAutocomplete
                                options={productOptions}
                                value={productLookup.get(item.productId) ?? null}
                                onChange={(
                                  _event: SyntheticEvent<Element, Event>,
                                  product: Product | null,
                                ) => handleProductChange(orderIndex, itemIndex, product?.id ?? '')}
                                getOptionLabel={(option: Product) =>
                                  `${option.name} · ${option.skuCode}`.trim()
                                }
                                isOptionEqualToValue={(option: Product, value: Product) =>
                                  option.id === value.id
                                }
                                renderInput={(params: AutocompleteRenderInputParams) => (
                                  <TextField
                                    {...params}
                                    label="Product"
                                    size="small"
                                    placeholder={
                                      order.supplierId ? 'Select product' : 'Select supplier'
                                    }
                                  />
                                )}
                                loading={productsQuery.isFetching}
                                disabled={!order.supplierId || productsQuery.isLoading}
                              />
                              <TextField
                                label="Unit cost"
                                type="number"
                                size="small"
                                value={item.unitCost}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleItemFieldChange(
                                    orderIndex,
                                    itemIndex,
                                    'unitCost',
                                    event.target.value,
                                  )
                                }
                                inputProps={{ min: 0, step: '0.01' }}
                              />
                              <TextField
                                label="Quantity"
                                type="number"
                                size="small"
                                value={item.qty}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  handleItemFieldChange(
                                    orderIndex,
                                    itemIndex,
                                    'qty',
                                    event.target.value,
                                  )
                                }
                                inputProps={{ min: 1 }}
                              />
                            </Box>
                          </Box>
                        )
                      })}
                      <Button
                        variant="outlined"
                        startIcon={<AddCircleOutline />}
                        onClick={() => addItemRow(orderIndex)}
                        sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}
                      >
                        Add item for supplier #{orderIndex + 1}
                      </Button>
                    </Stack>
                  </Box>
                )
              })}
              <Box
                sx={{
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 3,
                  display: 'flex',
                  justifyContent: 'center',
                  backgroundColor: theme => alpha(theme.palette.info.main, 0.05),
                }}
              >
                <Button
                  variant="outlined"
                  startIcon={<AddCircleOutline />}
                  onClick={addSupplierOrder}
                >
                  Add supplier
                </Button>
              </Box>
            </Stack>

            {createFormError && <Alert severity="warning">{createFormError}</Alert>}
            {createPoMutation.isError && (
              <Alert severity="error">
                {createPoMutation.error instanceof Error
                  ? createPoMutation.error.message
                  : 'Unable to create purchase order. Please try again.'}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            pl: { xs: 0, md: 2 },
            pr: { xs: 0, md: 2 },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" color="text.secondary">
              Total purchase order value
            </Typography>
            <Chip
              label={currencyFormatter.format(formGrandTotal)}
              color="primary"
              size="medium"
              sx={{ fontSize: '1rem', fontWeight: 600, px: 2, py: 0.5 }}
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button onClick={closeCreateDialog} disabled={createPoMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreatePo}
              disabled={createPoMutation.isPending}
            >
              {createPoMutation.isPending ? 'Creating…' : 'Create purchase order'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(missingSupplierWarning)}
        autoHideDuration={5000}
        onClose={() => setMissingSupplierWarning(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          onClose={() => setMissingSupplierWarning(null)}
          sx={{ width: '100%' }}
        >
          {missingSupplierWarning}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

export default PurchaseOrdersPage
