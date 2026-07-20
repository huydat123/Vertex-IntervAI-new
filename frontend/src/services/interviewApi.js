import { authFetch } from './apiClient.js'
import { createInterviewSession } from './interviewService.js'
import { normalizeLanguage } from './language.js'

const DEFAULT_INTERVIEW_API_BASE_URL =
  'https://j3zljogo3j.execute-api.ap-southeast-1.amazonaws.com/default'

const INTERVIEW_API_BASE_URL = import.meta.env.VITE_INTERVIEW_API_BASE_URL || DEFAULT_INTERVIEW_API_BASE_URL

export async function createInterviewOnAws({ cvAnalysis, currentUser, roleProfile, questionCount, language }) {
  if (!cvAnalysis?.cvId) {
    throw new Error('Please upload and analyze a CV before creating an interview.')
  }

  const roleSkills = roleProfile?.skills?.filter(Boolean) || []
  const cvSkills = cvAnalysis.skills || []
  const skills = mergeUnique(roleSkills, cvSkills)

  const response = await callInterviewApi('/interviews', {
    userId: currentUser.userId,
    cvId: cvAnalysis.cvId,
    role: roleProfile?.label || cvAnalysis.suggestedPosition || 'Software Developer Intern',
    roleCategory: roleProfile?.category || 'cv',
    roleFocus: roleProfile?.focus || '',
    questionCount,
    language,
    skills,
    projects: cvAnalysis.projects || [],
  })

  const interview = response.interview || response

  if (!interview?.interviewId || !Array.isArray(interview.questions) || interview.questions.length === 0) {
    throw new Error('Create interview API did not return a valid interview session.')
  }

  const activeLanguage = normalizeLanguage(language)
  const localSession = createInterviewSession(cvAnalysis, {
    roleProfile,
    questionCount,
    language: activeLanguage,
  })
  const apiQuestions = limitQuestions(
    normalizeInterviewQuestions(interview.questions || []),
    questionCount,
  )
  const questions = shouldUseLocalQuestions(apiQuestions, activeLanguage)
    ? localSession.questions
    : apiQuestions

  return {
    interviewId: interview.interviewId,
    role: interview.role,
    focus: interview.roleFocus || interview.skills?.slice(0, 3).join(', ') || 'AI Interview',
    roleKey: roleProfile?.id || 'cv-role',
    roleCategory: interview.roleCategory || roleProfile?.category || 'cv',
    skills: interview.skills || skills,
    questions,
    questionCount: questions.length,
    createdAt: interview.createdAt,
    status: interview.status || 'IN_PROGRESS',
    language: activeLanguage,
    source: 'Live AI',
  }
}

export async function submitAnswerToAws({
  userId,
  interviewId,
  questionIndex,
  question,
  answer,
  language,
}) {
  const response = await callInterviewApi('/interviews/answer', {
    userId,
    interviewId,
    questionIndex,
    question,
    answer,
    language,
  })

  const evaluation = response.evaluation || {}
  const interview = response.interview || {}

  if (!response.evaluation || !response.interview) {
    throw new Error('Submit answer API did not return a valid evaluation.')
  }

  return {
    feedback: evaluation.feedback || 'Answer reviewed by AI.',
    score: Number(evaluation.score || 0),
    level: getLevelFromScore(Number(evaluation.score || 0)),
    shouldAdvance: Boolean(evaluation.shouldAdvance),
    strengths: evaluation.strengths || [],
    improvements: evaluation.improvements || [],
    interview,
    source: 'Live AI',
  }
}

async function callInterviewApi(path, body) {
  let response

  try {
    response = await authFetch(`${INTERVIEW_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot connect to the interview service. Please check the app connection and try again.')
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

function limitQuestions(questions, questionCount) {
  const requestedCount = Number(questionCount)

  if (!Number.isFinite(requestedCount) || requestedCount <= 0) {
    return questions
  }

  return questions.slice(0, Math.max(2, Math.round(requestedCount)))
}

function mergeUnique(...groups) {
  const seen = new Set()
  const merged = []

  groups.flat().forEach((item) => {
    const value = String(item || '').trim()
    const key = value.toLowerCase()

    if (!value || seen.has(key)) {
      return
    }

    seen.add(key)
    merged.push(value)
  })

  return merged
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

function shouldUseLocalQuestions(questions, language) {
  if (language !== 'vi') {
    return false
  }

  if (!questions.length) {
    return true
  }

  const englishQuestionCount = questions.filter((question) => looksLikeEnglishQuestion(question)).length

  return englishQuestionCount >= Math.ceil(questions.length / 2)
}

function looksLikeEnglishQuestion(question) {
  const text = String(question || '').trim()

  if (!text) {
    return false
  }

  if (/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text)) {
    return false
  }

  return /\b(how would|tell me|describe|explain|what|why|if|can you|you are applying|give me|pick one)\b/i.test(text)
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
