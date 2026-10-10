import { CheckCheck } from 'lucide-react'

import type { QuestionResultData } from '../types/survey'

export default function QuestionResult({ question }: { question: QuestionResultData }) {
  return (
    <article className="question-card">
      <header className="question-card__header">
        <div>
          <span className="question-number">Question {question.position}</span>
          <h3>{question.title}</h3>
        </div>
        <span className="response-count">
          <CheckCheck size={16} aria-hidden="true" />
          {question.responseCount} réponse{question.responseCount > 1 ? 's' : ''}
        </span>
      </header>

      <div className="result-list">
        {question.results.map((result) => (
          <div className="result-row" key={result.value}>
            <div className="result-row__labels">
              <span className="result-row__option">{result.label}</span>
              <strong className="result-row__count">{result.count}</strong>
              <span className="result-row__percentage">
                {result.percentage.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
              </span>
            </div>
            <div className="result-track" aria-hidden="true">
              <span style={{ width: `${result.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
