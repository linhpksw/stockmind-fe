export interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

export interface PageResponse<T> {
  code: string
  message: string
  pageSize: number
  pageNum: number
  total: number
  data: T[]
}

export interface SelectOption {
  label: string
  value: string | number
}
