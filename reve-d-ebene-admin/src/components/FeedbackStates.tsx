import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react'

type LoadingProps = {
  label?: string
  fullPage?: boolean
}

export function LoadingState({ label = 'Chargement des données…', fullPage = false }: LoadingProps) {
  return (
    <div className={`feedback-state${fullPage ? ' feedback-state--page' : ''}`} role="status">
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

type ErrorProps = {
  title?: string
  message: string
  onRetry?: () => void
  fullPage?: boolean
}

export function ErrorState({
  title = 'Un imprévu est survenu',
  message,
  onRetry,
  fullPage = false,
}: ErrorProps) {
  return (
    <div className={`feedback-state feedback-state--error${fullPage ? ' feedback-state--page' : ''}`}>
      <span className="feedback-state__icon">
        <AlertCircle aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <button className="secondary-button" type="button" onClick={onRetry}>
          <RefreshCw size={17} aria-hidden="true" />
          Réessayer
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="feedback-state feedback-state--empty">
      <Inbox aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
