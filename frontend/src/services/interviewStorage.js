const INTERVIEW_RESULT_KEY = 'talentGraph.interviewResult'
const INTERVIEW_HISTORY_KEY = 'talentGraph.interviewHistory'
const MAX_HISTORY_ITEMS = 20

export function loadInterviewResult(userId) {
  try {
    const stored = window.localStorage.getItem(getUserStorageKey(INTERVIEW_RESULT_KEY, userId))
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function saveInterviewResult(result, userId = result?.userId) {
  const resolvedUserId = getResolvedUserId(userId)

  window.localStorage.setItem(getUserStorageKey(INTERVIEW_RESULT_KEY, resolvedUserId), JSON.stringify(result))
  saveInterviewHistory(
    upsertHistoryItem(loadInterviewHistory(resolvedUserId), result, getInterviewHistoryKey),
    resolvedUserId,
  )
}

export function loadInterviewHistory(userId) {
  try {
    const stored = window.localStorage.getItem(getUserStorageKey(INTERVIEW_HISTORY_KEY, userId))
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveInterviewHistory(items, userId) {
  window.localStorage.setItem(
    getUserStorageKey(INTERVIEW_HISTORY_KEY, userId),
    JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)),
  )
}

export function createInterviewResult({ session, currentUser, cvAnalysis, answers }) {
  const completedAt = new Date().toISOString()
  const scoredAnswers = answers.filter((answer) => Number.isFinite(answer.score))
  const overallScore = scoredAnswers.length
    ? Math.round(scoredAnswers.reduce((total, answer) => total + answer.score, 0) / scoredAnswers.length)
    : 0
  const strongAnswers = scoredAnswers.filter((answer) => answer.score >= 80).length
  const weakAnswers = scoredAnswers.filter((answer) => answer.score < 60).length

  return {
    interviewId: session.interviewId,
    userId: currentUser.userId,
    candidateName: currentUser.fullName,
    role: session.role,
    cvId: cvAnalysis?.cvId,
    cvScore: cvAnalysis?.cvScore,
    overallScore,
    status: 'Completed',
    totalQuestions: session.questions.length,
    answeredQuestions: scoredAnswers.length,
    completedAt,
    focus: session.focus,
    strengths: buildStrengths(strongAnswers, overallScore),
    improvements: buildImprovements(weakAnswers, overallScore),
    recommendation: buildRecommendation(overallScore),
    answers: scoredAnswers,
  }
}

export function formatInterviewDate(value) {
  if (!value) return 'Not completed'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function buildStrengths(strongAnswers, overallScore) {
  if (overallScore >= 85) {
    return [
      'Clear technical communication',
      'Good project examples',
      'Strong interview readiness',
    ]
  }

  if (strongAnswers >= 2) {
    return [
      'Good technical foundation',
      'Able to connect skills with project work',
      'Ready for more practice rounds',
    ]
  }

  return [
    'Understands the interview topic',
    'Can improve with more structured answers',
    'Needs more concrete examples',
  ]
}

function buildImprovements(weakAnswers, overallScore) {
  if (overallScore >= 85 && weakAnswers === 0) {
    return [
      'Add more measurable results',
      'Explain tradeoffs more clearly',
      'Prepare deeper system design examples',
    ]
  }

  if (overallScore >= 70) {
    return [
      'Use the STAR structure more consistently',
      'Add one result or metric to each answer',
      'Explain debugging steps in more detail',
    ]
  }

  return [
    'Avoid very short answers',
    'Mention specific tools and technologies',
    'Connect every answer to one real project',
  ]
}

function buildRecommendation(overallScore) {
  if (overallScore >= 85) {
    return 'Strong performance. You can move to a harder technical round with deeper architecture, debugging, and cloud questions.'
  }

  if (overallScore >= 70) {
    return 'Good foundation. Practice adding concrete project context, measurable results, and tradeoffs to make answers more convincing.'
  }

  return 'Needs more practice before a real interview. Focus on answering with one project example, one technology, and one result for every question.'
}

function getInterviewHistoryKey(item) {
  return item?.interviewId || `${item?.role || 'interview'}-${item?.completedAt || ''}`
}

function upsertHistoryItem(items, item, getKey) {
  if (!item) {
    return items
  }

  const key = getKey(item)
  const nextItems = [item, ...items.filter((current) => getKey(current) !== key)]

  return nextItems.slice(0, MAX_HISTORY_ITEMS)
}

function getUserStorageKey(baseKey, userId) {
  const resolvedUserId = getResolvedUserId(userId)

  return resolvedUserId ? `${baseKey}.${sanitizeUserId(resolvedUserId)}` : baseKey
}

function getResolvedUserId(userId) {
  return typeof userId === 'string' && userId.trim() ? userId.trim() : ''
}

function sanitizeUserId(userId) {
  return userId.replace(/[^a-zA-Z0-9._:-]/g, '_')
}
