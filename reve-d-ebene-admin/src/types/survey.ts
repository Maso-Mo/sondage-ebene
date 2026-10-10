export type SurveyResponse = {
  submission_id: string
  schema_version: number
  age: string
  purchase_frequency: string
  products: string[]
  desired_products: string
  makeup_style: string
  preferred_texture: string
  colors: string[]
  brand_issues: string[]
  gloss_budget: string
  purchase_triggers: string[]
  packaging_style: string
  purchase_channel: string
  local_brand_interest: string
  followed_influencer: string
  ideal_brand: string | null
  client_completed_at: string | null
  created_at: string
}

export type ClosedQuestionKey =
  | 'age'
  | 'purchase_frequency'
  | 'products'
  | 'makeup_style'
  | 'preferred_texture'
  | 'colors'
  | 'brand_issues'
  | 'gloss_budget'
  | 'purchase_triggers'
  | 'packaging_style'
  | 'purchase_channel'
  | 'local_brand_interest'

export type TextQuestionKey =
  | 'desired_products'
  | 'followed_influencer'
  | 'ideal_brand'

export type QuestionOption = {
  value: string
  label: string
}

export type ClosedQuestion = {
  id: ClosedQuestionKey
  position: number
  schemaVersion: number
  title: string
  kind: 'single' | 'multiple'
  options: readonly QuestionOption[]
}

export type TextQuestion = {
  id: TextQuestionKey
  position: number
  schemaVersion: number
  title: string
  optional?: boolean
}

export type OptionResult = QuestionOption & {
  count: number
  percentage: number
}

export type QuestionResultData = ClosedQuestion & {
  responseCount: number
  results: OptionResult[]
}

export type TextResponseGroup = TextQuestion & {
  responses: Array<{
    submissionId: string
    value: string
    createdAt: string
  }>
}

export type DashboardStats = {
  total: number
  today: number
  last7Days: number
  last30Days: number
  lastResponseAt: string | null
}

export type DashboardData = {
  stats: DashboardStats
  questionResults: QuestionResultData[]
  textResponses: TextResponseGroup[]
  versions: number[]
}

export type SurveyFilters = {
  schemaVersion?: number
  from?: string
  to?: string
}
