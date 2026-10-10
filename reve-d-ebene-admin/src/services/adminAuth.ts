import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'

export const ADMIN_ACCESS_RECHECK_EVENT = 'reve-admin:recheck-access'

export type AdminAccessStatus =
  | 'active'
  | 'disabled'
  | 'expired'
  | 'not_admin'
  | 'invalid_session'
  | 'unauthenticated'

export type AdminAccess = {
  status: AdminAccessStatus
  isAdmin: boolean
  isOwner: boolean
}

export class AdminAccessDeniedError extends Error {
  accessStatus: AdminAccessStatus

  constructor(accessStatus: AdminAccessStatus) {
    super('Administrator access is no longer valid')
    this.name = 'AdminAccessDeniedError'
    this.accessStatus = accessStatus
  }
}

export function getAccessDeniedMessage(status: AdminAccessStatus) {
  if (status === 'expired') return 'Votre accès administrateur a expiré.'
  if (status === 'disabled' || status === 'not_admin') {
    return 'Votre accès administrateur a été retiré.'
  }
  if (status === 'invalid_session') {
    return 'Votre session a été invalidée. Veuillez vous reconnecter.'
  }
  return "Ce compte n'est pas autorisé à accéder à l'administration."
}

export function requestAdminAccessRecheck() {
  window.dispatchEvent(new Event(ADMIN_ACCESS_RECHECK_EVENT))
}

export function isAuthorizationError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { status?: number; code?: string }
  return candidate.status === 401
    || candidate.status === 403
    || candidate.code === '42501'
    || candidate.code === 'PGRST301'
    || candidate.code === 'PGRST303'
}

export async function getAdminAccess(session: Session | null): Promise<AdminAccess> {
  if (!session) return { status: 'unauthenticated', isAdmin: false, isOwner: false }

  const { data: userData, error: userError } = await supabase.auth.getUser(session.access_token)
  if (userError) {
    const authStatus = userError.status
    if (
      (typeof authStatus === 'number' && authStatus >= 400 && authStatus < 500)
      || userError.name === 'AuthSessionMissingError'
    ) {
      return { status: 'invalid_session', isAdmin: false, isOwner: false }
    }
    throw userError
  }
  if (!userData.user || userData.user.id !== session.user.id) {
    return { status: 'invalid_session', isAdmin: false, isOwner: false }
  }

  const { data: accessStatus, error: statusError } = await supabase.rpc('admin_access_status')
  if (statusError) throw statusError

  const status = accessStatus as AdminAccessStatus
  if (status !== 'active') return { status, isAdmin: false, isOwner: false }

  const [{ data: admin, error: adminError }, { data: owner, error: ownerError }] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('is_owner'),
  ])

  if (adminError) throw adminError
  if (ownerError) throw ownerError

  return { status, isAdmin: admin === true, isOwner: owner === true }
}

export async function isAdminSession(session: Session | null) {
  const access = await getAdminAccess(session)
  return access.isAdmin
}

export async function requireCurrentAdminAccess() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    requestAdminAccessRecheck()
    throw error
  }

  let access: AdminAccess
  try {
    access = await getAdminAccess(data.session)
  } catch (accessError) {
    requestAdminAccessRecheck()
    throw accessError
  }
  if (!access.isAdmin) {
    requestAdminAccessRecheck()
    throw new AdminAccessDeniedError(access.status)
  }
  return access
}

export async function signOutSession() {
  try {
    const { error } = await supabase.auth.signOut()
    if (!error) return
  } catch {
    // A deleted or invalid server session can reject global sign-out.
  }

  await supabase.auth.signOut({ scope: 'local' })
}
