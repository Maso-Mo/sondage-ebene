import { Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLayout() {
  const navigate = useNavigate()

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div>
          <p className="brand-small">Rêve d'Ébène</p>
          <h2>Insights</h2>
        </div>

        <nav>
          <a href="/">Vue d'ensemble</a>
        </nav>

        <button onClick={logout}>
          Déconnexion
        </button>
      </aside>

      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  )
}
