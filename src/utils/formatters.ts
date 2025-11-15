import { format, parseISO } from 'date-fns'

export const formatCurrency = (value: number, currency = 'VND') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)

const VIETNAM_OFFSET_MINUTES = 7 * 60

const convertToVietnamTime = (date: Date): Date => {
  const utcMillis = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utcMillis + VIETNAM_OFFSET_MINUTES * 60000)
}

export const formatDateTime = (value?: string | null, pattern = 'dd MMM yyyy HH:mm') => {
  if (!value) {
    return '-'
  }

  try {
    const vietnamDate = convertToVietnamTime(parseISO(value))
    return format(vietnamDate, pattern)
  } catch {
    return value
  }
}
