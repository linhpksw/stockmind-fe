import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { listProducts } from '../api/products'
import type { CategoryMetaEntry } from './useCategoryFilters'

export const useProductCategoryMap = (categoryMeta: Map<string, CategoryMetaEntry>) => {
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
    staleTime: 60 * 1000,
  })

  const productCategoryMap = useMemo(() => {
    const map = new Map<number, CategoryMetaEntry>()
    if (!productsQuery.data || categoryMeta.size === 0) {
      return map
    }

    productsQuery.data.forEach(product => {
      const numericId = Number(product.id)
      if (Number.isNaN(numericId)) {
        return
      }
      const normalizedCategoryId = product.categoryId?.trim()
      if (normalizedCategoryId && categoryMeta.has(normalizedCategoryId)) {
        map.set(numericId, categoryMeta.get(normalizedCategoryId)!)
      }
    })

    return map
  }, [productsQuery.data, categoryMeta])

  return {
    productCategoryMap,
    isLoading: productsQuery.isLoading,
    isError: productsQuery.isError,
  }
}
