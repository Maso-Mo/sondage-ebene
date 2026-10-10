import { CLOSED_QUESTIONS, TEXT_QUESTIONS } from '../data/surveyQuestions'
import { supabase } from '../lib/supabase'
import {
  isAuthorizationError,
  requestAdminAccessRecheck,
  requireCurrentAdminAccess,
} from './adminAuth'
import type {
  DashboardData,
  DashboardStats,
  QuestionResultData,
  SurveyFilters,
  SurveyResponse,
  TextResponseGroup,
} from '../types/survey'

const PAGE_SIZE = 1000
const RESPONSE_COLUMNS = [
  'submission_id',
  'schema_version',
  'age',
  'purchase_frequency',
  'products',
  'desired_products',
  'makeup_style',
  'preferred_texture',
  'colors',
  'brand_issues',
  'gloss_budget',
  'purchase_triggers',
  'packaging_style',
  'purchase_channel',
  'local_brand_interest',
  'followed_influencer',
  'ideal_brand',
  'client_completed_at',
  'created_at',
].join(',')

async function fetchResponses(filters: SurveyFilters = {}) {
  const responses: SurveyResponse[] = []

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE
    let query = supabase
      .from('survey_responses')
      .select(RESPONSE_COLUMNS)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (filters.schemaVersion !== undefined) {
      query = query.eq('schema_version', filters.schemaVersion)
    }
    if (filters.from) query = query.gte('created_at', filters.from)
    if (filters.to) query = query.lt('created_at', filters.to)

    const { data, error } = await query

    if (error) {
      if (isAuthorizationError(error)) requestAdminAccessRecheck()
      throw error
    }

    const pageRows = (data ?? []) as unknown as SurveyResponse[]
    responses.push(...pageRows)
    if (pageRows.length < PAGE_SIZE) break
  }

  return responses
}

function startOfCalendarDay(daysAgo = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return date.getTime()
}

function buildStats(responses: SurveyResponse[]): DashboardStats {
  const today = startOfCalendarDay()
  const sevenDays = startOfCalendarDay(6)
  const thirtyDays = startOfCalendarDay(29)

  return {
    total: responses.length,
    today: responses.filter((response) => Date.parse(response.created_at) >= today).length,
    last7Days: responses.filter((response) => Date.parse(response.created_at) >= sevenDays).length,
    last30Days: responses.filter((response) => Date.parse(response.created_at) >= thirtyDays).length,
    lastResponseAt: responses[0]?.created_at ?? null,
  }
}

function buildQuestionResults(responses: SurveyResponse[]): QuestionResultData[] {
  return CLOSED_QUESTIONS.map((question) => {
    const responseCount = responses.reduce((count, response) => {
      const value = response[question.id]
      return count + (Array.isArray(value) ? Number(value.length > 0) : Number(Boolean(value)))
    }, 0)

    const results = question.options.map((option) => {
      const count = responses.reduce((total, response) => {
        const value = response[question.id]
        const selected = Array.isArray(value) ? value.includes(option.value) : value === option.value
        return total + Number(selected)
      }, 0)

      return {
        ...option,
        count,
        percentage: responseCount === 0 ? 0 : (count / responseCount) * 100,
      }
    })

    return { ...question, responseCount, results }
  })
}

function buildTextResponses(responses: SurveyResponse[]): TextResponseGroup[] {
  return TEXT_QUESTIONS.map((question) => ({
    ...question,
    responses: responses.flatMap((response) => {
      const rawValue = response[question.id]
      const value = typeof rawValue === 'string' ? rawValue.trim() : ''

      return value
        ? [{ submissionId: response.submission_id, value, createdAt: response.created_at }]
        : []
    }),
  }))
}

export async function getDashboardData(filters: SurveyFilters = {}): Promise<DashboardData> {
  await requireCurrentAdminAccess()
  const responses = await fetchResponses(filters)
  await requireCurrentAdminAccess()

  return {
    stats: buildStats(responses),
    questionResults: buildQuestionResults(responses),
    textResponses: buildTextResponses(responses),
    versions: [...new Set(responses.map((response) => response.schema_version))].sort(
      (a, b) => b - a,
    ),
  }
}
