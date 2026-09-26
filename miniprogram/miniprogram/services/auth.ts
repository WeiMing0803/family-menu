import { DEVELOPMENT_NICKNAME, DEVELOPMENT_OPEN_ID, LOGIN_MODE, STORAGE_KEYS } from './config'
import { request } from './api'
import type { AuthResponse } from './models'
import { stopRealtime } from './realtime'

function getLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (result) => result.code ? resolve(result.code) : reject(new Error('微信登录未返回 code')),
      fail: reject
    })
  })
}

function getStoredAuth(): AuthResponse | null {
  const token = wx.getStorageSync(STORAGE_KEYS.token) as string | undefined
  const user = wx.getStorageSync(STORAGE_KEYS.user) as AuthResponse['user'] | undefined
  return token && user ? { token, user, expiresAt: '' } : null
}

export async function login(force = false): Promise<AuthResponse> {
  if (!force) {
    const stored = getStoredAuth()
    if (stored) return stored
  }

  const data = LOGIN_MODE === 'development'
    ? {
        openId: (wx.getStorageSync(STORAGE_KEYS.devOpenId) as string | undefined) || DEVELOPMENT_OPEN_ID,
        nickName: DEVELOPMENT_NICKNAME
      }
    : {
        code: await getLoginCode()
      }

  const result = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    data,
    skipAuth: true
  })
  wx.setStorageSync(STORAGE_KEYS.token, result.token)
  wx.setStorageSync(STORAGE_KEYS.user, result.user)
  return result
}

export function logout(): void {
  void stopRealtime()
  wx.removeStorageSync(STORAGE_KEYS.token)
  wx.removeStorageSync(STORAGE_KEYS.user)
}
