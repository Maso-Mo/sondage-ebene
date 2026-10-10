import {
  CalendarDays,
  Clock3,
  MessageCircleMore,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UsersRound,
} from 'lucide-react'

import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackStates'
import QuestionResult from '../components/QuestionResult'
import StatCard from '../components/StatCard'
import { useDashboardData } from '../contexts/useDashboardData'
import type { DashboardData } from '../types/survey'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const shortDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatDate(value: string | null) {
  if (!value) return 'Aucune réponse'
  return dateFormatter.format(new Date(value))
}

function formatShortDate(value: string | null) {
  if (!value) return '—'
  return shortDateFormatter.format(new Date(value))
}

function ResultsSection({ data }: { data: DashboardData }) {
  return (
    <section className="dashboard-section" id="results" aria-labelledby="results-title">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Analyse quantitative</span>
          <h2 id="results-title">Résultats du sondage</h2>
          <p>Répartition des réponses pour chaque question fermée.</p>
        </div>
        <span className="version-badge">Version {data.versions[0] ?? 1}</span>
      </div>

      {data.stats.total === 0 ? (
        <EmptyState message="Les résultats apparaîtront dès la première réponse." />
      ) : (
        <div className="question-grid">
          {data.questionResults.map((question) => (
            <QuestionResult question={question} key={question.id} />
          ))}
        </div>
      )}
    </section>
  )
}

function TextResponsesSection({ data }: { data: DashboardData }) {
  const hasResponses = data.textResponses.some((group) => group.responses.length > 0)

  return (
    <section className="dashboard-section" id="responses" aria-labelledby="responses-title">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Réponses libres</span>
          <h2 id="responses-title">La voix des répondantes</h2>
          <p>Les mots laissés librement dans le questionnaire.</p>
        </div>
        <span className="section-icon"><MessageCircleMore aria-hidden="true" /></span>
      </div>

      {!hasResponses ? (
        <EmptyState message="Aucune réponse libre à afficher pour le moment." />
      ) : (
        <div className="text-groups">
          {data.textResponses.map((group) => (
            <article className="text-group" key={group.id}>
              <header>
                <span>Question {group.position}</span>
                <h3>{group.title}</h3>
                <p>{group.responses.length} réponse{group.responses.length > 1 ? 's' : ''}</p>
              </header>
              {group.responses.length === 0 ? (
                <p className="text-group__empty">Aucune réponse pour cette question.</p>
              ) : (
                <div className="text-response-list">
                  {group.responses.map((response) => (
                    <blockquote key={`${group.id}-${response.submissionId}`}>
                      <p>{response.value}</p>
                      <footer>{formatDate(response.createdAt)}</footer>
                    </blockquote>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default function Dashboard() {
  const { data, loading, refreshing, error, refresh } = useDashboardData()

  if (loading) return <LoadingState />

  if (!data) {
    return <ErrorState message={error || 'Les données sont indisponibles.'} onRetry={() => void refresh()} />
  }

  return (
    <main className="dashboard">
      <section className="overview-section" id="overview" aria-labelledby="overview-title">
        <div className="dashboard-toolbar">
          <p>
            <span className="toolbar-copy">Données mises à jour à l’ouverture de la page</span>
            <span className="toolbar-dot" aria-hidden="true">•</span>
            <span className="toolbar-version">schéma v{data.versions[0] ?? 1}</span>
          </p>
          <button className="secondary-button" type="button" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'spin' : ''} size={16} aria-hidden="true" />
            {refreshing ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>

        {error && (
          <div className="inline-error" role="status">
            {error} Les dernières données chargées restent affichées.
          </div>
        )}

        <div className="welcome-card">
          <div>
            <span className="section-kicker">Bonjour,</span>
            <h2 id="overview-title">Voici ce que vos clientes vous ont confié.</h2>
            <p>Une lecture claire et vivante des réponses du questionnaire Rêve d'Ébène.</p>
          </div>
          <img src="/floral/floral-bouquet.svg" alt="" aria-hidden="true" />
        </div>

        <div className="stats-grid" aria-label="Indicateurs du sondage">
          <StatCard label="Total des réponses" value={data.stats.total} detail="depuis le lancement" icon={UsersRound} tone="plum" />
          <StatCard label="Aujourd'hui" value={data.stats.today} detail="nouvelle(s) réponse(s)" icon={Sparkles} tone="rose" />
          <StatCard label="7 derniers jours" value={data.stats.last7Days} detail="semaine glissante" icon={TrendingUp} tone="peach" />
          <StatCard label="30 derniers jours" value={data.stats.last30Days} detail="mois glissant" icon={CalendarDays} tone="sage" />
          <StatCard label="Dernière réponse" value={formatShortDate(data.stats.lastResponseAt)} detail={data.stats.lastResponseAt ? formatDate(data.stats.lastResponseAt) : 'En attente'} icon={Clock3} tone="rose" />
        </div>
      </section>

      <ResultsSection data={data} />
      <TextResponsesSection data={data} />
    </main>
  )
}
