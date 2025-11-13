export interface CategoryOption {
  key: string
  parent: string
  child: string
  label: string
}

export const UNCATEGORIZED_CATEGORY: CategoryOption = {
  key: 'uncategorized',
  parent: 'Uncategorized',
  child: 'General',
  label: 'Uncategorized › General',
}

const CATEGORY_DELIMITERS = ['/', '>', '|', ':']

export const resolveCategory = (rawCategoryId?: string | null): CategoryOption => {
  if (!rawCategoryId || !rawCategoryId.trim()) {
    return UNCATEGORIZED_CATEGORY
  }

  const sanitized = rawCategoryId.trim()
  const delimiter = CATEGORY_DELIMITERS.find(symbol => sanitized.includes(symbol))
  const parts = (delimiter ? sanitized.split(delimiter) : [sanitized])
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    const [parent, ...children] = parts
    const child = children.join(' / ') || parent
    return {
      key: sanitized,
      parent,
      child,
      label: `${parent} › ${child}`,
    }
  }

  const childLabel = parts[0]
  return {
    key: sanitized,
    parent: 'General',
    child: childLabel,
    label: `General › ${childLabel}`,
  }
}
