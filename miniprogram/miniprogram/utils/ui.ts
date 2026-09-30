import { ApiError } from '../services/api'

/** Vant 组件事件：detail 直接是值（字符串、布尔或对象），不满足 CustomEvent 的对象约束。 */
export type DetailEvent<T> = { detail: T }

const PRIMARY = '#3f8f62'
const DANGER = '#c8553d'

export function confirmAction(title: string, content: string, options: { confirmText?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      confirmText: options.confirmText || '确定',
      confirmColor: options.danger ? DANGER : PRIMARY,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false)
    })
  })
}

export function promptText(title: string, value: string, placeholder: string): Promise<string | null> {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      editable: true,
      placeholderText: placeholder,
      content: value,
      confirmColor: PRIMARY,
      success: (result) => resolve(result.confirm ? (result.content || '') : null),
      fail: () => resolve(null)
    })
  })
}

export function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 401
}

export function toast(title: string, icon: 'success' | 'none' = 'none'): void {
  wx.showToast({ title, icon })
}

/** 头像上显示的一个字：以字母或数字结尾的名字（如“测试用户 A”）取末位，其余取首字。 */
export function nameInitial(name: string): string {
  const trimmed = (name || '').trim()
  return /[A-Za-z0-9]$/.test(trimmed) ? trimmed.slice(-1).toUpperCase() : trimmed.slice(0, 1)
}
