import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

export type AdminAuthValue = {
  status: AuthStatus
  user: User | null
  isOwner: boolean
  message: string | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

export const AdminAuthContext = createContext<AdminAuthValue | null>(null)
