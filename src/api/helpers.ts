import type { ApiResponse, PageResponse } from '../types/common'

export const unwrap = <T>(response: ApiResponse<T>): T => response.data

export const unwrapPage = <T>(response: PageResponse<T>) => response
