import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { ADMIN_ACCESS_RECHECK_EVENT } from '../services/adminAuth'
import {
  clearDashboardDataCache,
  getCachedDashboardData,
  readDashboardDataCache,
  refreshDashboardData,
} from '../services/dashboardCache'
import type { DashboardData } from '../types/survey'
import { DashboardDataContext } from './DashboardDataContext'

const LOAD_ERROR = 'Les données Supabase ne peuvent pas être chargées. Vérifiez votre connexion et vos droits.'
export default function DashboardDataProvider({ children }: { children: ReactNode }) {
  const cachedData = readDashboardDataCache()
  const [data, setData] = useState<DashboardData | null>(cachedData)
  const [loading, setLoading] = useState(!cachedData)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    getCachedDashboardData()
      .then((dashboardData) => {
        if (mounted.current) setData(dashboardData)
      })
      .catch(() => {
        if (mounted.current) setError(LOAD_ERROR)
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })

    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const clearProtectedData = () => {
      clearDashboardDataCache()
      setData(null)
      setError('')
      setLoading(true)
      setRefreshing(false)
    }

    window.addEventListener(ADMIN_ACCESS_RECHECK_EVENT, clearProtectedData)
    return () => window.removeEventListener(ADMIN_ACCESS_RECHECK_EVENT, clearProtectedData)
  }, [])

  const refresh = useCallback(async () => {
    setError('')
    if (data) setRefreshing(true)
    else setLoading(true)

    try {
      const dashboardData = await refreshDashboardData()
      if (mounted.current) setData(dashboardData)
    } catch {
      if (mounted.current) setError(LOAD_ERROR)
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [data])

  return (
    <DashboardDataContext.Provider value={{ data, loading, refreshing, error, refresh }}>
      {children}
    </DashboardDataContext.Provider>
  )
}
