import { format, parseISO } from 'date-fns'

export const formatCurrency = (value: number, currency = 'VND') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)

export const formatDateTime = (value?: string | null, pattern = 'dd MMM yyyy HH:mm') => {
  if (!value) {
    return '-'
  }

  try {
    return format(parseISO(value), pattern)
  } catch {
    return value
  }
}
