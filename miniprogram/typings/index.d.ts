/// <reference path="./types/index.d.ts" />

import type { FamilyResponse, UserResponse } from '../miniprogram/services/models'

declare global {
  interface IAppOption {
    globalData: {
      userInfo?: WechatMiniprogram.UserInfo
      user?: UserResponse
      family?: FamilyResponse | null
    }
    userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback
  }
}

export {}
