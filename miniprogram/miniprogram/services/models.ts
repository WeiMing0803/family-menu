export interface UserResponse {
  id: number
  nickName: string
  avatarUrl?: string | null
  familyId?: number | null
  createdAt: string
  /** 微信登录的新用户还没有设置昵称，仍是默认的「家庭成员」 */
  needsNickName: boolean
}

export interface AuthResponse {
  token: string
  expiresAt: string
  user: UserResponse
}

export interface FamilyResponse {
  id: number
  name: string
  inviteCode: string
  createdAt: string
  memberCount: number
  maxMembers: number
}

export interface MemberResponse {
  id: number
  nickName: string
  avatarUrl?: string | null
  createdAt: string
}

export interface DishResponse {
  id: number
  name: string
  category: string
  remark?: string | null
  imageUrl?: string | null
  isFavorite: boolean
  createdBy: number
  createdAt: string
  updatedAt: string
}

export type OrderItemStatus = 'Pending' | 'Done' | 'Cancelled'

export interface OrderItemResponse {
  id: number
  dishId: number
  dishName: string
  category: string
  quantity: number
  remark?: string | null
  status: OrderItemStatus | string
  addedBy: number
  createdAt: string
}

export interface DishStatResponse {
  dishId: number
  dishName: string
  category: string
  times: number
}

export interface OrderResponse {
  id?: number | null
  orderDate: string
  status: string
  createdAt?: string | null
  items: OrderItemResponse[]
}
