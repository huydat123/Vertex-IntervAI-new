const CV_STORAGE_KEY = 'talentGraph.cvAnalysis'
const CV_HISTORY_KEY = 'talentGraph.cvHistory'
const CV_DELETED_KEY = 'talentGraph.deletedCvKeys'
const MAX_HISTORY_ITEMS = 20
const MAX_DELETED_ITEMS = 100
const MAX_CV_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx']
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export function loadCvAnalysis(userId) {
  try {
    const stored = window.localStorage.getItem(getUserStorageKey(CV_STORAGE_KEY, userId))
    const analysis = stored ? JSON.parse(stored) : null

    if (isCvHistoryItemDeleted(analysis, userId)) {
      return null
    }

    return analysis
  } catch {
    return null
  }
}

export function saveCvAnalysis(analysis, userId = analysis?.userId) {
  const resolvedUserId = getResolvedUserId(userId)
  forgetDeletedCvKey(getCvHistoryKey(analysis), resolvedUserId)

  window.localStorage.setItem(getUserStorageKey(CV_STORAGE_KEY, resolvedUserId), JSON.stringify(analysis))
  saveCvHistory(
    upsertHistoryItem(loadCvHistory(resolvedUserId), analysis, getCvHistoryKey),
    resolvedUserId,
  )
}

export function loadCvHistory(userId) {
  try {
    const stored = window.localStorage.getItem(getUserStorageKey(CV_HISTORY_KEY, userId))
    const items = stored ? JSON.parse(stored) : []

    return items.filter((item) => !isCvHistoryItemDeleted(item, userId))
  } catch {
    return []
  }
}

export function saveCvHistory(items, userId) {
  const visibleItems = (Array.isArray(items) ? items : [])
    .filter((item) => !isCvHistoryItemDeleted(item, userId))

  window.localStorage.setItem(
    getUserStorageKey(CV_HISTORY_KEY, userId),
    JSON.stringify(visibleItems.slice(0, MAX_HISTORY_ITEMS)),
  )
}

export function deleteCvAnalysis(item, userId) {
  const resolvedUserId = getResolvedUserId(userId || item?.userId)
  const key = getCvHistoryKey(item)

  if (!key) {
    return {
      cvAnalysis: loadCvAnalysis(resolvedUserId),
      cvHistory: loadCvHistory(resolvedUserId),
    }
  }

  const currentAnalysis = loadCvAnalysis(resolvedUserId)
  rememberDeletedCvKey(key, resolvedUserId)

  const nextHistory = loadCvHistory(resolvedUserId)
  const nextAnalysis = getCvHistoryKey(currentAnalysis) === key
    ? nextHistory[0] || null
    : currentAnalysis

  saveCvHistory(nextHistory, resolvedUserId)

  if (nextAnalysis) {
    window.localStorage.setItem(getUserStorageKey(CV_STORAGE_KEY, resolvedUserId), JSON.stringify(nextAnalysis))
  } else {
    window.localStorage.removeItem(getUserStorageKey(CV_STORAGE_KEY, resolvedUserId))
  }

  return {
    cvAnalysis: nextAnalysis,
    cvHistory: nextHistory,
  }
}

export function isCvHistoryItemDeleted(item, userId) {
  const key = getCvHistoryKey(item)

  if (!key) {
    return false
  }

  return loadDeletedCvKeys(userId || item?.userId).includes(key)
}

export function getCvHistoryKey(item) {
  if (!item) {
    return ''
  }

  return item?.cvId || `${item?.fileName || 'cv'}-${getCvHistoryDate(item)}`
}

export function validateCvFile(file) {
  if (!file) {
    return 'Please choose a CV file first.'
  }

  const extension = getFileExtension(file.name)
  const hasValidExtension = ALLOWED_EXTENSIONS.includes(extension)
  const hasValidType = ALLOWED_TYPES.includes(file.type) || file.type === ''

  if (!hasValidExtension || !hasValidType) {
    return 'Only PDF, DOC, or DOCX files are supported.'
  }

  if (file.size > MAX_CV_SIZE) {
    return 'Maximum file size is 10 MB.'
  }

  return ''
}

export function createMockCvAnalysis(file) {
  const uploadedAt = new Date().toISOString()
  const fileName = file.name
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const scoreOffset = Math.min(Math.round(file.size / 400000), 8)
  const cvScore = Math.max(78, 91 - scoreOffset)

  return {
    cvId: createId(),
    fileName,
    fileSize: file.size,
    uploadedAt,
    cvScore,
    suggestedPosition: 'Frontend Developer Intern',
    summary: `${baseName} was parsed successfully and is ready for AI interview generation.`,
    skills: ['React', 'JavaScript', 'Python', 'REST APIs', 'NoSQL Database', 'AI Integration'],
    projects: ['Talent-Graph AI', 'CV Analysis Dashboard', 'Voice Interview Flow'],
    experience: ['Frontend development', 'API integration', 'Cloud fundamentals'],
    certificates: ['Cloud fundamentals - planned', 'React fundamentals'],
    recommendation:
      'Focus on API error handling, database query design, and concise system design explanations before starting the next interview.',
    talentScores: [
      { label: 'React', score: 88 },
      { label: 'Python', score: 76 },
      { label: 'Cloud', score: 72 },
      { label: 'Database', score: 68 },
      { label: 'Communication', score: 82 },
      { label: 'Problem Solving', score: 79 },
    ],
    skillGroups: [
      { label: 'Frontend', value: 88, skills: 'React, JavaScript, Vite', tone: 'purple' },
      { label: 'Backend', value: 76, skills: 'Python, REST APIs, services', tone: 'blue' },
      { label: 'Cloud', value: 72, skills: 'Storage, AI services, database', tone: 'orange' },
      { label: 'Communication', value: 82, skills: 'Clear answers, steady flow', tone: 'green' },
    ],
  }
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatUploadDate(value) {
  if (!value) return 'Not analyzed yet'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function getFileExtension(fileName) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `cv-${Date.now()}`
}

function upsertHistoryItem(items, item, getKey) {
  if (!item) {
    return items
  }

  const key = getKey(item)
  const nextItems = [item, ...items.filter((current) => getKey(current) !== key)]

  return nextItems.slice(0, MAX_HISTORY_ITEMS)
}

function getCvHistoryDate(item) {
  return item?.uploadedAt || item?.analyzedAt || item?.updatedAt || item?.createdAt || ''
}

function loadDeletedCvKeys(userId) {
  try {
    const stored = window.localStorage.getItem(getUserStorageKey(CV_DELETED_KEY, userId))
    const keys = stored ? JSON.parse(stored) : []

    return Array.isArray(keys) ? keys : []
  } catch {
    return []
  }
}

function saveDeletedCvKeys(keys, userId) {
  window.localStorage.setItem(
    getUserStorageKey(CV_DELETED_KEY, userId),
    JSON.stringify(Array.from(new Set(keys.filter(Boolean))).slice(0, MAX_DELETED_ITEMS)),
  )
}

function rememberDeletedCvKey(key, userId) {
  if (!key) {
    return
  }

  saveDeletedCvKeys([key, ...loadDeletedCvKeys(userId)], userId)
}

function forgetDeletedCvKey(key, userId) {
  if (!key) {
    return
  }

  saveDeletedCvKeys(loadDeletedCvKeys(userId).filter((item) => item !== key), userId)
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
