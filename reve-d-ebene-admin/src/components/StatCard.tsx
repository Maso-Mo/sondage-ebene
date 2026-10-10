import type { LucideIcon } from 'lucide-react'

type Props = {
  label: string
  value: string | number
  detail: string
  icon: LucideIcon
  tone?: 'rose' | 'peach' | 'plum' | 'sage'
}

export default function StatCard({ label, value, detail, icon: Icon, tone = 'rose' }: Props) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__topline">
        <p>{label}</p>
        <span className="stat-card__icon">
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <strong>{value}</strong>
      <span className="stat-card__detail">{detail}</span>
    </article>
  )
}
