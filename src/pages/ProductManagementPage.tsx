import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
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
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { createProduct, importProducts, listProducts, updateProduct } from '../api/products'
import { fetchAllSuppliers } from '../api/suppliers'
import { fetchCategories } from '../api/categories'
import { SectionHeading } from '../components/common/SectionHeading'
import { exportRowsToXlsx, parseFirstSheet } from '../lib/xlsx'
import { type CategoryOption, UNCATEGORIZED_CATEGORY, resolveCategory } from '../utils/categories'
import type { CategoryNode } from '../types/categories'
import type { Theme } from '@mui/material/styles'
import type {
  ImportProductsRequest,
  Product,
  ProductImportRow,
  ProductRequest,
} from '../types/products'
import type { Supplier } from '../types/suppliers'

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const EXCLUDED_CATEGORY_NAMES = new Set(['giá siêu rẻ', 'giá hội viên', 'ưu đãi hội viên'])

const isExcludedCategoryName = (value?: string | null): boolean =>
  value ? EXCLUDED_CATEGORY_NAMES.has(value.trim().toLowerCase()) : false

const useDebouncedValue = <T,>(value: T, delay = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

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

type SingleSelectAutocompleteProps<T> = {
  options: T[]
  value: T | null
  onChange: (event: SyntheticEvent<Element, Event>, value: T | null) => void
  getOptionLabel: (option: T) => string
  isOptionEqualToValue: (option: T, value: T) => boolean
  renderInput: (params: Record<string, unknown>) => ReactElement
  loading?: boolean
  disabled?: boolean
}

const SingleSelectAutocomplete = <T,>(props: SingleSelectAutocompleteProps<T>) => (
  <BaseAutocomplete {...props} />
)

interface ProductFormState {
  skuCode: string
  name: string
  categoryId: string
  isPerishable: boolean
  shelfLifeDays?: number | null
  uom: string
  price: number
  minStock: number
  supplierId: string
  mediaUrl: string
}

interface ParentCategoryOption {
  key: string
  label: string
}

interface CategoryMetaEntry {
  option: CategoryOption
  parentKey: string
}

const defaultForm: ProductFormState = {
  skuCode: '',
  name: '',
  categoryId: '',
  isPerishable: false,
  shelfLifeDays: null,
  uom: '',
  price: 0,
  minStock: 0,
  supplierId: '',
  mediaUrl: '',
}

const normalizePayload = (form: ProductFormState): ProductRequest => ({
  skuCode: form.skuCode.trim(),
  name: form.name.trim(),
  categoryId: form.categoryId.trim() || undefined,
  isPerishable: form.isPerishable,
  shelfLifeDays: form.isPerishable ? (form.shelfLifeDays ?? undefined) : undefined,
  uom: form.uom.trim(),
  price: Number(form.price),
  minStock: Number(form.minStock),
  supplierId: form.supplierId.trim() || undefined,
  mediaUrl: form.mediaUrl.trim() || undefined,
})

const mapProductToForm = (product: Product): ProductFormState => ({
  skuCode: product.skuCode,
  name: product.name,
  categoryId: product.categoryId ?? '',
  isPerishable: product.isPerishable,
  shelfLifeDays: product.shelfLifeDays ?? null,
  uom: product.uom,
  price: product.price,
  minStock: product.minStock,
  supplierId: product.supplierId ?? '',
  mediaUrl: product.mediaUrl ?? '',
})

const renderError = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error. Please try again.'

export const ProductManagementPage = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<ProductFormState>(defaultForm)
  const [editForm, setEditForm] = useState<ProductFormState | null>(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [parentCategoryFilter, setParentCategoryFilter] = useState<ParentCategoryOption[]>([])
  const [childCategoryFilter, setChildCategoryFilter] = useState<CategoryOption[]>([])
  const [supplierFilter, setSupplierFilter] = useState<Supplier[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [updateTarget, setUpdateTarget] = useState<Product | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const debouncedSearch = useDebouncedValue(searchFilter, 350)

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
    staleTime: 60 * 1000,
  })

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-directory'],
    queryFn: () => fetchAllSuppliers(),
    staleTime: 5 * 60 * 1000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  })

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        minimumFractionDigits: 0,
      }),
    [],
  )

  const products = useMemo<Product[]>(() => productsQuery.data ?? [], [productsQuery.data])
  const suppliers = useMemo<Supplier[]>(() => suppliersQuery.data ?? [], [suppliersQuery.data])
  const supplierMap = useMemo(
    () => new Map<string, Supplier>(suppliers.map(supplier => [supplier.id, supplier])),
    [suppliers],
  )

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

  const categorySelectOptions = useMemo(() => {
    const aggregated = Array.from(childCategoryLookup.values()).flat()
    const unique = new Map<string, CategoryOption>()
    aggregated.forEach(option => unique.set(option.key, option))
    unique.delete(UNCATEGORIZED_CATEGORY.key)
    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [childCategoryLookup])

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

  // Define label helpers before they're used in downstream hooks
  const getCategoryLabel = useCallback(
    (product: Product) => {
      const info = getCategoryInfo(product.categoryId)
      if (
        info.option.key === UNCATEGORIZED_CATEGORY.key ||
        isExcludedCategoryName(info.option.parent) ||
        isExcludedCategoryName(info.option.child)
      ) {
        return '—'
      }
      return info.option.label
    },
    [getCategoryInfo],
  )

  const getBrandLabel = useCallback(
    (product: Product) =>
      product.brandName ??
      (product.supplierId
        ? (supplierMap.get(product.supplierId)?.name ?? product.supplierId)
        : '—'),
    [supplierMap],
  )

  const getSupplierLeadTime = useCallback(
    (product: Product) =>
      product.supplierId ? (supplierMap.get(product.supplierId)?.leadTimeDays ?? null) : null,
    [supplierMap],
  )

  const productSearchIndex = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach(product => {
      const composite = `${product.skuCode} ${product.name} ${getCategoryLabel(product)} ${getBrandLabel(product)}`
      map.set(product.id, normalizeSearchText(composite))
    })
    return map
  }, [products, getCategoryLabel, getBrandLabel])

  const searchTokens = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return []
    }
    return normalizeSearchText(debouncedSearch).split(' ').filter(Boolean)
  }, [debouncedSearch])

  const filteredProducts = useMemo(() => {
    const parentKeys = parentCategoryFilter.map(option => option.key)
    const childKeys = childCategoryFilter.map(option => option.key)
    const supplierIds = supplierFilter.map(supplier => supplier.id)

    return products.filter(product => {
      const haystack = productSearchIndex.get(product.id) ?? ''
      const matchesQuery =
        searchTokens.length === 0 || searchTokens.every(token => haystack.includes(token))

      const categoryInfo = getCategoryInfo(product.categoryId)
      const matchesParent = parentKeys.length === 0 || parentKeys.includes(categoryInfo.parentKey)
      const matchesChild = childKeys.length === 0 || childKeys.includes(categoryInfo.option.key)

      const matchesSupplier =
        supplierIds.length === 0 ||
        (product.supplierId !== null && supplierIds.includes(product.supplierId ?? ''))

      return matchesQuery && matchesParent && matchesChild && matchesSupplier
    })
  }, [
    products,
    parentCategoryFilter,
    childCategoryFilter,
    supplierFilter,
    getCategoryInfo,
    productSearchIndex,
    searchTokens,
  ])

  const totalFiltered = filteredProducts.length
  const paginatedProducts = useMemo(() => {
    const start = page * rowsPerPage
    return filteredProducts.slice(start, start + rowsPerPage)
  }, [filteredProducts, page, rowsPerPage])

  useEffect(() => {
    if (filteredProducts.length === 0) {
      setSelectedProductId(null)
      return
    }

    if (!selectedProductId || !filteredProducts.some(product => product.id === selectedProductId)) {
      setSelectedProductId(filteredProducts[0].id)
    }
  }, [filteredProducts, selectedProductId])

  useEffect(() => {
    if (page * rowsPerPage >= Math.max(totalFiltered, 1) && page !== 0) {
      setPage(0)
    }
  }, [page, rowsPerPage, totalFiltered])

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

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      setCreateDialogOpen(false)
      setCreateForm(defaultForm)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductRequest }) =>
      updateProduct(id, payload),
    onSuccess: async updated => {
      setUpdateDialogOpen(false)
      setUpdateTarget(null)
      setEditForm(null)
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      setFeedback({
        type: 'success',
        message: `SKU ${updated.skuCode} updated successfully.`,
      })
    },
    onError: error => {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to update product right now.',
      })
    },
  })

  const importMutation = useMutation({
    mutationFn: (payload: ImportProductsRequest) => importProducts(payload),
    onSuccess: async result => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      setFeedback({
        type: 'success',
        message: `Import complete: ${result.created} created, ${result.updated} updated. ${
          result.skippedInvalid + result.skippedMissingCategory + result.skippedMissingSupplier
        } skipped.`,
      })
    },
    onError: error => {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to import products right now.',
      })
    },
  })

  const handleCreateChange =
    (field: keyof ProductFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      if (field === 'isPerishable') {
        const checked = event.target.checked
        setCreateForm(prev => ({
          ...prev,
          isPerishable: checked,
          shelfLifeDays: checked ? prev.shelfLifeDays : null,
        }))
        return
      }

      if (field === 'shelfLifeDays') {
        const value = event.target.value === '' ? null : Number(event.target.value)
        setCreateForm(prev => ({ ...prev, shelfLifeDays: value }))
        return
      }

      const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value
      setCreateForm(prev => ({ ...prev, [field]: value }))
    }

  const handleEditChange =
    (field: keyof ProductFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      if (!editForm) {
        return
      }

      if (field === 'isPerishable') {
        const checked = event.target.checked
        setEditForm(prev =>
          prev
            ? { ...prev, isPerishable: checked, shelfLifeDays: checked ? prev.shelfLifeDays : null }
            : prev,
        )
        return
      }

      if (field === 'shelfLifeDays') {
        const value = event.target.value === '' ? null : Number(event.target.value)
        setEditForm(prev => (prev ? { ...prev, shelfLifeDays: value } : prev))
        return
      }

      const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value
      setEditForm(prev => (prev ? { ...prev, [field]: value } : prev))
    }

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate(normalizePayload(createForm))
  }

  const handleUpdateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!updateTarget || !editForm) {
      return
    }
    updateMutation.mutate({ id: updateTarget.id, payload: normalizePayload(editForm) })
  }

  const startPurchaseOrder = (product: Product | null) => {
    if (!product || !product.supplierId) {
      return
    }
    const params = new URLSearchParams()
    params.set('supplierId', product.supplierId)
    params.append('productId', product.id)
    navigate(`/app/purchase-orders?${params.toString()}`)
  }

  const handleRowClick = (product: Product) => {
    setSelectedProductId(product.id)
    setDetailProduct(product)
  }

  const closeDetailDialog = () => setDetailProduct(null)

  const openUpdateDialog = (product: Product) => {
    setUpdateTarget(product)
    setEditForm(mapProductToForm(product))
    setUpdateDialogOpen(true)
  }

  const closeUpdateDialog = () => {
    setUpdateDialogOpen(false)
    setUpdateTarget(null)
    setEditForm(null)
  }

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const clearFilters = () => {
    setSearchFilter('')
    setParentCategoryFilter([])
    setChildCategoryFilter([])
    setSupplierFilter([])
    setPage(0)
  }

  const normalizeString = (value: unknown): string => {
    if (value == null) {
      return ''
    }
    return String(value).trim()
  }

  const parseNumeric = (value: unknown): number | undefined => {
    if (value == null) {
      return undefined
    }
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : undefined
  }

  const parseInteger = (value: unknown): number | undefined => {
    if (value == null) {
      return undefined
    }
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value)
    }
    const parsed = Number(String(value).trim())
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
  }

  const parseBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') {
      return value
    }
    if (value == null) {
      return undefined
    }
    const normalized = String(value).trim().toLowerCase()
    if (!normalized) {
      return undefined
    }
    if (['true', '1', 'yes', 'y', 'perishable'].includes(normalized)) {
      return true
    }
    if (
      [
        'false',
        '0',
        'no',
        'n',
        'ambient',
        'non-perishable',
        'nonperishable',
        'shelf-stable',
      ].includes(normalized)
    ) {
      return false
    }
    return undefined
  }

  const buildImportPayload = (rawRows: Record<string, unknown>[]): ProductImportRow[] => {
    const payload: ProductImportRow[] = []
    rawRows.forEach(row => {
      const skuCode = normalizeString(
        row['sku_code'] ?? row['SKU Code'] ?? row['SKU'] ?? row['sku'] ?? row['Sku Code'],
      )
      const name = normalizeString(
        row['name'] ?? row['Name'] ?? row['product_name'] ?? row['Product Name'],
      )
      const uom = normalizeString(row['uom'] ?? row['UOM'] ?? row['unit'] ?? row['Unit'])
      const price = parseNumeric(row['price'] ?? row['Price'])

      if (!skuCode || !name || !uom || price == null) {
        return
      }

      const productId = normalizeString(
        row['product_id'] ?? row['Product Id'] ?? row['ProductID'] ?? row['id'],
      )
      const mediaUrl = normalizeString(
        row['media_url'] ?? row['Media Url'] ?? row['image'] ?? row['Image'],
      )
      const categoryName = normalizeString(
        row['category_name'] ?? row['Category Name'] ?? row['category'],
      )
      const brandName = normalizeString(row['brand_name'] ?? row['Brand Name'] ?? row['brand'])
      const isPerishable = parseBoolean(
        row['is_perishable'] ?? row['Is Perishable'] ?? row['perishable'] ?? row['Perishable'],
      )
      const shelfLifeDays = parseInteger(
        row['shelf_life_days'] ??
          row['Shelf Life Days'] ??
          row['shelf_life'] ??
          row['Shelf Life'] ??
          row['shelf_life_day'] ??
          row['Shelf Life Day'],
      )
      const minStock = parseInteger(
        row['min_stock'] ??
          row['Min Stock'] ??
          row['minimum_stock'] ??
          row['Minimum Stock'] ??
          row['minStock'],
      )

      const payloadRow: ProductImportRow = {
        productId: productId || undefined,
        skuCode,
        name,
        uom,
        price,
        mediaUrl: mediaUrl || undefined,
        categoryName: categoryName || undefined,
        brandName: brandName || undefined,
      }

      if (isPerishable !== undefined) {
        payloadRow.isPerishable = isPerishable
      }
      if (shelfLifeDays !== undefined) {
        payloadRow.shelfLifeDays = shelfLifeDays
      }
      if (minStock !== undefined) {
        payloadRow.minStock = minStock
      }

      payload.push(payloadRow)
    })
    return payload
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setFeedback(null)
    try {
      const rawRows = await parseFirstSheet(file)
      const payloadRows = buildImportPayload(rawRows)
      if (payloadRows.length === 0) {
        setFeedback({
          type: 'error',
          message:
            'No valid rows detected. Ensure sku_code, name, uom, and price columns exist (is_perishable, shelf_life_days, min_stock optional).',
        })
        return
      }
      await importMutation.mutateAsync({ rows: payloadRows })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to read the spreadsheet.',
      })
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleExport = () => {
    if (products.length === 0) {
      setFeedback({ type: 'error', message: 'No products available to export yet.' })
      return
    }

    const rows = products.map(product => ({
      product_id: product.id,
      sku_code: product.skuCode,
      name: product.name,
      uom: product.uom,
      price: product.price,
      media_url: product.mediaUrl ?? '',
      category_name: product.categoryName ?? '',
      brand_name: product.brandName ?? '',
      is_perishable: product.isPerishable ? 'TRUE' : 'FALSE',
      shelf_life_days: product.shelfLifeDays ?? '',
      min_stock: product.minStock,
    }))
    const today = new Date().toISOString().split('T')[0]
    exportRowsToXlsx(rows, `products-${today}.xlsx`, 'Products')
    setFeedback({
      type: 'success',
      message: `Exported ${rows.length} product${rows.length === 1 ? '' : 's'} to Excel.`,
    })
  }

  // getCategoryLabel/getBrandLabel defined earlier

  const detailProductAlerts: {
    severity: 'info' | 'warning' | 'error'
    message: string
  }[] = []
  if (
    detailProduct?.isPerishable &&
    (!detailProduct.shelfLifeDays || detailProduct.shelfLifeDays <= 0)
  ) {
    detailProductAlerts.push({
      severity: 'warning',
      message: 'Shelf life is missing for this perishable SKU.',
    })
  }
  if (detailProduct && detailProduct.minStock === 0) {
    detailProductAlerts.push({ severity: 'info', message: 'Min stock is zero.' })
  }
  if (detailProduct && !detailProduct.supplierId) {
    detailProductAlerts.push({ severity: 'error', message: 'No supplier linked to this SKU.' })
  }

  const detailProductLeadTime = detailProduct ? getSupplierLeadTime(detailProduct) : null
  const detailShelfLifeDisplay = detailProduct
    ? detailProduct.shelfLifeDays != null
      ? `${detailProduct.shelfLifeDays} day${detailProduct.shelfLifeDays === 1 ? '' : 's'}`
      : detailProduct.isPerishable
        ? 'Missing'
        : 'Not applicable'
    : '—'

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Product catalog"
        subtitle="Browse, import, and maintain SKU attributes."
        action={
          <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }} maxWidth={520}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="flex-end">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                disabled={products.length === 0}
              >
                Export (.xlsx)
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? 'Importing…' : 'Import (.xlsx)'}
              </Button>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                onClick={() => setCreateDialogOpen(true)}
              >
                Add product
              </Button>
            </Stack>
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

      {feedback && (
        <Alert severity={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <Stack direction="row" spacing={1} alignItems="center">
                <FilterAltIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  Filter catalog
                </Typography>
              </Stack>
              <Chip
                color="primary"
                label={`${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`}
              />
            </Stack>
            {(searchFilter ||
              parentCategoryFilter.length > 0 ||
              childCategoryFilter.length > 0 ||
              supplierFilter.length > 0) && (
              <Button size="small" onClick={clearFilters} color="inherit">
                Clear filters
              </Button>
            )}
          </Stack>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <TextField
                label="Search by name or SKU"
                value={searchFilter}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSearchFilter(event.target.value)
                }
                placeholder="e.g. Yogurt, SKU-001"
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
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
                    size="small"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
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
                    size="small"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <MultiSelectAutocomplete<Supplier>
                options={suppliers}
                value={supplierFilter}
                onChange={(_event: SyntheticEvent<Element, Event>, value: Supplier[]) =>
                  setSupplierFilter(value)
                }
                getOptionLabel={(option: Supplier) => option.name}
                isOptionEqualToValue={(option: Supplier, value: Supplier) => option.id === value.id}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Supplier"
                    placeholder="All suppliers"
                    size="small"
                  />
                )}
                loading={suppliersQuery.isLoading}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {searchFilter && <Chip label={`Search · "${searchFilter}"`} variant="outlined" />}
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
            {supplierFilter.map(supplier => (
              <Chip key={supplier.id} label={`Supplier · ${supplier.name}`} variant="outlined" />
            ))}
          </Stack>
        </Stack>
      </Paper>

      {productsQuery.isError && <Alert severity="error">Failed to load products.</Alert>}

      <Paper sx={{ p: 0, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={64}>No.</TableCell>
                <TableCell>SKU code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>UoM</TableCell>
                <TableCell sx={{ display: 'none' }}>Price</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Brand</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {productsQuery.isLoading ? (
                Array.from({ length: rowsPerPage }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell colSpan={8}>
                      <Skeleton variant="rectangular" height={48} />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Box py={5} textAlign="center">
                      <Typography variant="h6">
                        {products.length === 0 ? 'No products yet' : 'No products found'}
                      </Typography>
                      <Typography color="text.secondary">
                        {products.length === 0
                          ? 'Import a spreadsheet or add a product to get started.'
                          : 'Adjust the filters or search query to see other products.'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product, index) => (
                  <TableRow
                    hover
                    key={product.id}
                    onClick={() => handleRowClick(product)}
                    sx={{ cursor: 'pointer' }}
                    selected={product.id === selectedProductId}
                  >
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{product.skuCode}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            border: theme => `1px solid ${theme.palette.divider}`,
                            bgcolor: product.mediaUrl ? 'transparent' : 'action.hover',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {product.mediaUrl ? (
                            <Box
                              component="img"
                              src={product.mediaUrl}
                              alt={product.name}
                              loading="lazy"
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Typography variant="subtitle2" color="text.secondary">
                              {(
                                (product.name?.trim() || product.skuCode || '?')[0] ?? '?'
                              ).toUpperCase()}
                            </Typography>
                          )}
                        </Box>
                        <Stack spacing={0.5}>
                          <Typography fontWeight={600}>{product.name}</Typography>
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell>{product.uom}</TableCell>
                    <TableCell sx={{ display: 'none' }}>
                      {currencyFormatter.format(product.price)}
                    </TableCell>
                    <TableCell>{getCategoryLabel(product)}</TableCell>
                    <TableCell>{getBrandLabel(product)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit product">
                        <IconButton
                          size="small"
                          onClick={event => {
                            event.stopPropagation()
                            openUpdateDialog(product)
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalFiltered}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <Box component="form" onSubmit={handleCreateSubmit}>
          <DialogTitle>Add product</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} mt={1}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="SKU code"
                  value={createForm.skuCode}
                  onChange={handleCreateChange('skuCode')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Name"
                  value={createForm.name}
                  onChange={handleCreateChange('name')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Category (ID or code)"
                  value={createForm.categoryId}
                  onChange={handleCreateChange('categoryId')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Supplier ID"
                  value={createForm.supplierId}
                  onChange={handleCreateChange('supplierId')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Media URL"
                  value={createForm.mediaUrl}
                  onChange={handleCreateChange('mediaUrl')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={createForm.isPerishable}
                      onChange={handleCreateChange('isPerishable')}
                    />
                  }
                  label="Perishable SKU"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Shelf life (days)"
                  type="number"
                  value={createForm.shelfLifeDays ?? ''}
                  onChange={handleCreateChange('shelfLifeDays')}
                  disabled={!createForm.isPerishable}
                  required={createForm.isPerishable}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Unit of measure"
                  value={createForm.uom}
                  onChange={handleCreateChange('uom')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Price"
                  type="number"
                  value={createForm.price}
                  onChange={handleCreateChange('price')}
                  required
                  fullWidth
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Min stock"
                  type="number"
                  value={createForm.minStock}
                  onChange={handleCreateChange('minStock')}
                  required
                  fullWidth
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
            </Grid>
            {createMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {renderError(createMutation.error)}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={updateDialogOpen} onClose={closeUpdateDialog} maxWidth="md" fullWidth>
        {editForm ? (
          <Box component="form" onSubmit={handleUpdateSubmit}>
            <DialogTitle>Update product</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} mt={1}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SKU code"
                    value={editForm.skuCode}
                    onChange={handleEditChange('skuCode')}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Name"
                    value={editForm.name}
                    onChange={handleEditChange('name')}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <SingleSelectAutocomplete<CategoryOption>
                    options={categorySelectOptions}
                    value={
                      editForm.categoryId.trim()
                        ? getCategoryInfo(editForm.categoryId).option
                        : null
                    }
                    onChange={(_event, value) =>
                      setEditForm(prev =>
                        prev
                          ? {
                              ...prev,
                              categoryId: value?.key ?? '',
                            }
                          : prev,
                      )
                    }
                    getOptionLabel={(option: CategoryOption) => option.label}
                    isOptionEqualToValue={(option: CategoryOption, value: CategoryOption) =>
                      option.key === value.key
                    }
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Category"
                        placeholder="Search parent or child categories"
                        fullWidth
                      />
                    )}
                    loading={categoriesQuery.isLoading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <SingleSelectAutocomplete<Supplier>
                    options={suppliers}
                    value={
                      editForm.supplierId.trim()
                        ? (supplierMap.get(editForm.supplierId) ?? null)
                        : null
                    }
                    onChange={(_event, value) =>
                      setEditForm(prev =>
                        prev
                          ? {
                              ...prev,
                              supplierId: value?.id ?? '',
                            }
                          : prev,
                      )
                    }
                    getOptionLabel={(option: Supplier) => option.name}
                    isOptionEqualToValue={(option: Supplier, value: Supplier) =>
                      option.id === value.id
                    }
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Supplier"
                        placeholder="Search suppliers"
                        fullWidth
                      />
                    )}
                    loading={suppliersQuery.isLoading}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Media URL"
                    value={editForm.mediaUrl}
                    onChange={handleEditChange('mediaUrl')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.isPerishable}
                        onChange={handleEditChange('isPerishable')}
                      />
                    }
                    label="Perishable SKU"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Shelf life (days)"
                    type="number"
                    value={editForm.shelfLifeDays ?? ''}
                    onChange={handleEditChange('shelfLifeDays')}
                    disabled={!editForm.isPerishable}
                    required={editForm.isPerishable}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Unit of measure"
                    value={editForm.uom}
                    onChange={handleEditChange('uom')}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Price"
                    type="number"
                    value={editForm.price}
                    onChange={handleEditChange('price')}
                    required
                    fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Min stock"
                    type="number"
                    value={editForm.minStock}
                    onChange={handleEditChange('minStock')}
                    required
                    fullWidth
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Grid>
              </Grid>
              {updateMutation.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {renderError(updateMutation.error)}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeUpdateDialog}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update product'}
              </Button>
            </DialogActions>
          </Box>
        ) : (
          <>
            <DialogTitle>Update product</DialogTitle>
            <DialogContent>
              <Typography color="text.secondary">
                Select a product from the table to edit its attributes.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeUpdateDialog}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={!!detailProduct} onClose={closeDetailDialog} maxWidth="md" fullWidth>
        {detailProduct && (
          <>
            <DialogTitle>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Typography variant="h6" component="span">
                  {detailProduct.name}
                </Typography>
                <Chip
                  label={detailProduct.isPerishable ? 'Perishable item' : 'Shelf-stable'}
                  variant="filled"
                  size="small"
                  sx={(theme: Theme) => ({
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    bgcolor: detailProduct.isPerishable
                      ? theme.palette.warning.main
                      : theme.palette.grey[300],
                    color: detailProduct.isPerishable
                      ? theme.palette.warning.contrastText
                      : theme.palette.text.primary,
                  })}
                />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      overflow: 'hidden',
                      bgcolor: detailProduct.mediaUrl ? 'transparent' : 'grey.100',
                    }}
                  >
                    {detailProduct.mediaUrl ? (
                      <Box
                        component="img"
                        src={detailProduct.mediaUrl}
                        alt={detailProduct.name}
                        sx={{ width: '100%', display: 'block' }}
                      />
                    ) : (
                      <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          No image available
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                  <Stack spacing={1} mt={2}>
                    <Chip label={getBrandLabel(detailProduct)} size="small" />
                    {detailProduct.mediaUrl && (
                      <Button
                        variant="outlined"
                        onClick={() => window.open(detailProduct.mediaUrl!, '_blank', 'noopener')}
                      >
                        Open image
                      </Button>
                    )}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Product ID
                      </Typography>
                      <Typography variant="subtitle1">{detailProduct.id}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        SKU code
                      </Typography>
                      <Typography variant="subtitle1">{detailProduct.skuCode}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Category
                      </Typography>
                      <Typography variant="subtitle1">{getCategoryLabel(detailProduct)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Supplier
                      </Typography>
                      <Typography variant="subtitle1">
                        {detailProduct.supplierId
                          ? (supplierMap.get(detailProduct.supplierId)?.name ??
                            detailProduct.supplierId)
                          : 'Unassigned'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} sx={{ display: 'none' }}>
                      <Typography variant="body2" color="text.secondary">
                        Price
                      </Typography>
                      <Typography variant="subtitle1">
                        {currencyFormatter.format(detailProduct.price)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Min stock
                      </Typography>
                      <Typography variant="subtitle1">{detailProduct.minStock}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Lead time (days)
                      </Typography>
                      <Typography variant="subtitle1">{detailProductLeadTime ?? '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Shelf life (days)
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        sx={(theme: Theme) => ({
                          color: detailProduct.isPerishable
                            ? detailProduct.shelfLifeDays && detailProduct.shelfLifeDays > 0
                              ? theme.palette.warning.dark
                              : theme.palette.warning.main
                            : theme.palette.text.secondary,
                          fontWeight: detailProduct.isPerishable ? 600 : undefined,
                        })}
                      >
                        {detailShelfLifeDisplay}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Last modified
                      </Typography>
                      <Typography variant="subtitle1">
                        {new Date(detailProduct.lastModifiedAt).toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>
                  {detailProductAlerts.length > 0 && (
                    <Stack spacing={1} mt={3}>
                      {detailProductAlerts.map(alert => (
                        <Alert key={alert.message} severity={alert.severity}>
                          {alert.message}
                        </Alert>
                      ))}
                    </Stack>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button
                startIcon={<EditOutlinedIcon />}
                variant="contained"
                onClick={() => {
                  if (detailProduct) {
                    openUpdateDialog(detailProduct)
                    closeDetailDialog()
                  }
                }}
              >
                Edit product
              </Button>
              <Button
                variant="outlined"
                startIcon={<ShoppingCartCheckoutIcon />}
                onClick={() => startPurchaseOrder(detailProduct)}
                disabled={!detailProduct.supplierId}
              >
                Create PO
              </Button>
              <Button onClick={closeDetailDialog}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  )
}

export default ProductManagementPage
