import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAdminAuth } from '../contexts/useAdminAuth'

export default function OwnerRoute({ children }: { children: ReactNode }) {
  const { isOwner } = useAdminAuth()
  return isOwner ? children : <Navigate to="/" replace />
}
