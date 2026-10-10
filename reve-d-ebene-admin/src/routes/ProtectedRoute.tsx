import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { ErrorState, LoadingState } from '../components/FeedbackStates'
import { useAdminAuth } from '../contexts/useAdminAuth'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { status, message, refresh } = useAdminAuth()

  if (status === 'loading') {
    return <LoadingState fullPage label="Vérification de votre accès…" />
  }

  if (status === 'error') {
    return (
      <ErrorState
        fullPage
        title="Accès impossible à vérifier"
        message={message ?? 'Une erreur réseau empêche la vérification de vos droits.'}
        onRetry={() => void refresh()}
      />
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname, message }} />
  }

  return children
}
