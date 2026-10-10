import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { AdminUser, InviteAdminInput, UpdateAdminInput } from '../types/admin'
import {
  isAuthorizationError,
  requestAdminAccessRecheck,
  requireCurrentAdminAccess,
} from './adminAuth'

type FunctionResult = {
  ok?: boolean
  message?: string
  error?: string
}

async function invokeManagement(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<FunctionResult>('manage-admin', { body })

  if (error) {
    if (
      isAuthorizationError(error)
      || (error instanceof FunctionsHttpError && [401, 403].includes(error.context.status))
    ) {
      requestAdminAccessRecheck()
    }
    let message = error.message
    if (error instanceof FunctionsHttpError) {
      try {
        const response = await error.context.json() as FunctionResult
        if (response.error) message = response.error
      } catch {
        // Keep the SDK error if the server did not return JSON.
      }
    }
    throw new Error(message)
  }

  if (!data?.ok) throw new Error(data?.error ?? 'La demande n’a pas pu être traitée.')
  return data.message ?? 'Modification enregistrée.'
}

export async function listAdministrators() {
  const access = await requireCurrentAdminAccess()
  if (!access.isOwner) throw new Error('Action réservée au propriétaire.')

  const { data, error } = await supabase.rpc('list_admin_users')
  if (error) {
    if (isAuthorizationError(error)) requestAdminAccessRecheck()
    throw error
  }
  return (data ?? []) as AdminUser[]
}

export function inviteAdministrator(input: InviteAdminInput) {
  return invokeManagement({ action: 'invite', ...input })
}

export function updateAdministrator(input: UpdateAdminInput) {
  return invokeManagement({ action: 'update', ...input })
}

export function revokeAdministrator(userId: string) {
  return invokeManagement({ action: 'revoke', userId })
}
