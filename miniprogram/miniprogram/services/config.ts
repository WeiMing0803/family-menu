/**
 * 本地联调配置：
 * - development：使用后端 Development 环境允许的 openId，不依赖微信 AppSecret。
 * - wechat：调用 wx.login，把 code 交给后端换取 openid。上线前必须使用该模式。
 */
export const API_BASE_URL = 'http://192.168.1.95:5080/api'
export const LOGIN_MODE: 'development' | 'wechat' = 'development'
/** development 模式下可切换的测试身份：两台手机各选一个，即可模拟两位家庭成员。 */
export const DEVELOPMENT_IDENTITIES = [
  { openId: 'local-user-a', nickName: '测试用户 A' },
  { openId: 'local-user-b', nickName: '测试用户 B' }
] as const

export const STORAGE_KEYS = {
  token: 'family-menu-token',
  user: 'family-menu-user',
  devOpenId: 'family-menu-dev-openid',
  devNickName: 'family-menu-dev-nickname'
} as const
