export interface CategoryNode {
  categoryId: number
  code: string
  name: string
  parentCategoryId?: number | null
  children: CategoryNode[]
}

export interface CategoryImportRow {
  categoryId?: number | null
  code: string
  name: string
  parentCode?: string | null
  parentCategoryId?: number | null
}

export interface ImportCategoriesRequest {
  rows: CategoryImportRow[]
}

export interface ImportCategoriesResponse {
  created: number
  updated: number
  skippedMissingParent: number
  skippedInvalid: number
  total: number
}
