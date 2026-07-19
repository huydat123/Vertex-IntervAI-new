import { authFetch } from './apiClient.js'

const DEFAULT_HISTORY_API_URL =
  'https://j3zljogo3j.execute-api.ap-southeast-1.amazonaws.com/default/history'

const HISTORY_API_URL = import.meta.env.VITE_HISTORY_API_URL || DEFAULT_HISTORY_API_URL
const DEMO_USER_ID = 'user_demo_001'

export async function getHistoryFromAws(userId = DEMO_USER_ID) {
  const response = await authFetch(`${HISTORY_API_URL}?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.message || data.error || `Load history failed with status ${response.status}`)
  }

  return {
    cvHistory: Array.isArray(data.cvHistory) ? data.cvHistory : [],
    interviewHistory: Array.isArray(data.interviewHistory) ? data.interviewHistory : [],
  }
}

async function parseJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}
