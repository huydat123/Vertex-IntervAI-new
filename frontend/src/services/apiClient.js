import { getAuthHeaders } from './authService.js'

export async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {})
  const authHeaders = await getAuthHeaders()

  Object.entries(authHeaders).forEach(([key, value]) => {
    if (!headers.has(key)) {
      headers.set(key, value)
    }
  })

  return fetch(url, {
    ...options,
    headers,
  })
}
