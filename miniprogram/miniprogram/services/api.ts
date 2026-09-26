import { API_BASE_URL, STORAGE_KEYS } from './config'
import { stopRealtime } from './realtime'
import type {
  DishResponse,
  FamilyResponse,
  MemberResponse,
  OrderResponse
} from './models'

export interface ApiErrorBody {
  detail?: string
  title?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: WechatMiniprogram.IAnyObject | string | ArrayBuffer
  query?: Record<string, string | number | boolean | undefined>
  skipAuth?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const search = query
    ? Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')
    : ''
  return `${API_BASE_URL}${path}${search ? `?${search}` : ''}`
}

function getErrorMessage(data: unknown, statusCode: number): string {
  if (typeof data === 'object' && data !== null) {
    const body = data as ApiErrorBody
    if (body.detail) return body.detail
    if (body.title) return body.title
    if (body.errors) {
      const first = Object.values(body.errors).flat()[0]
      if (first) return first
    }
  }
  return statusCode ? `请求失败（${statusCode}）` : '网络请求失败，请检查网络连接'
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = wx.getStorageSync(STORAGE_KEYS.token) as string | undefined
  const header: Record<string, string> = {
    Accept: 'application/json'
  }
  if (options.data !== undefined) {
    header['Content-Type'] = 'application/json'
  }
  if (token && !options.skipAuth) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: buildUrl(path, options.query),
      method: options.method ?? 'GET',
      data: options.data,
      header,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.statusCode === 204 ? (undefined as T) : response.data as T)
          return
        }
        if (response.statusCode === 401) {
          wx.removeStorageSync(STORAGE_KEYS.token)
          wx.removeStorageSync(STORAGE_KEYS.user)
          void stopRealtime()
        }
        reject(new ApiError(getErrorMessage(response.data, response.statusCode), response.statusCode))
      },
      fail: (error) => reject(new ApiError(error.errMsg || '网络请求失败', 0))
    })
  })
}

export function getFamily(): Promise<FamilyResponse> {
  return request<FamilyResponse>('/family')
}

export async function getFamilyOrNull(): Promise<FamilyResponse | null> {
  try {
    return await getFamily()
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) return null
    throw error
  }
}

export function getMembers(): Promise<MemberResponse[]> {
  return request<MemberResponse[]>('/family/members')
}

export function createFamily(name?: string): Promise<FamilyResponse> {
  return request<FamilyResponse>('/family/create', {
    method: 'POST',
    data: { name: name?.trim() || undefined }
  })
}

export function joinFamily(inviteCode: string): Promise<FamilyResponse> {
  return request<FamilyResponse>('/family/join', {
    method: 'POST',
    data: { inviteCode: inviteCode.trim().toUpperCase() }
  })
}

export function listDishes(query: { category?: string; search?: string; favorite?: boolean } = {}): Promise<DishResponse[]> {
  return request<DishResponse[]>('/dishes', { query })
}

export function createDish(data: { name: string; category?: string; remark?: string }): Promise<DishResponse> {
  return request<DishResponse>('/dishes', { method: 'POST', data })
}

export function updateDish(id: number, data: { name: string; category?: string; remark?: string; isFavorite?: boolean }): Promise<DishResponse> {
  return request<DishResponse>(`/dishes/${id}`, { method: 'PUT', data })
}

export function toggleFavorite(id: number): Promise<DishResponse> {
  return request<DishResponse>(`/dishes/${id}/favorite`, { method: 'PUT' })
}

export function getTodayOrder(): Promise<OrderResponse> {
  return request<OrderResponse>('/orders/today')
}

export function addOrderItem(dishId: number, quantity = 1): Promise<OrderResponse> {
  return request<OrderResponse>('/orders/items', {
    method: 'POST',
    data: { dishId, quantity }
  })
}

export function updateOrderItem(id: number, data: { quantity?: number; status?: string }): Promise<OrderResponse> {
  return request<OrderResponse>(`/orders/items/${id}`, { method: 'PUT', data })
}

export function deleteOrderItem(id: number): Promise<void> {
  return request<void>(`/orders/items/${id}`, { method: 'DELETE' })
}

export function clearTodayOrder(): Promise<void> {
  return request<void>('/orders/clear', { method: 'POST' })
}

export function getOrderHistory(): Promise<OrderResponse[]> {
  return request<OrderResponse[]>('/orders/history')
}
