export type AdminRole = 'owner' | 'admin'
export type AdminStatus = 'owner' | 'active' | 'expired' | 'disabled'
export type AdminAccessType = 'unlimited' | 'temporary'

export type AdminUser = {
  user_id: string
  email: string
  role: AdminRole
  is_active: boolean
  expires_at: string | null
  created_at: string
  created_by: string | null
  updated_at: string
  access_status: AdminStatus
}

export type InviteAdminInput = {
  email: string
  accessType: AdminAccessType
  expiresAt: string | null
}

export type UpdateAdminInput = {
  userId: string
  accessType: AdminAccessType
  expiresAt: string | null
  isActive: boolean
}
