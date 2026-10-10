import { Menu, ShieldCheck } from 'lucide-react'

type Props = {
  title: string
  eyebrow: string
  onOpenMenu: () => void
}

export default function AdminHeader({ title, eyebrow, onOpenMenu }: Props) {
  return (
    <header className="admin-header">
      <div className="admin-header__mobile">
        <button type="button" onClick={onOpenMenu} aria-label="Ouvrir le menu">
          <Menu aria-hidden="true" />
        </button>
        <span>Rêve d'Ébène</span>
      </div>
      <div>
        <span className="page-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <div className="secure-badge">
        <ShieldCheck size={17} aria-hidden="true" />
        Accès sécurisé
      </div>
    </header>
  )
}
