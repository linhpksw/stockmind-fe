import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllSuppliers } from '../api/suppliers'

const SUPPLIER_OPTIONS_QUERY_KEY = ['suppliers', 'options'] as const

export const useSupplierOptions = () => {
  const query = useQuery({
    queryKey: SUPPLIER_OPTIONS_QUERY_KEY,
    queryFn: () => fetchAllSuppliers(),
    staleTime: 5 * 60 * 1000,
  })

  const supplierOptions = useMemo(() => {
    if (!query.data) {
      return []
    }

    const uniqueNames = new Map<string, string>()
    query.data.forEach(supplier => {
      const name = supplier.name.trim()
      if (name) {
        uniqueNames.set(name, name)
      }
    })

    return Array.from(uniqueNames.values()).sort((a, b) => a.localeCompare(b))
  }, [query.data])

  return {
    suppliers: query.data ?? [],
    supplierOptions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
