import { authFetch } from './apiClient.js'

const DEFAULT_PROFILE_API_URL =
  'https://j3zljogo3j.execute-api.ap-southeast-1.amazonaws.com/default/profile'

const PROFILE_API_URL = import.meta.env.VITE_PROFILE_API_URL || DEFAULT_PROFILE_API_URL
const DEMO_USER_ID = 'user_demo_001'

export async function getProfileFromAws(userId = DEMO_USER_ID) {
  const response = await authFetch(`${PROFILE_API_URL}?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.message || data.error || `Load profile failed with status ${response.status}`)
  }

  return data.profile || data
}

export async function saveProfileToAws(profile, userId = DEMO_USER_ID) {
  const response = await authFetch(PROFILE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      ...profile,
    }),
  })

  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.message || data.error || `Save profile failed with status ${response.status}`)
  }

  return data.profile || data
}

async function parseJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}
