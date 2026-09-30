import { LOGIN_MODE, STORAGE_KEYS } from './config'
import { ApiError, request } from './api'
import type { AuthResponse } from './models'
import { stopRealtime } from './realtime'

export interface DevelopmentIdentity {
  openId: string
  nickName: string
}

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

export function getDevelopmentIdentity(): DevelopmentIdentity | null {
  const openId = wx.getStorageSync(STORAGE_KEYS.devOpenId) as string | undefined
  const nickName = wx.getStorageSync(STORAGE_KEYS.devNickName) as string | undefined
  return openId ? { openId, nickName: nickName || openId } : null
}

export function setDevelopmentIdentity(identity: DevelopmentIdentity): void {
  wx.setStorageSync(STORAGE_KEYS.devOpenId, identity.openId)
  wx.setStorageSync(STORAGE_KEYS.devNickName, identity.nickName)
}

export async function login(force = false): Promise<AuthResponse> {
  if (!force) {
    const stored = getStoredAuth()
    if (stored) return stored
  }

  let data: WechatMiniprogram.IAnyObject
  if (LOGIN_MODE === 'development') {
    // 不再静默使用默认身份，否则每台设备都会登录成同一个用户；交给登录页选择。
    const identity = getDevelopmentIdentity()
    if (!identity) throw new ApiError('请先选择测试身份', 401)
    data = { openId: identity.openId, nickName: identity.nickName }
  } else {
    data = { code: await getLoginCode() }
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
