const REPLENISHMENT_PREFILL_STORAGE_KEY = 'po-replenishment-prefill'

export type ReplenishmentPrefillPayload = {
  productId: string | number
  suggestedQty: number
}

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

export const setReplenishmentPrefill = (payload: ReplenishmentPrefillPayload) => {
  if (!isBrowser()) {
    return
  }
  try {
    window.sessionStorage.setItem(
      REPLENISHMENT_PREFILL_STORAGE_KEY,
      JSON.stringify({
        productId: payload.productId,
        suggestedQty: payload.suggestedQty,
      }),
    )
  } catch {
    // ignore storage failures
  }
}

export const consumeReplenishmentPrefill = (): ReplenishmentPrefillPayload | null => {
  if (!isBrowser()) {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(REPLENISHMENT_PREFILL_STORAGE_KEY)
    if (!raw) {
      return null
    }
    window.sessionStorage.removeItem(REPLENISHMENT_PREFILL_STORAGE_KEY)
    const parsed = JSON.parse(raw) as ReplenishmentPrefillPayload
    if (
      !parsed ||
      (typeof parsed.productId !== 'string' && typeof parsed.productId !== 'number') ||
      typeof parsed.suggestedQty !== 'number'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
