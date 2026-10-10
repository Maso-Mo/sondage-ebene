import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { LoadingState } from '../components/FeedbackStates'
import { supabase } from '../lib/supabase'

export default function SetPassword() {
  const navigate = useNavigate()
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(() => {
    const linkError = new URLSearchParams(window.location.search).get('error_description')
      ?? new URLSearchParams(window.location.hash.slice(1)).get('error_description')
    return linkError
      ? 'Ce lien d’invitation est invalide ou a expiré. Demandez une nouvelle invitation.'
      : ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSessionReady(Boolean(data.session))
      setSessionChecked(true)
      if (!data.session) {
        setError((current) => current || 'Ouvrez le lien reçu par email pour créer votre mot de passe.')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionReady(Boolean(session))
      setSessionChecked(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 10) {
      setError('Choisissez un mot de passe d’au moins 10 caractères.')
      return
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      setError('Le mot de passe n’a pas pu être créé. Le lien a peut-être expiré.')
      return
    }
    navigate('/', { replace: true })
  }

  if (!sessionChecked) return <LoadingState fullPage label="Validation de votre invitation…" />

  return (
    <main className="login-page invite-page">
      <div className="login-visual" aria-hidden="true">
        <img src="/floral/rose.svg" className="login-rose" alt="" />
        <div className="login-quote">
          <span>Rêve d'Ébène</span>
          <p>Bienvenue dans<br />l’espace privé.</p>
        </div>
      </div>
      <section className="login-panel">
        <img src="/floral/leaves.svg" className="login-leaves" alt="" aria-hidden="true" />
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-brand">
            <span className="brand-mark" aria-hidden="true">R</span>
            <strong>Rêve d'Ébène</strong>
          </div>
          <div className="login-heading">
            <span className="page-eyebrow">Invitation administratrice</span>
            <h1>Créez votre mot de passe</h1>
            <p>Finalisez votre accès sécurisé au tableau de bord.</p>
          </div>

          {sessionReady && (
            <>
              <label className="field">
                <span>Nouveau mot de passe</span>
                <span className="field__control">
                  <KeyRound size={18} aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <label className="field">
                <span>Confirmer le mot de passe</span>
                <span className="field__control">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />
                </span>
              </label>
            </>
          )}

          {error && <p className="login-error" role="alert">{error}</p>}

          {sessionReady ? (
            <button className="primary-button login-submit" type="submit" disabled={saving}>
              <span>{saving ? 'Création…' : 'Créer mon mot de passe'}</span>
              {!saving && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          ) : (
            <button className="secondary-button login-submit" type="button" onClick={() => navigate('/login')}>
              Retour à la connexion
            </button>
          )}
        </form>
      </section>
    </main>
  )
}
