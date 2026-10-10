import { BarChart3, LayoutDashboard, LogOut, MessageSquareText, UsersRound, X } from 'lucide-react'

import { useAdminAuth } from '../contexts/useAdminAuth'

export type DashboardSectionId = 'overview' | 'results' | 'responses'
export type AdminNavigationItemId = DashboardSectionId | 'administrators'

type Props = {
  mobileOpen: boolean
  activeItem: AdminNavigationItemId
  onNavigate: (section: AdminNavigationItemId) => void
  onClose: () => void
}

const links = [
  { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'results', label: 'Résultats', icon: BarChart3 },
  { id: 'responses', label: 'Réponses', icon: MessageSquareText },
] satisfies Array<{ id: DashboardSectionId; label: string; icon: typeof LayoutDashboard }>

export default function AdminNavigation({ mobileOpen, activeItem, onNavigate, onClose }: Props) {
  const { user, isOwner, logout } = useAdminAuth()

  function handleNavigation(section: AdminNavigationItemId) {
    onNavigate(section)
    onClose()
  }

  return (
    <>
      <button
        className={`nav-backdrop${mobileOpen ? ' is-open' : ''}`}
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
      />
      <aside className={`sidebar${mobileOpen ? ' is-open' : ''}`} aria-label="Navigation principale">
        <img src="/floral/tulip.svg" className="sidebar-bloom" alt="" aria-hidden="true" />
        <div className="sidebar__top">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">R</span>
            <div>
              <strong>Rêve d'Ébène</strong>
              <span>Maison de beauté</span>
            </div>
          </div>
          <button className="mobile-close" type="button" onClick={onClose} aria-label="Fermer le menu">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar__intro">
          <span>Espace privé</span>
          <p>Observatoire clientèle</p>
        </div>

        <nav className="sidebar__nav">
          <span className="nav-label">Navigation</span>
          {links.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeItem === id ? 'active' : undefined}
              aria-current={activeItem === id ? 'location' : undefined}
              onClick={() => handleNavigation(id)}
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
          {isOwner && (
            <button
              type="button"
              className={activeItem === 'administrators' ? 'active' : undefined}
              aria-current={activeItem === 'administrators' ? 'page' : undefined}
              onClick={() => handleNavigation('administrators')}
            >
              <UsersRound size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>Administratrices</span>
            </button>
          )}
        </nav>

        <div className="sidebar__bottom">
          <img src="/floral/corner-bloom.svg" className="sidebar-floral" alt="" aria-hidden="true" />
          <div className="user-summary">
            <span className="user-avatar" aria-hidden="true">
              {user?.email?.charAt(0).toUpperCase() ?? 'A'}
            </span>
            <div>
              <strong>{isOwner ? 'Propriétaire' : 'Administratrice'}</strong>
              <span title={user?.email}>{user?.email}</span>
            </div>
          </div>
          <button className="logout-button" type="button" onClick={() => void logout()}>
            <LogOut size={18} aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}
