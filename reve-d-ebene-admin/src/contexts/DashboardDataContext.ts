import { createContext } from 'react'

import type { DashboardData } from '../types/survey'

export type DashboardDataValue = {
  data: DashboardData | null
  loading: boolean
  refreshing: boolean
  error: string
  refresh: () => Promise<void>
}

export const DashboardDataContext = createContext<DashboardDataValue | null>(null)
