/**
 * 本地联调配置：
 * - development：使用后端 Development 环境允许的 openId，不依赖微信 AppSecret。
 * - wechat：调用 wx.login，把 code 交给后端换取 openid。上线前必须使用该模式。
 */
export const API_BASE_URL = 'http://localhost:5080/api'
export const LOGIN_MODE: 'development' | 'wechat' = 'development'
export const DEVELOPMENT_OPEN_ID = 'local-user-a'
export const DEVELOPMENT_NICKNAME = '本地用户'

export const STORAGE_KEYS = {
  token: 'family-menu-token',
  user: 'family-menu-user',
  devOpenId: 'family-menu-dev-openid'
} as const
