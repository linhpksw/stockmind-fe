import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchCategories } from '../api/categories'
import type { CategoryNode } from '../types/categories'
import type { CategoryOption } from '../utils/categories'

export interface ParentCategoryOption {
  key: string
  label: string
}

export interface CategoryMetaEntry {
  option: CategoryOption
  parentKey: string
}

interface CategoryFilterState {
  parentCategoryOptions: ParentCategoryOption[]
  childCategoryLookup: Map<string, CategoryOption[]>
  childCategoryOptions: CategoryOption[]
  categoryMeta: Map<string, CategoryMetaEntry>
}

const EXCLUDED_CATEGORY_NAMES = new Set(['giá siêu rẻ', 'giá hội viên', 'ưu đãi hội viên'])

const isExcludedCategoryName = (value?: string | null): boolean =>
  value ? EXCLUDED_CATEGORY_NAMES.has(value.trim().toLowerCase()) : false

const buildCategoryFilterState = (nodes: CategoryNode[] = []): CategoryFilterState => {
  if (!nodes || nodes.length === 0) {
    return {
      parentCategoryOptions: [],
      childCategoryLookup: new Map(),
      childCategoryOptions: [],
      categoryMeta: new Map(),
    }
  }

  const parentOptions: ParentCategoryOption[] = []
  const childLookup = new Map<string, CategoryOption[]>()
  const meta = new Map<string, CategoryMetaEntry>()

  const sortedParents = nodes.slice().sort((a, b) => a.name.localeCompare(b.name))
  sortedParents.forEach(parent => {
    if (isExcludedCategoryName(parent.name)) {
      return
    }
    const parentKey = String(parent.categoryId)
    const parentLabel = parent.name.trim()
    parentOptions.push({ key: parentKey, label: parentLabel })
    const parentOption: CategoryOption = {
      key: parentKey,
      parent: parentLabel,
      child: parentLabel,
      label: parentLabel,
    }
    meta.set(parentKey, { option: parentOption, parentKey })

    const children = parent.children ?? []
    const childOptions: CategoryOption[] = []
    children
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(child => {
        if (isExcludedCategoryName(child.name)) {
          return
        }
        const childKey = String(child.categoryId)
        const childLabel = child.name.trim()
        const option: CategoryOption = {
          key: childKey,
          parent: parentLabel,
          child: childLabel,
          label: `${parentLabel} › ${childLabel}`,
        }
        childOptions.push(option)
        meta.set(childKey, { option, parentKey })
      })

    if (childOptions.length > 0) {
      childLookup.set(parentKey, childOptions)
    }
  })

  const childOptions = Array.from(childLookup.values())
    .flat()
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    parentCategoryOptions: parentOptions,
    childCategoryLookup: childLookup,
    childCategoryOptions: childOptions,
    categoryMeta: meta,
  }
}

export const useCategoryFilters = () => {
  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  })

  const filterState = useMemo(
    () => buildCategoryFilterState(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  )

  return {
    ...filterState,
    isLoading: categoriesQuery.isLoading,
    isError: categoriesQuery.isError,
  }
}

export type { CategoryFilterState }
