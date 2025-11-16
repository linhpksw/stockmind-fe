import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Autocomplete from '@mui/material/Autocomplete'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  IconButton,
  LinearProgress,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import {
  applyAllMarkdowns,
  applyMarkdown,
  createMarkdownRule,
  deleteMarkdownRule,
  getMarkdownRecommendations,
  revertLotSaleDecision,
  listMarkdownRules,
  updateMarkdownRule,
} from '../api/markdowns'
import { fetchCategories } from '../api/categories'
import { SectionHeading } from '../components/common/SectionHeading'
import { listMarginProfiles } from '../api/margins'
import type { CategoryNode } from '../types/categories'
import type { CategoryOption } from '../utils/categories'
import { formatDateTime } from '../utils/formatters'
import type {
  MarkdownApplyBulkRequest,
  MarkdownApplyBulkResponse,
  MarkdownRecommendation,
  MarkdownRule,
  UpsertMarkdownRuleRequest,
} from '../types/markdowns'

interface ParentCategoryOption {
  key: string
  label: string
}

interface CategoryMetaEntry {
  option: CategoryOption
  parentKey: string
}

interface RuleFormState {
  parentCategory: ParentCategoryOption | null
  childCategory: CategoryOption | null
  daysToExpiry: number
  discountPercent: number
  floorPercentOfCost: number
}

interface RuleDialogState {
  open: boolean
  mode: 'create' | 'edit'
  rule?: MarkdownRule
}

interface PendingApplyState {
  item: MarkdownRecommendation
  discount: number
  requiresOverride: boolean
}

interface PendingApplyAllState {
  total: number
  overrides: number
}

interface PendingRuleSubmission {
  payload: UpsertMarkdownRuleRequest
  mode: 'create' | 'edit'
  ruleId?: number
  floorPercentDisplay: number
}

const BaseAutocomplete = Autocomplete as unknown as (props: Record<string, unknown>) => ReactElement

type SingleSelectAutocompleteProps<T> = {
  options: T[]
  value: T | null
  onChange: (event: SyntheticEvent<Element, Event>, value: T | null) => void
  getOptionLabel: (option: T) => string
  isOptionEqualToValue: (option: T, value: T) => boolean
  renderInput: (params: Record<string, unknown>) => ReactElement
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  clearOnEscape?: boolean
}

const SingleSelectAutocomplete = <T,>(props: SingleSelectAutocompleteProps<T>) => (
  <BaseAutocomplete {...props} />
)

const fractionToPercent = (value?: number, fallback = 0): number =>
  Number(((value ?? fallback) * 100).toFixed(2))

const clampPercent = (value: number, allowNegative = false): number => {
  if (Number.isNaN(value)) {
    return 0
  }
  const min = allowNegative ? -100 : 0
  return Math.min(100, Math.max(min, value))
}

const percentToFraction = (value: number, allowNegative = false): number =>
  Number((clampPercent(value, allowNegative) / 100).toFixed(4))

const resolveErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

const listPriceTooltip =
  'List price is the base selling price before markdowns. Estimate it by dividing the unit cost by (1 − target margin %).'
const floorPriceTooltip =
  'Floor price is the minimum guardrail derived from cost: floor price = unit cost ÷ (1 − floor % of cost).'
const suggestedDiscountTooltip =
  'Profit/Loss vs floor uses the discount price (list price × (1 − discount %)) compared to the floor price: (discount price − floor price) × quantity.'

