import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Autocomplete from '@mui/material/Autocomplete'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Grid,
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
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type SyntheticEvent,
} from 'react'
import {
  applyMarkdown,
  createMarkdownRule,
  deleteMarkdownRule,
  getMarkdownRecommendations,
  listMarkdownRules,
  updateMarkdownRule,
} from '../api/markdowns'
import { fetchCategories } from '../api/categories'
import { SectionHeading } from '../components/common/SectionHeading'
import type { CategoryNode } from '../types/categories'
import type { CategoryOption } from '../utils/categories'
import type { MarkdownRule, UpsertMarkdownRuleRequest } from '../types/markdowns'

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

const fractionToPercent = (value?: number, fallback = 0): number =>
  Number(((value ?? fallback) * 100).toFixed(2))

const clampPercent = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, value))
}

const percentToFraction = (value: number): number => Number((clampPercent(value) / 100).toFixed(4))

const resolveErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

export const MarkdownsPage = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [days, setDays] = useState(3)
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
  const [ruleToDelete, setRuleToDelete] = useState<MarkdownRule | null>(null)
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

  const rulesQuery = useQuery({
    queryKey: ['markdown-rules'],
    queryFn: listMarkdownRules,
  })

  const categoriesQuery = useQuery({
    queryKey: ['markdown-rule-categories'],
    queryFn: fetchCategories,
    enabled: activeTab === 1 || ruleDialogState.open,
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

  const percentFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }),
    [],
  )

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
    setRuleForm(prev => ({
      ...prev,
      parentCategory: option,
      childCategory: null,
    }))
  }

  const handleChildCategoryChange = (
    _event: SyntheticEvent<Element, Event>,
    option: CategoryOption | null,
  ) => {
    setRuleForm(prev => ({
      ...prev,
      childCategory: option ?? null,
    }))
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
      floorPercentOfCost: percentToFraction(ruleForm.floorPercentOfCost),
    }

    if (ruleDialogState.mode === 'edit' && ruleDialogState.rule) {
      updateRuleMutation.mutate({ ruleId: ruleDialogState.rule.id, payload })
    } else {
      createRuleMutation.mutate(payload)
    }
  }

  const handleDeleteRule = () => {
    if (!ruleToDelete) {
      return
    }
    deleteRuleMutation.mutate(ruleToDelete.id)
  }

  const ruleMutationError = createRuleMutation.error ?? updateRuleMutation.error

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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <TextField
                  label="Days to expiry"
                  type="number"
                  value={days}
                  onChange={handleDaysChange}
                  InputProps={{ inputProps: { min: 1, max: 30 } }}
                />
                <Button variant="contained" onClick={() => recommendationsQuery.refetch()}>
                  Refresh
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {recommendationsQuery.isError && (
            <Alert severity="error">Failed to load recommendations.</Alert>
          )}

          <Card>
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Lot</TableCell>
                    <TableCell>Days to expiry</TableCell>
                    <TableCell>Suggested discount</TableCell>
                    <TableCell>Floor % of cost</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recommendationsQuery.data?.map(item => (
                    <TableRow key={`${item.productId}-${item.lotId}`}>
                      <TableCell>{item.productId}</TableCell>
                      <TableCell>{item.lotId}</TableCell>
                      <TableCell>{item.daysToExpiry}</TableCell>
                      <TableCell>{(item.suggestedDiscountPct * 100).toFixed(0)}%</TableCell>
                      <TableCell>{(item.floorPctOfCost * 100).toFixed(0)}%</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            applyMutation.mutate({
                              productId: item.productId,
                              lotId: item.lotId,
                              discountPct: item.suggestedDiscountPct,
                              overrideFloor: false,
                            })
                          }
                        >
                          Apply
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recommendationsQuery.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="text.secondary">No markdowns required today.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {applyMutation.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {applyMutation.error instanceof Error
                    ? applyMutation.error.message
                    : 'Failed to apply markdown.'}
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
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateRuleDialog}>
                  New rule
                </Button>
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
                    <TableCell>Scope</TableCell>
                    <TableCell>Days to expiry</TableCell>
                    <TableCell>Discount</TableCell>
                    <TableCell>Floor % of cost</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rulesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography color="text.secondary">Loading rules…</Typography>
                      </TableCell>
                    </TableRow>
                  ) : sortedRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
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
                    sortedRules.map(rule => (
                      <TableRow key={rule.id} hover>
                        <TableCell>{rule.categoryName ?? 'All categories'}</TableCell>
                        <TableCell>D-{rule.daysToExpiry}</TableCell>
                        <TableCell>{percentFormatter.format(rule.discountPercent)}</TableCell>
                        <TableCell>{percentFormatter.format(rule.floorPercentOfCost)}</TableCell>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Stack>
      )}

      <Dialog open={ruleDialogState.open} onClose={closeRuleDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {ruleDialogState.mode === 'create' ? 'Create markdown rule' : 'Edit markdown rule'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" id="markdown-rule-form" onSubmit={handleRuleSubmit} mt={1}>
            <Stack spacing={2}>
              <Grid container spacing={2} sx={{ pr: 4 }}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={parentCategoryOptions}
                    value={ruleForm.parentCategory}
                    onChange={handleParentCategoryChange}
                    getOptionLabel={option => option?.label ?? ''}
                    isOptionEqualToValue={(option, value) => option.key === value.key}
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
                  <Autocomplete
                    options={availableChildOptions}
                    value={ruleForm.childCategory}
                    onChange={handleChildCategoryChange}
                    getOptionLabel={option => option.label}
                    isOptionEqualToValue={(option, value) => option.key === value.key}
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
                label="Floor (% of cost)"
                type="number"
                value={ruleForm.floorPercentOfCost}
                onChange={handleRuleFieldChange('floorPercentOfCost')}
                InputProps={{ inputProps: { min: 0, max: 100, step: 0.5 } }}
                helperText="Prevent markdowns from going below this share of cost."
              />
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
