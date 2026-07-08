const DEFAULT_INTERVIEW_API_BASE_URL =
  'https://j3zljogo3j.execute-api.ap-southeast-1.amazonaws.com/default'

const INTERVIEW_API_BASE_URL = import.meta.env.VITE_INTERVIEW_API_BASE_URL || DEFAULT_INTERVIEW_API_BASE_URL

export async function createInterviewOnAws({ cvAnalysis, currentUser }) {
  const response = await callInterviewApi('/interviews', {
    userId: currentUser.userId,
    cvId: cvAnalysis?.cvId || 'cv_demo_001',
    role: cvAnalysis?.suggestedPosition || 'Software Developer Intern',
    skills: cvAnalysis?.skills || ['React', 'Python', 'AWS'],
    projects: cvAnalysis?.projects || ['Talent Graph AI'],
  })

  const interview = response.interview || response

  if (!interview?.interviewId || !Array.isArray(interview.questions) || interview.questions.length === 0) {
    throw new Error('Create interview API did not return a valid interview session.')
  }

  return {
    interviewId: interview.interviewId,
    role: interview.role,
    focus: interview.skills?.slice(0, 3).join(', ') || 'AWS AI Interview',
    questions: normalizeInterviewQuestions(interview.questions || []),
    createdAt: interview.createdAt,
    status: interview.status || 'IN_PROGRESS',
    source: 'AWS',
  }
}

export async function submitAnswerToAws({
  userId,
  interviewId,
  questionIndex,
  question,
  answer,
}) {
  const response = await callInterviewApi('/interviews/answer', {
    userId,
    interviewId,
    questionIndex,
    question,
    answer,
  })

  const evaluation = response.evaluation || {}
  const interview = response.interview || {}

  if (!response.evaluation || !response.interview) {
    throw new Error('Submit answer API did not return a valid evaluation.')
  }

  return {
    feedback: evaluation.feedback || 'Answer reviewed by AWS AI.',
    score: Number(evaluation.score || 0),
    level: getLevelFromScore(Number(evaluation.score || 0)),
    shouldAdvance: Boolean(evaluation.shouldAdvance),
    strengths: evaluation.strengths || [],
    improvements: evaluation.improvements || [],
    interview,
    source: response.answer?.aiProvider || 'AWS',
  }
}

async function callInterviewApi(path, body) {
  let response

  try {
    response = await fetch(`${INTERVIEW_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot connect to interview API. Please check API Gateway CORS and Lambda integration.')
  }

  const data = await parseJsonResponse(response)

  if (!response.ok) {
    const serverMessage = data.message === 'Internal server error' && data.error
      ? data.error
      : data.message || data.error

    throw new Error(serverMessage || `Interview API failed with status ${response.status}`)
  }

  return data
}

async function parseJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function getLevelFromScore(score) {
  if (score >= 80) return 'strong'
  if (score >= 60) return 'needs-detail'
  if (score >= 40) return 'incomplete'
  return 'weak'
}

function normalizeInterviewQuestions(questions) {
  return questions
    .map((question) => normalizeInterviewQuestion(question))
    .filter(Boolean)
}

function normalizeInterviewQuestion(question) {
  const text = String(question).trim()
  const githubProject = text.match(/github\.com\/[^/\s]+\/([^.\s/?#]+)/i)
  let normalizedText = githubProject
    ? text.replace(/https?:\/\/github\.com\/[^/\s]+\/[^.\s/?#]+/i, `the ${formatProjectName(githubProject[1])} project`)
    : text

  const reliabilitySkill = normalizedText.match(/improve the reliability of an API or feature built with ([^?]+)\?/i)

  if (reliabilitySkill?.[1] && isFrontendSkill(reliabilitySkill[1])) {
    const skill = cleanQuestionPart(reliabilitySkill[1])

    return `How would you improve the reliability, responsiveness, and user experience of a frontend feature built with ${skill}?`
  }

  const apiSkill = normalizedText.match(/improve the reliability of an API built with ([^?]+)\?/i)

  if (apiSkill?.[1] && isFrontendSkill(apiSkill[1])) {
    const skill = cleanQuestionPart(apiSkill[1])

    return `How would you make a frontend page built with ${skill} reliable, responsive, and easy to maintain?`
  }

  return normalizedText
}

function isFrontendSkill(skill) {
  return /(html|css|bootstrap|tailwind|sass|react|vue|angular|javascript|typescript|ui|frontend)/i.test(skill)
}

function cleanQuestionPart(value) {
  return String(value)
    .replace(/[?.]+$/g, '')
    .trim()
}

function formatProjectName(value) {
  return cleanQuestionPart(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
