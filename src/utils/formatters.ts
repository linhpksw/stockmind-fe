import { formatInTimeZone } from 'date-fns-tz'

export const formatCurrency = (value: number, currency = 'VND') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const ensureUtcIsoString = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return trimmed
  }
  // If value already has an offset (Z or +/-hh:mm), trust it as-is.
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }
  // Treat bare timestamps from the API as UTC.
  return `${trimmed}Z`
}

export const formatDateTime = (value?: string | null, pattern = 'dd MMM yyyy HH:mm') => {
  if (!value) {
    return '-'
  }

  try {
    const normalized = ensureUtcIsoString(value)
    return formatInTimeZone(normalized, VIETNAM_TIME_ZONE, pattern)
  } catch {
    return value
  }
}
