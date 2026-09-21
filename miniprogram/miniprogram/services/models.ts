export interface UserResponse {
  id: number
  nickName: string
  avatarUrl?: string | null
  familyId?: number | null
  createdAt: string
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

export interface OrderItemResponse {
  id: number
  dishId: number
  dishName: string
  category: string
  quantity: number
  remark?: string | null
  status: 'Pending' | 'Done' | 'Cancelled' | string
  addedBy: number
  createdAt: string
}

export interface OrderResponse {
  id?: number | null
  orderDate: string
  status: string
  createdAt?: string | null
  items: OrderItemResponse[]
}
