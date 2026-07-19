import { authFetch } from './apiClient.js'

const DEFAULT_ADMIN_API_BASE_URL =
  import.meta.env.VITE_INTERVIEW_API_BASE_URL
  || 'https://j3zljogo3j.execute-api.ap-southeast-1.amazonaws.com/default'

const ADMIN_API_BASE_URL = import.meta.env.VITE_ADMIN_API_BASE_URL || DEFAULT_ADMIN_API_BASE_URL

export async function getAdminSummary() {
  return callAdminApi('/admin/summary')
}

export async function getAdminUsers() {
  const data = await callAdminApi('/admin/users')
  return {
    users: Array.isArray(data.users) ? data.users : [],
    source: data.source || 'unknown',
    diagnostics: data.diagnostics || {},
    tableDiagnostics: data.tableDiagnostics || {},
  }
}

export async function getAdminCvs() {
  const data = await callAdminApi('/admin/cvs')
  return Array.isArray(data.cvs) ? data.cvs : []
}

export async function getAdminInterviews() {
  const data = await callAdminApi('/admin/interviews')
  return Array.isArray(data.interviews) ? data.interviews : []
}

export async function getAdminReviewQueue() {
  const data = await callAdminApi('/admin/review-queue')
  return Array.isArray(data.reviewItems) ? data.reviewItems : []
}

export async function getAdminAuditLogs() {
  const data = await callAdminApi('/admin/audit')
  return {
    auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
    diagnostics: data.auditDiagnostics || {},
  }
}

export async function createCvPresignedUrl({ userId, cvId }) {
  return callAdminApi('/admin/cvs/presign', {
    method: 'POST',
    body: {
      userId,
      cvId,
    },
  })
}

export async function generateReviewSummary({ userId = '' } = {}) {
  return callAdminApi('/admin/review-summary', {
    method: 'POST',
    body: {
      userId,
    },
  })
}

export async function exportAdminCsv(dataset) {
  return callAdminApi('/admin/export', {
    method: 'POST',
    body: {
      dataset,
    },
  })
}

export async function sendFeedbackEmail({ userId, recipientEmail, subject, message }) {
  return callAdminApi('/admin/feedback/email', {
    method: 'POST',
    body: {
      userId,
      recipientEmail,
      subject,
      message,
    },
  })
}

async function callAdminApi(path, options = {}) {
  let response
  const method = options.method || 'GET'
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const fetchOptions = {
    method,
    headers,
  }

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  try {
    response = await authFetch(`${ADMIN_API_BASE_URL}${path}`, fetchOptions)
  } catch {
    throw new Error('Cannot connect to admin API. Check API Gateway route, JWT authorizer, and Lambda integration.')
  }

  const data = await parseJsonResponse(response)

  if (!response.ok) {
    const details = [data.message, data.error || data.sesErrorMessage]
      .filter(Boolean)
      .filter((item, index, items) => items.indexOf(item) === index)
      .join(': ')

    throw new Error(details || `Admin API failed with status ${response.status}`)
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
