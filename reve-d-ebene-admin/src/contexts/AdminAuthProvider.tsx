import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useLocation } from 'react-router-dom'

import { supabase } from '../lib/supabase'
import {
  ADMIN_ACCESS_RECHECK_EVENT,
  getAccessDeniedMessage,
  getAdminAccess,
  signOutSession,
} from '../services/adminAuth'
import { AdminAuthContext } from './AdminAuthContext'
import type { AuthStatus } from './AdminAuthContext'
import { clearDashboardDataCache } from '../services/dashboardCache'

type Props = {
  children: ReactNode
}

export default function AdminAuthProvider({ children }: Props) {
  const location = useLocation()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const verificationId = useRef(0)
  const verifiedUserId = useRef<string | null>(null)
  const signOutIntent = useRef<'explicit' | 'access-loss' | null>(null)

  const verify = useCallback(async (session: Session | null) => {
    const currentId = ++verificationId.current

    if (!session) {
      verifiedUserId.current = null
      clearDashboardDataCache()
      setUser(null)
      setIsOwner(false)
      setMessage(null)
      setStatus('unauthenticated')
      return
    }

    const alreadyAuthenticated = verifiedUserId.current === session.user.id
    if (!alreadyAuthenticated) setStatus('loading')
    setMessage(null)

    try {
      const access = await getAdminAccess(session)
      if (currentId !== verificationId.current) return

      if (!access.isAdmin) {
        verifiedUserId.current = null
        clearDashboardDataCache()
        setUser(null)
        setIsOwner(false)
        setMessage(getAccessDeniedMessage(access.status))
        setStatus('unauthenticated')
        signOutIntent.current = 'access-loss'
        await signOutSession()
        return
      }

      verifiedUserId.current = session.user.id
      setUser(session.user)
      setIsOwner(access.isOwner)
      setStatus('authenticated')
    } catch {
      if (currentId !== verificationId.current) return
      verifiedUserId.current = null
      clearDashboardDataCache()
      setUser(null)
      setIsOwner(false)
      setMessage("Impossible de vérifier les droits d'administration. Vérifiez votre connexion.")
      setStatus('error')
    }
  }, [])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      verificationId.current += 1
      verifiedUserId.current = null
      clearDashboardDataCache()
      setUser(null)
      setIsOwner(false)
      setMessage('Votre session a été invalidée. Veuillez vous reconnecter.')
      setStatus('unauthenticated')
      signOutIntent.current = 'access-loss'
      await signOutSession()
      return
    }
    await verify(data.session)
  }, [verify])

  const logout = useCallback(async () => {
    verificationId.current += 1
    verifiedUserId.current = null
    clearDashboardDataCache()
    setMessage(null)
    signOutIntent.current = 'explicit'
    await signOutSession()
    setUser(null)
    setIsOwner(false)
    setStatus('unauthenticated')
  }, [])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        const intent = signOutIntent.current
        signOutIntent.current = null
        verificationId.current += 1
        verifiedUserId.current = null
        clearDashboardDataCache()
        setUser(null)
        setIsOwner(false)
        if (intent !== 'explicit') {
          setMessage((current) => current ?? 'Votre session a été invalidée. Veuillez vous reconnecter.')
        }
        setStatus('unauthenticated')
        return
      }

      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        window.setTimeout(() => void verify(session), 0)
      }
    })

    return () => subscription.unsubscribe()
  }, [verify])

  useEffect(() => {
    if (status !== 'authenticated') return

    const recheckAccess = () => {
      void refresh()
    }
    const handleProtectedRequestFailure = () => {
      clearDashboardDataCache()
      setStatus('loading')
      void refresh()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') recheckAccess()
    }
    const interval = window.setInterval(recheckAccess, 15_000)

    window.addEventListener('focus', recheckAccess)
    window.addEventListener(ADMIN_ACCESS_RECHECK_EVENT, handleProtectedRequestFailure)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', recheckAccess)
      window.removeEventListener(ADMIN_ACCESS_RECHECK_EVENT, handleProtectedRequestFailure)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh, status])

  useEffect(() => {
    if (status !== 'authenticated') return

    const timeout = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [location.hash, location.pathname, refresh, status])

  return (
    <AdminAuthContext.Provider value={{ status, user, isOwner, message, refresh, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}
