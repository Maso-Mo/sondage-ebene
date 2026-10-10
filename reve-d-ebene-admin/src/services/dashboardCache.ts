import type { DashboardData } from '../types/survey'
import { getDashboardData } from './survey'

let dashboardCache: DashboardData | null = null
let pendingDashboardRequest: Promise<DashboardData> | null = null
let cacheGeneration = 0

export function clearDashboardDataCache() {
  cacheGeneration += 1
  dashboardCache = null
  pendingDashboardRequest = null
}

export function readDashboardDataCache() {
  return dashboardCache
}

export function getCachedDashboardData() {
  if (dashboardCache) return Promise.resolve(dashboardCache)

  if (!pendingDashboardRequest) {
    const requestGeneration = cacheGeneration
    pendingDashboardRequest = getDashboardData()
      .then((dashboardData) => {
        if (requestGeneration !== cacheGeneration) {
          throw new Error('Dashboard request was invalidated')
        }
        dashboardCache = dashboardData
        return dashboardData
      })
      .finally(() => {
        if (requestGeneration === cacheGeneration) pendingDashboardRequest = null
      })
  }

  return pendingDashboardRequest
}

export async function refreshDashboardData() {
  const requestGeneration = cacheGeneration
  const dashboardData = await getDashboardData()
  if (requestGeneration !== cacheGeneration) {
    throw new Error('Dashboard request was invalidated')
  }
  dashboardCache = dashboardData
  return dashboardData
}