export const MarkdownsPage = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [days, setDays] = useState(1)
  const [filterParentCategory, setFilterParentCategory] = useState<ParentCategoryOption | null>(
    null,
  )
  const [filterChildCategory, setFilterChildCategory] = useState<CategoryOption | null>(null)
  const [ruleDialogState, setRuleDialogState] = useState<RuleDialogState>({
    open: false,
    mode: 'create',
  })
  const [ruleForm, setRuleForm] = useState<RuleFormState>({
    parentCategory: null,
    childCategory: null,
    daysToExpiry: 3,
    discountPercent: 20,
    floorPercentOfCost: 80,
  })
  const [floorInputValue, setFloorInputValue] = useState('80')
  const [ruleToDelete, setRuleToDelete] = useState<MarkdownRule | null>(null)
  const [discountOverrides, setDiscountOverrides] = useState<Record<string, number>>({})
  const [pendingApply, setPendingApply] = useState<PendingApplyState | null>(null)
  const [pendingApplyAll, setPendingApplyAll] = useState<PendingApplyAllState | null>(null)
  const [pendingLossSubmission, setPendingLossSubmission] = useState<PendingRuleSubmission | null>(
    null,
  )
  const [revertingDecisionId, setRevertingDecisionId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const recommendationsQuery = useQuery({
    queryKey: ['markdowns', days],
    queryFn: () => getMarkdownRecommendations(days),
  })

  const applyMutation = useMutation({
    mutationFn: applyMarkdown,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markdowns'] })
    },
  })
  const applyAllMutation = useMutation<MarkdownApplyBulkResponse, Error, MarkdownApplyBulkRequest>({
    mutationFn: applyAllMarkdowns,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markdowns'] })
    },
  })
  const revertDecisionMutation = useMutation({
    mutationFn: (decisionId: number) => revertLotSaleDecision(decisionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markdowns'] })
    },
    onSettled: () => {
      setRevertingDecisionId(null)
    },
  })

  const rulesQuery = useQuery({
    queryKey: ['markdown-rules'],
    queryFn: listMarkdownRules,
  })

  const categoriesQuery = useQuery({
    queryKey: ['markdown-rule-categories'],
    queryFn: fetchCategories,
  })
  const marginProfilesQuery = useQuery({
    queryKey: ['margin-profiles'],
    queryFn: listMarginProfiles,
  })

  const {
    parentCategoryOptions,
    childCategoryLookup,
    categoryMeta,
  }: {
    parentCategoryOptions: ParentCategoryOption[]
    childCategoryLookup: Map<string, CategoryOption[]>
    categoryMeta: Map<string, CategoryMetaEntry>
  } = useMemo(() => {
    const parents: ParentCategoryOption[] = []
    const childLookup = new Map<string, CategoryOption[]>()
    const meta = new Map<string, CategoryMetaEntry>()

    const registerChild = (parentKey: string, option: CategoryOption) => {
      const list = childLookup.get(parentKey) ?? []
      list.push(option)
      childLookup.set(parentKey, list)
    }

    const traverse = (node: CategoryNode, rootParentKey?: string, rootParentLabel?: string) => {
      const key = node.categoryId.toString()
      const isRoot = !rootParentKey
      const label = rootParentLabel ? `${rootParentLabel} › ${node.name}` : node.name
      const option: CategoryOption = {
        key,
        parent: rootParentLabel ?? node.name,
        child: node.name,
        label,
      }

      const parentKey = rootParentKey ?? key
      meta.set(key, { option, parentKey })

      if (isRoot) {
        parents.push({ key, label: node.name })
      } else {
        registerChild(parentKey, option)
      }

      if (node.children?.length) {
        const ancestorKey = isRoot ? key : rootParentKey!
        const ancestorLabel = isRoot ? node.name : rootParentLabel!
        node.children.forEach(child => traverse(child, ancestorKey, ancestorLabel))
      }
    }

    for (const node of categoriesQuery.data ?? []) {
      traverse(node)
    }

    parents.sort((a, b) => a.label.localeCompare(b.label))
    childLookup.forEach(options =>
      options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    )

    return { parentCategoryOptions: parents, childCategoryLookup: childLookup, categoryMeta: meta }
  }, [categoriesQuery.data])

  const availableChildOptions = useMemo(() => {
    if (!ruleForm.parentCategory) {
      return []
    }

    return childCategoryLookup.get(ruleForm.parentCategory.key) ?? []
  }, [childCategoryLookup, ruleForm.parentCategory])
  const filterChildOptions = useMemo(() => {
    if (!filterParentCategory) {
      return []
    }
    return childCategoryLookup.get(filterParentCategory.key) ?? []
  }, [childCategoryLookup, filterParentCategory])
  useEffect(() => {
    if (
      filterParentCategory &&
      !parentCategoryOptions.some(option => option.key === filterParentCategory.key)
    ) {
      setFilterParentCategory(null)
      setFilterChildCategory(null)
      return
    }
    if (filterChildCategory) {
      if (!filterParentCategory) {
        setFilterChildCategory(null)
        return
      }
      const validChildren = childCategoryLookup.get(filterParentCategory.key) ?? []
      if (!validChildren.some(option => option.key === filterChildCategory.key)) {
        setFilterChildCategory(null)
      }
    }
  }, [filterParentCategory, filterChildCategory, parentCategoryOptions, childCategoryLookup])
  const marginLookup = useMemo(() => {
    const map = new Map<string, { minMarginPct: number; targetMarginPct: number }>()
    ;(marginProfilesQuery.data ?? []).forEach(profile => {
      map.set(profile.parentCategoryId.toString(), {
        minMarginPct: profile.minMarginPct,
        targetMarginPct: profile.targetMarginPct,
      })
    })
    return map
  }, [marginProfilesQuery.data])
  const resolveMarginPreset = useCallback(
    (categoryKey?: string | null) => {
      if (!categoryKey) {
        return null
      }
      const metaEntry = categoryMeta.get(categoryKey)
      const lookupKey = metaEntry?.parentKey ?? categoryKey
      const target = marginLookup.get(lookupKey)
      return target ? Number(target.minMarginPct.toFixed(2)) : null
    },
    [categoryMeta, marginLookup],
  )
  const ruleCategoryKey = ruleForm.childCategory?.key ?? ruleForm.parentCategory?.key ?? null
  const selectedMinMarginPct = useMemo(
    () => (ruleCategoryKey ? resolveMarginPreset(ruleCategoryKey) : null),
    [ruleCategoryKey, resolveMarginPreset],
  )
  const getTargetMarginPct = useCallback(
    (categoryKey?: string | null) => {
      if (!categoryKey) {
        return null
      }
      const metaEntry = categoryMeta.get(categoryKey)
      const lookupKey = metaEntry?.parentKey ?? categoryKey
      const entry = marginLookup.get(lookupKey)
      return entry ? entry.targetMarginPct : null
    },
    [categoryMeta, marginLookup],
  )

  const buildRuleFormState = useCallback(
    (rule?: MarkdownRule): RuleFormState => {
      const base: RuleFormState = {
        parentCategory: null,
        childCategory: null,
        daysToExpiry: rule?.daysToExpiry ?? 3,
        discountPercent: fractionToPercent(rule?.discountPercent, 0.2),
        floorPercentOfCost: fractionToPercent(rule?.floorPercentOfCost, 0.8),
      }

      if (!rule?.categoryId) {
        return base
      }

      const metaEntry = categoryMeta.get(rule.categoryId)
      if (!metaEntry) {
        return base
      }

      const parentOption =
        parentCategoryOptions.find(option => option.key === metaEntry.parentKey) ?? null
      const childOption = metaEntry.option.key !== metaEntry.parentKey ? metaEntry.option : null

      return {
        ...base,
        parentCategory: parentOption,
        childCategory: childOption,
      }
    },
    [categoryMeta, parentCategoryOptions],
  )

  const resetRuleForm = useCallback(() => {
    setRuleForm(buildRuleFormState())
  }, [buildRuleFormState])

  const invalidateRules = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['markdown-rules'] })
  }, [queryClient])

  const closeRuleDialog = useCallback(() => {
    setRuleDialogState({ open: false, mode: 'create' })
    resetRuleForm()
  }, [resetRuleForm])

  const createRuleMutation = useMutation({
    mutationFn: createMarkdownRule,
    onSuccess: () => {
      invalidateRules()
      closeRuleDialog()
    },
  })

  const updateRuleMutation = useMutation({
    mutationFn: ({ ruleId, payload }: { ruleId: number; payload: UpsertMarkdownRuleRequest }) =>
      updateMarkdownRule(ruleId, payload),
    onSuccess: () => {
      invalidateRules()
      closeRuleDialog()
    },
  })
  const submitRule = useCallback(
    (submission: PendingRuleSubmission) => {
      if (submission.mode === 'edit' && submission.ruleId) {
        updateRuleMutation.mutate({ ruleId: submission.ruleId, payload: submission.payload })
      } else {
        createRuleMutation.mutate(submission.payload)
      }
    },
    [createRuleMutation, updateRuleMutation],
  )

  const deleteRuleMutation = useMutation({
    mutationFn: deleteMarkdownRule,
    onSuccess: () => {
      invalidateRules()
      setRuleToDelete(null)
    },
  })

  useEffect(() => {
    if (ruleDialogState.open && ruleDialogState.mode === 'edit' && ruleDialogState.rule) {
      setRuleForm(buildRuleFormState(ruleDialogState.rule))
    }
  }, [ruleDialogState.open, ruleDialogState.mode, ruleDialogState.rule, buildRuleFormState])

  const handleDaysChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDays(Number(event.target.value))
  }

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  const sortedRules = useMemo(() => {
    const items = rulesQuery.data ?? []
    return [...items].sort((a, b) => {
      const scopeDiff = (a.categoryId ? 1 : 0) - (b.categoryId ? 1 : 0)
      if (scopeDiff !== 0) {
        return scopeDiff
      }

      const nameA = a.categoryName ?? ''
      const nameB = b.categoryName ?? ''
      const nameDiff = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
      if (nameDiff !== 0) {
        return nameDiff
      }

      return a.daysToExpiry - b.daysToExpiry
    })
  }, [rulesQuery.data])
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('__all__')

  const groupedRules = useMemo(
    () =>
      sortedRules.reduce<{ key: string; label: string; rules: MarkdownRule[] }[]>(
        (groups, rule) => {
          const key = rule.categoryId ?? '__global__'
          const label = rule.categoryName ?? 'All categories'
          const lastGroup = groups[groups.length - 1]
          if (lastGroup && lastGroup.key === key) {
            lastGroup.rules.push(rule)
            return groups
          }
          groups.push({ key, label, rules: [rule] })
          return groups
        },
        [],
      ),
    [sortedRules],
  )
  useEffect(() => {
    if (selectedGroupKey === '__all__') {
      return
    }
    if (!groupedRules.some(group => group.key === selectedGroupKey)) {
      setSelectedGroupKey('__all__')
    }
  }, [groupedRules, selectedGroupKey])
  const groupSelectOptions = useMemo(
    () => [
      { key: '__all__', label: 'All scopes' },
      ...groupedRules.map(group => ({ key: group.key, label: group.label })),
    ],
    [groupedRules],
  )
  const visibleGroups = useMemo(
    () =>
      selectedGroupKey === '__all__'
        ? groupedRules
        : groupedRules.filter(group => group.key === selectedGroupKey),
    [groupedRules, selectedGroupKey],
  )

  const percentFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }),
    [],
  )
  const profitFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }),
    [],
  )
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'VND' }),
    [],
  )

  const recommendations = useMemo(
    () => recommendationsQuery.data ?? [],
    [recommendationsQuery.data],
  )
  const filteredRecommendations = useMemo(() => {
    if (!filterParentCategory && !filterChildCategory) {
      return recommendations
    }
    return recommendations.filter(item => {
      if (item.categoryId === undefined || item.categoryId === null) {
        return false
      }
      const categoryKey = item.categoryId.toString()
      const metaEntry = categoryMeta.get(categoryKey)
      if (!metaEntry) {
        return false
      }
      if (filterChildCategory) {
        return metaEntry.option.key === filterChildCategory.key
      }
      if (filterParentCategory) {
        return metaEntry.parentKey === filterParentCategory.key
      }
      return true
    })
  }, [recommendations, filterParentCategory, filterChildCategory, categoryMeta])
  const hasRecommendations = filteredRecommendations.length > 0
  const hasCategoryFilter = Boolean(filterParentCategory || filterChildCategory)

  useEffect(() => {
    setDiscountOverrides(prev => {
      if (Object.keys(prev).length === 0) {
        return prev
      }
      const validKeys = new Set(recommendations.map(item => `${item.productId}-${item.lotId}`))
      let changed = false
      const next: Record<string, number> = {}
      Object.entries(prev).forEach(([key, value]) => {
        if (validKeys.has(key)) {
          next[key] = value
        } else {
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [recommendations])

  const getRecommendationKey = (item: MarkdownRecommendation) => `${item.productId}-${item.lotId}`

  const getDiscountForRecommendation = (item: MarkdownRecommendation) => {
    const key = getRecommendationKey(item)
    const override = discountOverrides[key]
    return typeof override === 'number' ? override : item.suggestedDiscountPct
  }

  const shouldOverrideFloor = (item: MarkdownRecommendation, discount: number) => {
    if (typeof item.floorSafeDiscountPct === 'number') {
      return discount - item.floorSafeDiscountPct > 0.00005
    }
    return Boolean(item.requiresFloorOverride && discount > 0)
  }

  const handleDiscountOverrideChange =
    (item: MarkdownRecommendation) => (event: ChangeEvent<HTMLInputElement>) => {
      const key = getRecommendationKey(item)
      const nextValue = Number(event.target.value)
      if (Number.isNaN(nextValue)) {
        setDiscountOverrides(prev => {
          if (!(key in prev)) {
            return prev
          }
          const next = { ...prev }
          delete next[key]
          return next
        })
        return
      }
      const clampedPct = Math.min(100, Math.max(0, nextValue))
      const decimal = clampedPct / 100
      if (Math.abs(decimal - item.suggestedDiscountPct) < 0.00005) {
        setDiscountOverrides(prev => {
          if (!(key in prev)) {
            return prev
          }
          const next = { ...prev }
          delete next[key]
          return next
        })
        return
      }
      setDiscountOverrides(prev => ({ ...prev, [key]: decimal }))
    }

  const describeProduct = (item: MarkdownRecommendation) =>
    item.productName ?? `Product ${item.productId}`

  const openConfirmApplyAll = () => {
    if (!hasRecommendations || applyAllMutation.isPending) {
      return
    }
    const overrides = filteredRecommendations.filter(item =>
      shouldOverrideFloor(item, getDiscountForRecommendation(item)),
    ).length
    setPendingApplyAll({ total: filteredRecommendations.length, overrides })
  }

  const handleApplyAllConfirmed = () => {
    if (!pendingApplyAll || applyAllMutation.isPending) {
      return
    }
    const payload: MarkdownApplyBulkRequest = {
      items: filteredRecommendations.map(item => {
        const discount = getDiscountForRecommendation(item)
        return {
          productId: item.productId,
          lotId: item.lotId,
          discountPct: discount,
          overrideFloor: shouldOverrideFloor(item, discount),
        }
      }),
    }
    applyAllMutation.mutate(payload, {
      onSettled: () => setPendingApplyAll(null),
    })
  }

  const handleCancelApplyAll = () => {
    if (applyAllMutation.isPending) {
      return
    }
    setPendingApplyAll(null)
  }

  const openConfirmApplyDialog = (item: MarkdownRecommendation) => {
    const discount = getDiscountForRecommendation(item)
    const override = shouldOverrideFloor(item, discount)
    setPendingApply({ item, discount, requiresOverride: override })
  }

  const handleConfirmApply = () => {
    if (!pendingApply) {
      return
    }
    const payload = {
      productId: pendingApply.item.productId,
      lotId: pendingApply.item.lotId,
      discountPct: pendingApply.discount,
      overrideFloor: pendingApply.requiresOverride,
    }
    applyMutation.mutate(payload, {
      onSuccess: () => {
        setPendingApply(null)
      },
    })
  }

  const handleCancelApply = () => {
    if (applyMutation.isPending) {
      return
    }
    setPendingApply(null)
  }

  const openCreateRuleDialog = () => {
    setRuleDialogState({ open: true, mode: 'create' })
    setRuleForm(buildRuleFormState())
  }

  const openEditRuleDialog = (rule: MarkdownRule) => {
    setRuleDialogState({ open: true, mode: 'edit', rule })
    setRuleForm(buildRuleFormState(rule))
  }

  const handleParentCategoryChange = (
    _event: SyntheticEvent<Element, Event>,
    option: ParentCategoryOption | null,
  ) => {
    setRuleForm(prev => {
      const preset = resolveMarginPreset(option?.key)
      return {
        ...prev,
        parentCategory: option,
        childCategory: null,
        floorPercentOfCost: preset ?? prev.floorPercentOfCost,
      }
    })
  }

  const handleChildCategoryChange = (
    _event: SyntheticEvent<Element, Event>,
    option: CategoryOption | null,
  ) => {
    setRuleForm(prev => {
      const key = option?.key ?? prev.parentCategory?.key ?? null
      const preset = resolveMarginPreset(key)
      return {
        ...prev,
        childCategory: option ?? null,
        floorPercentOfCost: preset ?? prev.floorPercentOfCost,
      }
    })
  }
  useEffect(() => {
    setFloorInputValue(
      Number.isNaN(ruleForm.floorPercentOfCost) ? '' : ruleForm.floorPercentOfCost.toString(),
    )
  }, [ruleForm.floorPercentOfCost])
  const handleFloorPercentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    setFloorInputValue(value)
    if (value === '' || value === '-' || value === '-.' || value === '-0.') {
      return
    }
    const parsed = Number(value)
    if (Number.isNaN(parsed)) {
      return
    }
    setRuleForm(prev => ({ ...prev, floorPercentOfCost: parsed }))
  }

  const handleRuleFieldChange =
    (field: keyof Omit<RuleFormState, 'parentCategory' | 'childCategory'>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setRuleForm(prev => ({
        ...prev,
        [field]: Number(event.target.value),
      }))
    }

  const handleRuleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const selectedCategoryId = ruleForm.childCategory?.key ?? ruleForm.parentCategory?.key

    const payload: UpsertMarkdownRuleRequest = {
      categoryId: selectedCategoryId ?? undefined,
      daysToExpiry: Number.isNaN(ruleForm.daysToExpiry)
        ? 0
        : Math.max(0, Math.trunc(ruleForm.daysToExpiry)),
      discountPercent: percentToFraction(ruleForm.discountPercent),
      floorPercentOfCost: percentToFraction(ruleForm.floorPercentOfCost, true),
    }

    const submission: PendingRuleSubmission = {
      payload,
      mode: ruleDialogState.mode,
      ruleId: ruleDialogState.rule?.id,
      floorPercentDisplay: ruleForm.floorPercentOfCost,
    }

    if (ruleForm.floorPercentOfCost < 0) {
      setPendingLossSubmission(submission)
      return
    }

    submitRule(submission)
  }

  const handleDeleteRule = () => {
    if (!ruleToDelete) {
      return
    }
    deleteRuleMutation.mutate(ruleToDelete.id)
  }
  const handleRevertDecision = (decisionId: number | null | undefined) => {
    if (!decisionId) {
      return
    }
    setRevertingDecisionId(decisionId)
    revertDecisionMutation.mutate(decisionId)
  }
  const handleLossWarningCancel = () => {
    setPendingLossSubmission(null)
  }
  const handleLossWarningConfirm = () => {
    if (!pendingLossSubmission) {
      return
    }
    submitRule(pendingLossSubmission)
    setPendingLossSubmission(null)
  }

  const ruleMutationError = createRuleMutation.error ?? updateRuleMutation.error
  const pendingLossPercent = pendingLossSubmission?.floorPercentDisplay ?? 0

  return (
    <Stack spacing={3}>
      <SectionHeading
        title="Markdown operations"
        subtitle="Review FEFO markdown recommendations and maintain the rule book."
      />

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tab label="Recommendations" value={0} />
        <Tab label="Markdown rules" value={1} />
      </Tabs>

      {activeTab === 0 && (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Days to expiry"
                    type="number"
                    value={days}
                    onChange={handleDaysChange}
                    InputProps={{ inputProps: { min: 1, max: 30 } }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <SingleSelectAutocomplete<ParentCategoryOption>
                    options={parentCategoryOptions}
                    value={filterParentCategory}
                    onChange={(_event, option) => {
                      setFilterParentCategory(option)
                      setFilterChildCategory(null)
                    }}
                    getOptionLabel={(option: ParentCategoryOption) => option?.label ?? ''}
                    isOptionEqualToValue={(
                      option: ParentCategoryOption,
                      value: ParentCategoryOption,
                    ) => option.key === value.key}
                    loading={categoriesQuery.isFetching}
                    fullWidth
                    clearOnEscape
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Category level 1"
                        placeholder="All parent categories"
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <SingleSelectAutocomplete<CategoryOption>
                    options={filterChildOptions}
                    value={filterChildCategory}
                    onChange={(_event, option) => setFilterChildCategory(option ?? null)}
                    getOptionLabel={(option: CategoryOption) => option.label}
                    isOptionEqualToValue={(option: CategoryOption, value: CategoryOption) =>
                      option.key === value.key
                    }
                    disabled={!filterParentCategory || filterChildOptions.length === 0}
                    fullWidth
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Category level 2"
                        placeholder={
                          filterParentCategory
                            ? 'All child categories'
                            : 'Select a level 1 category first'
                        }
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      onClick={() => recommendationsQuery.refetch()}
                      disabled={recommendationsQuery.isFetching}
                    >
                      Refresh
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={openConfirmApplyAll}
                      disabled={!hasRecommendations || applyAllMutation.isPending}
                    >
                      {applyAllMutation.isPending ? 'Applying...' : 'Apply all'}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {applyAllMutation.isSuccess && applyAllMutation.data && (
            <Alert severity={applyAllMutation.data.failed > 0 ? 'warning' : 'success'}>
              <Typography component="span" sx={{ display: 'block' }}>
                {`Applied ${applyAllMutation.data.applied} of ${applyAllMutation.data.requested} markdowns.`}
              </Typography>
              {applyAllMutation.data.failed > 0 && applyAllMutation.data.errors.length > 0 && (
                <Typography component="span" variant="body2">
                  {`First errors: ${applyAllMutation.data.errors.slice(0, 3).join('; ')}`}
                </Typography>
              )}
            </Alert>
          )}
          {applyAllMutation.isError && (
            <Alert severity="error">
              {resolveErrorMessage(applyAllMutation.error, 'Unable to apply all markdowns.')}
            </Alert>
          )}

          {recommendationsQuery.isError && (
            <Alert severity="error">Failed to load recommendations.</Alert>
          )}

          <Card>
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '25%' }}>Product</TableCell>
                    <TableCell align="right">Unit cost</TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        justifyContent="flex-end"
                      >
                        <Box component="span">List price</Box>
                        <Tooltip title={listPriceTooltip} arrow placement="top">
                          <InfoOutlinedIcon
                            fontSize="small"
                            sx={{ color: 'text.secondary', cursor: 'help' }}
                          />
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell>Lot received at</TableCell>
                    <TableCell>Days to expiry</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box component="span">Suggested discount</Box>
                        <Tooltip title={suggestedDiscountTooltip} arrow placement="top">
                          <InfoOutlinedIcon
                            fontSize="small"
                            sx={{ color: 'text.secondary', cursor: 'help' }}
                          />
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        justifyContent="flex-end"
                      >
                        <Box component="span">Floor % of import cost</Box>
                        <Tooltip title={floorPriceTooltip} placement="top" arrow>
                          <InfoOutlinedIcon
                            fontSize="small"
                            sx={{ color: 'text.secondary', cursor: 'help' }}
                          />
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecommendations.map(item => {
                    const discount = getDiscountForRecommendation(item)
                    const receivedAtFormatted =
                      item.receivedAt && item.receivedAt.length > 0
                        ? formatDateTime(item.receivedAt, 'dd MMM yyyy')
                        : null
                    const receivedAtLabel =
                      receivedAtFormatted && receivedAtFormatted !== '-'
                        ? receivedAtFormatted
                        : null
                    const categoryKey =
                      item.categoryId !== undefined && item.categoryId !== null
                        ? item.categoryId.toString()
                        : null
                    const targetMarginPct = getTargetMarginPct(categoryKey) ?? 0
                    const targetMarginFraction = Math.min(0.99, Math.max(0, targetMarginPct / 100))

                    const floorFraction = Math.min(1, Math.max(0, item.floorPctOfCost))

                    // console.log("floor and margin: ", { floorFraction, targetMarginFraction })

                    const unitCost = item.unitCost ?? 0
                    const targetPrice =
                      unitCost === 0 || targetMarginFraction >= 0.99
                        ? 0
                        : unitCost / (1 - targetMarginFraction)

                    // const floorPrice = unitCost * floorFraction
                    const floorPrice = unitCost / (1 - floorFraction)

                    // console.log("target price and floor price", targetPrice.toFixed(2), floorPrice.toFixed)

                    const discountPrice = targetPrice * (1 - discount)
                    // const discountPrice = targetPrice * discount
                    const quantity = Number(item.qtyReceived ?? 0) || 0
                    const profitDeltaPerUnit = discountPrice - floorPrice

                    // console.log("profit delta per unit: ", profitDeltaPerUnit.toFixed(2))

                    const profitDelta =
                      quantity > 0 ? profitDeltaPerUnit * quantity : profitDeltaPerUnit

                    const actualMarginRatio =
                      // unitCost > 0 ? discountPrice / unitCost : null
                      unitCost > 0 ? (discountPrice - unitCost) / discountPrice : null

                    const profitColor =
                      profitDelta > 0
                        ? 'success.main'
                        : profitDelta < 0
                          ? 'error.main'
                          : 'warning.main'
                    const profitLabel =
                      profitDelta > 0
                        ? 'Profit vs floor'
                        : profitDelta < 0
                          ? 'Loss vs floor'
                          : 'At floor'
                    const profitValue =
                      Number.isFinite(profitDelta) && profitDelta !== 0
                        ? currencyFormatter.format(Math.abs(profitDelta))
                        : currencyFormatter.format(0)
                    const quantityLabel =
                      quantity > 0 ? ` (Qty ${profitFormatter.format(quantity)})` : ''
                    const marginText =
                      actualMarginRatio !== null
                        ? `Actual margin: ${currencyFormatter.format(actualMarginRatio * discountPrice * quantity)} (${(actualMarginRatio * 100).toFixed(1)}%)`
                        : 'Margin unavailable'
                    const isDecisionApplied = Boolean(
                      item.lotSaleDecisionId && item.lotSaleDecisionApplied,
                    )
                    const isReverting =
                      isDecisionApplied && revertingDecisionId === item.lotSaleDecisionId

                    return (
                      <TableRow key={`${item.productId}-${item.lotId}`}>
                        <TableCell sx={{ width: '25%' }}>{describeProduct(item)}</TableCell>
                        <TableCell align="right">
                          {currencyFormatter.format(item.unitCost ?? 0)}
                        </TableCell>
                        <TableCell align="right">
                          {currencyFormatter.format(item.listPrice ?? 0)}
                        </TableCell>
                        <TableCell>
                          <Typography>
                            {receivedAtLabel ? `${receivedAtLabel}` : `Lot ${item.lotId}`}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.daysToExpiry}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={Number((discount * 100).toFixed(2))}
                            onChange={handleDiscountOverrideChange(item)}
                            InputProps={{
                              inputProps: { min: 0, max: 100, step: 0.5 },
                              endAdornment: <InputAdornment position="end">%</InputAdornment>,
                            }}
                            sx={{ maxWidth: 140 }}
                          />
                          <Typography variant="caption" component="div" color={profitColor}>
                            {profitDelta === 0 ? (
                              <>
                                {`At floor price.`}
                                <br />
                                {marginText}
                              </>
                            ) : (
                              <>
                                {`${profitLabel}: ${profitValue}${quantityLabel}.`}
                                <br />
                                {marginText}
                              </>
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {Number.isFinite(floorPrice) && floorPrice > 0
                            ? `${currencyFormatter.format(floorPrice)} (${percentFormatter.format(
                                item.floorPctOfCost,
                              )})`
                            : percentFormatter.format(item.floorPctOfCost)}
                        </TableCell>
                        <TableCell align="right">
                          {isDecisionApplied ? (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              disabled={isReverting || revertDecisionMutation.isPending}
                              onClick={() => handleRevertDecision(item.lotSaleDecisionId)}
                            >
                              {isReverting ? 'Reverting...' : 'Applied'}
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={applyMutation.isPending}
                              onClick={() => openConfirmApplyDialog(item)}
                            >
                              Apply
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {!recommendationsQuery.isLoading && filteredRecommendations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography color="text.secondary">
                          {hasCategoryFilter
                            ? 'No markdowns match this category.'
                            : 'No markdowns required today.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {applyMutation.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {resolveErrorMessage(applyMutation.error, 'Failed to apply markdown.')}
                </Alert>
              )}
              {applyMutation.isSuccess && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Markdown applied. Effective price: {applyMutation.data.effectivePrice}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}

      {activeTab === 1 && (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Box>
                  <Typography variant="h6">Markdown rules</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Control discount levels globally or per category to protect margin.
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{ width: { xs: '100%', md: 'auto' } }}
                >
                  <TextField
                    select
                    size="small"
                    label="Category"
                    value={selectedGroupKey}
                    onChange={event => setSelectedGroupKey(event.target.value)}
                    sx={{ minWidth: 200 }}
                    helperText="Filter rules by scope"
                  >
                    {groupSelectOptions.map(option => (
                      <MenuItem key={option.key} value={option.key}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={openCreateRuleDialog}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    New rule
                  </Button>
                </Stack>
              </Stack>

              {rulesQuery.isFetching && <LinearProgress sx={{ mt: 2 }} />}

              {rulesQuery.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {resolveErrorMessage(rulesQuery.error, 'Unable to load markdown rules.')}
                </Alert>
              )}

              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Days to expiry</TableCell>
                    <TableCell>Discount</TableCell>
                    <TableCell>Floor % of import cost</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rulesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography color="text.secondary">Loading rules…</Typography>
                      </TableCell>
                    </TableRow>
                  ) : sortedRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Box py={3} textAlign="center">
                          <Typography variant="subtitle1">No markdown rules yet.</Typography>
                          <Typography color="text.secondary">
                            Start by defining a global rule, then add overrides for sensitive
                            categories.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleGroups.map(group => (
                      <Fragment key={group.key}>
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            sx={{ bgcolor: theme => theme.palette.action.hover }}
                          >
                            <Typography variant="subtitle2">{group.label}</Typography>
                          </TableCell>
                        </TableRow>
                        {group.rules.map(rule => (
                          <TableRow key={rule.id} hover>
                            <TableCell>D-{rule.daysToExpiry}</TableCell>
                            <TableCell>{percentFormatter.format(rule.discountPercent)}</TableCell>
                            <TableCell>
                              {percentFormatter.format(rule.floorPercentOfCost)}
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Edit rule">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditRuleDialog(rule)}
                                  aria-label="Edit markdown rule"
                                >
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete rule">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setRuleToDelete(rule)}
                                  aria-label="Delete markdown rule"
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Stack>
      )}

      <Dialog open={Boolean(pendingApply)} onClose={handleCancelApply}>
        <DialogTitle>Apply markdown</DialogTitle>
        <DialogContent>
          <Typography>
            {pendingApply
              ? `Apply ${percentFormatter.format(pendingApply.discount)} to ${describeProduct(pendingApply.item)} (Lot ${pendingApply.item.lotId})?`
              : ''}
          </Typography>
          {pendingApply?.requiresOverride && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {`This discount exceeds the floor guard. Floor allows ${
                pendingApply.item.floorSafeDiscountPct !== undefined &&
                pendingApply.item.floorSafeDiscountPct !== null
                  ? percentFormatter.format(pendingApply.item.floorSafeDiscountPct)
                  : 'a smaller discount'
              }.`}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelApply} disabled={applyMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmApply}
            variant="contained"
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? 'Applying...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingApplyAll)} onClose={handleCancelApplyAll}>
        <DialogTitle>Apply all markdowns</DialogTitle>
        <DialogContent>
          <Typography>
            {pendingApplyAll
              ? `Apply ${pendingApplyAll.total} markdown suggestions${
                  pendingApplyAll.overrides > 0
                    ? ` (${pendingApplyAll.overrides} require floor overrides)`
                    : ''
                }?`
              : ''}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelApplyAll} disabled={applyAllMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyAllConfirmed}
            variant="contained"
            disabled={applyAllMutation.isPending}
          >
            {applyAllMutation.isPending ? 'Applying...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ruleDialogState.open} onClose={closeRuleDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {ruleDialogState.mode === 'create' ? 'Create markdown rule' : 'Edit markdown rule'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" id="markdown-rule-form" onSubmit={handleRuleSubmit} mt={1}>
            <Stack spacing={2}>
              <Grid container spacing={2} sx={{ pr: 4 }}>
                <Grid item xs={12} md={6}>
                  <SingleSelectAutocomplete<ParentCategoryOption>
                    options={parentCategoryOptions}
                    value={ruleForm.parentCategory}
                    onChange={handleParentCategoryChange}
                    getOptionLabel={(option: ParentCategoryOption) => option?.label ?? ''}
                    isOptionEqualToValue={(
                      option: ParentCategoryOption,
                      value: ParentCategoryOption,
                    ) => option.key === value.key}
                    loading={categoriesQuery.isFetching}
                    fullWidth
                    clearOnEscape
                    renderInput={params => (
                      <TextField
                        {...params}
                        fullWidth
                        label="Category level 1"
                        placeholder="All parent categories"
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <SingleSelectAutocomplete<CategoryOption>
                    options={availableChildOptions}
                    value={ruleForm.childCategory}
                    onChange={handleChildCategoryChange}
                    getOptionLabel={(option: CategoryOption) => option.label}
                    isOptionEqualToValue={(option: CategoryOption, value: CategoryOption) =>
                      option.key === value.key
                    }
                    disabled={!ruleForm.parentCategory || availableChildOptions.length === 0}
                    fullWidth
                    renderInput={params => (
                      <TextField
                        {...params}
                        fullWidth
                        label="Category level 2"
                        placeholder={
                          ruleForm.parentCategory
                            ? 'All child categories'
                            : 'Select a level 1 category first'
                        }
                      />
                    )}
                  />
                </Grid>
              </Grid>
              <Typography variant="body2" color="text.secondary">
                Leave both pickers empty for a global rule, or select only level 1 to target the
                parent category.
              </Typography>
              <TextField
                label="Days before expiry (D-#)"
                type="number"
                value={ruleForm.daysToExpiry}
                onChange={handleRuleFieldChange('daysToExpiry')}
                InputProps={{ inputProps: { min: 0, max: 90 } }}
                required
              />
              <TextField
                label="Discount percentage"
                type="number"
                value={ruleForm.discountPercent}
                onChange={handleRuleFieldChange('discountPercent')}
                InputProps={{ inputProps: { min: 1, max: 100, step: 0.5 } }}
                helperText="How much off the list price should we target?"
                required
              />
              <TextField
                label="Floor (% of import cost)"
                type="number"
                value={floorInputValue}
                onChange={handleFloorPercentChange}
                InputProps={{ inputProps: { min: -100, max: 100, step: 0.5 } }}
                helperText="Prevent markdowns from going below this share of cost."
              />
              {selectedMinMarginPct !== null && (
                <Box sx={{ mt: 1 }}>
                  <Chip
                    color="error"
                    size="small"
                    label={`This category's minimum margin percent is ${selectedMinMarginPct.toFixed(1)}%`}
                  />
                </Box>
              )}
              {ruleMutationError && (
                <Alert severity="error">
                  {resolveErrorMessage(ruleMutationError, 'Unable to save markdown rule.')}
                </Alert>
              )}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRuleDialog}>Cancel</Button>
          <Button
            type="submit"
            form="markdown-rule-form"
            variant="contained"
            disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
          >
            {ruleDialogState.mode === 'create' ? 'Create rule' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingLossSubmission)} onClose={handleLossWarningCancel}>
        <DialogTitle>Sell at a loss?</DialogTitle>
        <DialogContent>
          <Typography>
            {`You're about to set a floor of ${pendingLossPercent.toFixed(
              1,
            )}% of import cost, which means selling below your cost basis.`}
          </Typography>
          <Typography sx={{ mt: 1 }} color="text.secondary">
            Are you sure you want to continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLossWarningCancel}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleLossWarningConfirm}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(ruleToDelete)} onClose={() => setRuleToDelete(null)}>
        <DialogTitle>Delete markdown rule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the rule for{' '}
            <strong>{ruleToDelete?.categoryName ?? 'all categories'}</strong> at D-
            {ruleToDelete?.daysToExpiry}?
          </Typography>
          {deleteRuleMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {resolveErrorMessage(deleteRuleMutation.error, 'Failed to delete rule.')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleToDelete(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteRule}
            disabled={deleteRuleMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default MarkdownsPage
