import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CalendarClock,
  Check,
  Clock3,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserRoundPlus,
  X,
} from 'lucide-react'

import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackStates'
import {
  inviteAdministrator,
  listAdministrators,
  revokeAdministrator,
  updateAdministrator,
} from '../services/adminManagement'
import type { AdminAccessType, AdminUser } from '../types/admin'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string) {
  return dateFormatter.format(new Date(value))
}

function toLocalDateTime(value: Date | string) {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function tomorrowDateTime() {
  return toLocalDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000))
}

function statusLabel(admin: AdminUser) {
  if (admin.role === 'owner') return 'Actif'
  if (admin.access_status === 'disabled') return 'Désactivé'
  if (admin.access_status === 'expired') return 'Expiré'
  return 'Actif'
}

type EditorProps = {
  admin?: AdminUser
  reactivate?: boolean
  onClose: () => void
  onSaved: (message: string) => void
}

function AdminEditor({ admin, reactivate = false, onClose, onSaved }: EditorProps) {
  const [email, setEmail] = useState('')
  const initialType: AdminAccessType = admin?.expires_at ? 'temporary' : 'unlimited'
  const [accessType, setAccessType] = useState<AdminAccessType>(initialType)
  const [expiresAt, setExpiresAt] = useState(
    admin?.expires_at && admin.access_status !== 'expired'
      ? toLocalDateTime(admin.expires_at)
      : tomorrowDateTime(),
  )
  const [isActive, setIsActive] = useState(reactivate ? true : (admin?.is_active ?? true))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    let expiration: string | null = null
    if (accessType === 'temporary') {
      const expirationDate = new Date(expiresAt)
      if (Number.isNaN(expirationDate.getTime()) || expirationDate.getTime() <= Date.now()) {
        setError("La date d’expiration doit être dans le futur.")
        return
      }
      expiration = expirationDate.toISOString()
    }

    setSaving(true)
    try {
      const message = admin
        ? await updateAdministrator({
            userId: admin.user_id,
            accessType,
            expiresAt: expiration,
            isActive,
          })
        : await inviteAdministrator({
            email: email.trim(),
            accessType,
            expiresAt: expiration,
          })
      onSaved(message)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'La demande a échoué.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          <X aria-hidden="true" />
        </button>
        <span className="modal-icon" aria-hidden="true">
          {admin ? <Pencil /> : <UserRoundPlus />}
        </span>
        <div className="modal-heading">
          <span className="section-kicker">{admin ? 'Gestion de l’accès' : 'Nouvelle administratrice'}</span>
          <h2 id="admin-editor-title">
            {admin ? (reactivate ? 'Réactiver le compte' : 'Modifier le compte') : 'Inviter par email'}
          </h2>
          <p>
            {admin
              ? admin.email
              : 'Un lien sécurisé permettra à la personne invitée de créer son mot de passe.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!admin && (
            <label className="field">
              <span>Adresse email</span>
              <span className="field__control">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@revedebene.com"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </span>
            </label>
          )}

          <fieldset className="access-choice">
            <legend>Durée de l’accès</legend>
            <label className={accessType === 'unlimited' ? 'is-selected' : undefined}>
              <input
                type="radio"
                name="accessType"
                value="unlimited"
                checked={accessType === 'unlimited'}
                onChange={() => setAccessType('unlimited')}
              />
              <ShieldCheck aria-hidden="true" />
              <span><strong>Illimité</strong><small>Sans date de fin</small></span>
            </label>
            <label className={accessType === 'temporary' ? 'is-selected' : undefined}>
              <input
                type="radio"
                name="accessType"
                value="temporary"
                checked={accessType === 'temporary'}
                onChange={() => setAccessType('temporary')}
              />
              <CalendarClock aria-hidden="true" />
              <span><strong>Temporaire</strong><small>Expire automatiquement</small></span>
            </label>
          </fieldset>

          {accessType === 'temporary' && (
            <label className="field">
              <span>Date et heure d’expiration</span>
              <span className="field__control">
                <Clock3 size={18} aria-hidden="true" />
                <input
                  type="datetime-local"
                  value={expiresAt}
                  min={toLocalDateTime(new Date())}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  required
                />
              </span>
            </label>
          )}

          {admin && (
            <label className="activation-toggle">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span aria-hidden="true"><Check /></span>
              <span><strong>Compte actif</strong><small>Autoriser la connexion tant que l’accès n’est pas expiré.</small></span>
            </label>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
              Annuler
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : admin ? 'Enregistrer' : 'Envoyer l’invitation'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

type RevokeProps = {
  admin: AdminUser
  onClose: () => void
  onRevoked: (message: string) => void
}

function RevokeDialog({ admin, onClose, onRevoked }: RevokeProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function revoke() {
    setSaving(true)
    setError('')
    try {
      onRevoked(await revokeAdministrator(admin.user_id))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'La révocation a échoué.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="admin-modal admin-modal--compact" role="alertdialog" aria-modal="true" aria-labelledby="revoke-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          <X aria-hidden="true" />
        </button>
        <span className="modal-icon modal-icon--danger" aria-hidden="true"><ShieldOff /></span>
        <div className="modal-heading">
          <span className="section-kicker">Révocation</span>
          <h2 id="revoke-title">Désactiver cet accès ?</h2>
          <p><strong>{admin.email}</strong> sera immédiatement déconnectée lors du prochain contrôle d’accès et ne pourra plus lire les réponses.</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="danger-button" type="button" onClick={() => void revoke()} disabled={saving}>
            {saving ? 'Révocation…' : 'Révoquer l’accès'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function Administrators() {
  const [administrators, setAdministrators] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editor, setEditor] = useState<{ admin?: AdminUser; reactivate?: boolean } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setAdministrators(await listAdministrators())
    } catch {
      setError('Impossible de charger les comptes administrateurs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let current = true

    listAdministrators()
      .then((data) => {
        if (current) setAdministrators(data)
      })
      .catch(() => {
        if (current) setError('Impossible de charger les comptes administrateurs.')
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [])

  async function handleSaved(message: string) {
    setEditor(null)
    setRevokeTarget(null)
    setSuccess(message)
    setLoading(true)
    await load()
  }

  return (
    <section className="admin-management" aria-labelledby="admin-management-title">
      <div className="management-intro">
        <div>
          <span className="section-kicker">Accès sensibles</span>
          <h2 id="admin-management-title">Équipe d’administration</h2>
          <p>Invitez et gérez les personnes autorisées à consulter les résultats du sondage.</p>
        </div>
        <button className="primary-button add-admin-button" type="button" onClick={() => setEditor({})}>
          <Plus size={18} aria-hidden="true" />
          Ajouter une administratrice
        </button>
      </div>

      <aside className="owner-notice">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Vous êtes la seule propriétaire.</strong>
          <p>Votre accès est permanent. Les comptes secondaires ne peuvent ni voir ni gérer cette page.</p>
        </div>
      </aside>

      {success && (
        <div className="success-banner" role="status">
          <Check aria-hidden="true" />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')} aria-label="Fermer"><X /></button>
        </div>
      )}

      {loading ? (
        <LoadingState label="Chargement de l’équipe…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); void load() }} />
      ) : administrators.length === 0 ? (
        <EmptyState message="Aucun compte administrateur." />
      ) : (
        <div className="admin-directory">
          <div className="directory-heading">
            <div>
              <span>{administrators.length}</span>
              <p>{administrators.length > 1 ? 'comptes enregistrés' : 'compte enregistré'}</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => { setLoading(true); void load() }}>
              <RefreshCw size={16} aria-hidden="true" />
              Actualiser
            </button>
          </div>

          <div className="admin-list">
            {administrators.map((admin) => (
              <article className={`admin-row admin-row--${admin.access_status}`} key={admin.user_id}>
                <span className="admin-avatar" aria-hidden="true">{admin.email.charAt(0).toUpperCase()}</span>
                <div className="admin-identity">
                  <div>
                    <strong>{admin.email}</strong>
                    <span className={`role-badge role-badge--${admin.role}`}>
                      {admin.role === 'owner' && <ShieldCheck />}
                      {admin.role === 'owner' ? 'Admin principal' : 'Admin'}
                    </span>
                  </div>
                  <small>Ajouté le {formatDate(admin.created_at)}</small>
                </div>
                <div className="admin-access">
                  <div className="access-badges">
                    <span className={`access-type-badge access-type-badge--${admin.expires_at ? 'temporary' : 'unlimited'}`}>
                      {admin.expires_at ? 'Temporaire' : 'Illimité'}
                    </span>
                    <span className={`status-badge status-badge--${admin.access_status}`}>{statusLabel(admin)}</span>
                  </div>
                  <p>
                    {admin.role === 'owner' || !admin.expires_at
                      ? 'Accès illimité'
                      : `Jusqu’au ${formatDate(admin.expires_at)}`}
                  </p>
                </div>
                <div className="admin-actions">
                  {admin.role === 'owner' ? (
                    <span className="protected-label"><ShieldCheck size={16} /> Compte protégé</span>
                  ) : (
                    <>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setEditor({
                          admin,
                          reactivate: admin.access_status === 'disabled' || admin.access_status === 'expired',
                        })}
                      >
                        {admin.access_status === 'disabled' || admin.access_status === 'expired' ? 'Réactiver' : 'Modifier'}
                      </button>
                      {admin.access_status !== 'disabled' && (
                        <button className="text-danger-button" type="button" onClick={() => setRevokeTarget(admin)}>
                          Révoquer
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {editor && (
        <AdminEditor
          admin={editor.admin}
          reactivate={editor.reactivate}
          onClose={() => setEditor(null)}
          onSaved={(message) => void handleSaved(message)}
        />
      )}
      {revokeTarget && (
        <RevokeDialog
          admin={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onRevoked={(message) => void handleSaved(message)}
        />
      )}
    </section>
  )
}
