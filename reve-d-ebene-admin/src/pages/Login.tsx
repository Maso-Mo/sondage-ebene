import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAdminAuth } from '../contexts/useAdminAuth'
import { supabase } from '../lib/supabase'
import { getAccessDeniedMessage, getAdminAccess, signOutSession } from '../services/adminAuth'

type LocationState = {
  from?: string
  message?: string | null
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAdminAuth()
  const locationState = (location.state ?? {}) as LocationState
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(locationState.message ?? '')
  const [loading, setLoading] = useState(false)

  if (auth.status === 'authenticated') return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError || !data.session) {
        setError('Email ou mot de passe incorrect.')
        return
      }

      const access = await getAdminAccess(data.session)
      if (!access.isAdmin) {
        await signOutSession()
        setError(getAccessDeniedMessage(access.status))
        return
      }

      navigate(locationState.from ?? '/', { replace: true })
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau et réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-visual" aria-hidden="true">
        <img src="/floral/rose.svg" className="login-rose" alt="" />
        <div className="login-quote">
          <span>Rêve d'Ébène</span>
          <p>Écouter les envies.<br />Révéler la beauté.</p>
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
            <span className="page-eyebrow">Espace privé</span>
            <h1>Bienvenue</h1>
            <p>Connectez-vous pour consulter les résultats du sondage.</p>
          </div>

          <label className="field">
            <span>Adresse email</span>
            <span className="field__control">
              <Mail size={18} aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vous@revedebene.com"
                autoComplete="email"
                required
              />
            </span>
          </label>

          <label className="field">
            <span>Mot de passe</span>
            <span className="field__control">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Votre mot de passe"
                autoComplete="current-password"
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

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="primary-button login-submit" type="submit" disabled={loading}>
            <span>{loading ? 'Vérification…' : 'Se connecter'}</span>
            {!loading && <ArrowRight size={18} aria-hidden="true" />}
          </button>

          <p className="login-security">
            <LockKeyhole size={14} aria-hidden="true" />
            Accès réservé aux administratrices autorisées
          </p>
        </form>
      </section>
    </main>
  )
}
