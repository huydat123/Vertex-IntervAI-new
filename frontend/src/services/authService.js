const AUTH_STORAGE_KEY = 'talentGraph.authUser'
const TOKEN_STORAGE_KEY = 'talentGraph.authTokens'
const PKCE_STORAGE_KEY = 'talentGraph.pkceVerifier'
const OAUTH_STATE_KEY = 'talentGraph.oauthState'

const COGNITO_DOMAIN = normalizeCognitoDomain(import.meta.env.VITE_COGNITO_DOMAIN)
const COGNITO_CLIENT_ID = trimValue(import.meta.env.VITE_COGNITO_CLIENT_ID)
const COGNITO_REDIRECT_URI = trimValue(import.meta.env.VITE_COGNITO_REDIRECT_URI) || window.location.origin
const COGNITO_LOGOUT_URI = trimValue(import.meta.env.VITE_COGNITO_LOGOUT_URI) || window.location.origin
const COGNITO_SCOPES = trimValue(import.meta.env.VITE_COGNITO_SCOPES) || 'openid email profile phone'

let cognitoRedirectPromise = null

export const demoAccounts = [
  {
    userId: 'user_demo_001',
    fullName: 'Nguyen Huy Dat',
    email: 'user@talentgraph.ai',
    password: 'user123',
    role: 'user',
    initials: 'HD',
  },
  {
    userId: 'admin_demo_001',
    fullName: 'Admin Talent Graph',
    email: 'admin@talentgraph.ai',
    password: 'admin123',
    role: 'admin',
    initials: 'AD',
  },
]

export function loadAuthUser() {
  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function saveAuthUser(user) {
  if (!user) {
    return null
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  return user
}

export function mergeAuthUserProfile(user, profile) {
  const fullName = trimValue(profile?.fullName) || trimValue(user?.fullName) || ''
  const email = trimValue(profile?.email) || user?.email || ''
  const phone = trimValue(profile?.phone) || user?.phone || ''
  const avatarUrl = trimValue(profile?.avatarUrl) || user?.avatarUrl || ''

  return {
    ...user,
    fullName,
    email,
    phone,
    avatarUrl,
    initials: getInitials(fullName || email),
  }
}

export function loginWithDemoAccount(email, password) {
  const normalizedEmail = email.trim().toLowerCase()
  const account = demoAccounts.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password,
  )

  if (!account) {
    throw new Error('Email or password is not correct.')
  }

  const { password: _password, ...safeUser } = account
  saveAuthUser(safeUser)
  return safeUser
}

export function logoutAuthUser({ redirect = false } = {}) {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.sessionStorage.removeItem(PKCE_STORAGE_KEY)
  window.sessionStorage.removeItem(OAUTH_STATE_KEY)

  if (redirect && isCognitoConfigured()) {
    const logoutUrl = new URL(`${COGNITO_DOMAIN}/logout`)
    logoutUrl.searchParams.set('client_id', COGNITO_CLIENT_ID)
    logoutUrl.searchParams.set('logout_uri', COGNITO_LOGOUT_URI)
    window.location.assign(logoutUrl.toString())
  }
}

export function isCognitoConfigured() {
  return Boolean(COGNITO_DOMAIN && COGNITO_CLIENT_ID)
}

export function hasCognitoCallback() {
  const params = new URLSearchParams(window.location.search)
  return params.has('code') || params.has('error')
}

export async function startCognitoLogin({ onRedirectUrl } = {}) {
  const loginUrl = await prepareCognitoLogin()

  onRedirectUrl?.(loginUrl)
  window.location.href = loginUrl
  return loginUrl
}

export async function prepareCognitoLogin() {
  if (!isCognitoConfigured()) {
    throw new Error('Secure sign-in is not configured yet.')
  }

  const codeVerifier = createCodeVerifier()
  const codeChallenge = await createCodeChallenge(codeVerifier)
  const state = createRandomString(24)

  window.sessionStorage.setItem(PKCE_STORAGE_KEY, codeVerifier)
  window.sessionStorage.setItem(OAUTH_STATE_KEY, state)

  const authUrl = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', COGNITO_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', COGNITO_REDIRECT_URI)
  authUrl.searchParams.set('scope', COGNITO_SCOPES)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('identity_provider', 'COGNITO')

  return authUrl.toString()
}

export async function completeCognitoRedirectIfNeeded() {
  if (!isCognitoConfigured() || !hasCognitoCallback()) {
    return null
  }

  cognitoRedirectPromise = cognitoRedirectPromise || completeCognitoRedirect()
  return cognitoRedirectPromise
}

async function completeCognitoRedirect() {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')

  if (error) {
    cleanOAuthParams()
    throw new Error(params.get('error_description') || error)
  }

  const code = params.get('code')
  const state = params.get('state')
  const expectedState = window.sessionStorage.getItem(OAUTH_STATE_KEY)
  const codeVerifier = window.sessionStorage.getItem(PKCE_STORAGE_KEY)

  if (!code || !codeVerifier || !expectedState || state !== expectedState) {
    cleanOAuthParams()
    throw new Error('The sign-in callback is invalid. Please try signing in again.')
  }

  const tokenData = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: COGNITO_REDIRECT_URI,
    code_verifier: codeVerifier,
  })
  const user = storeTokenSession(tokenData)

  cleanOAuthParams()
  return user
}

export async function getAuthHeaders() {
  const token = await getAccessToken()

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

async function getAccessToken() {
  const tokens = loadTokens()

  if (!tokens?.accessToken) {
    return ''
  }

  if (!tokens.expiresAt || Date.now() < tokens.expiresAt - 60000) {
    return tokens.accessToken
  }

  if (!tokens.refreshToken || !isCognitoConfigured()) {
    logoutAuthUser()
    return ''
  }

  try {
    const tokenData = await requestToken({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    })
    const refreshedTokens = {
      ...tokenData,
      refresh_token: tokenData.refresh_token || tokens.refreshToken,
    }
    storeTokenSession(refreshedTokens)
    return refreshedTokens.access_token || ''
  } catch {
    logoutAuthUser()
    return ''
  }
}

async function requestToken(params) {
  const body = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    ...params,
  })
  const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Could not complete secure sign-in.')
  }

  return data
}

function storeTokenSession(tokenData) {
  const idClaims = parseJwt(tokenData.id_token)
  const accessClaims = parseJwt(tokenData.access_token)
  const user = buildUserFromClaims(idClaims, accessClaims)
  const tokens = {
    idToken: tokenData.id_token,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  saveAuthUser(user)
  return user
}

function loadTokens() {
  try {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function buildUserFromClaims(idClaims, accessClaims) {
  const claims = {
    ...accessClaims,
    ...idClaims,
  }
  const groups = normalizeGroups(claims['cognito:groups'])
  const email = claims.email || claims.username || claims['cognito:username'] || ''
  const claimFullName = claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ')
  const fullName = claimFullName || claims.nickname || ''
  const phone = claims.phone_number || ''
  const avatarUrl = claims.picture || ''
  const role = claims['custom:role'] || (groups.includes('admin') ? 'admin' : 'user')

  return {
    userId: claims.sub || claims.username || claims['cognito:username'] || email || 'cognito_user',
    fullName,
    email,
    phone,
    avatarUrl,
    role,
    groups,
    initials: getInitials(fullName || email),
    authProvider: 'cognito',
  }
}

function normalizeGroups(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).toLowerCase())
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  }

  return []
}

function parseJwt(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return {}
  }

  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
    const bytes = Uint8Array.from(window.atob(padded), (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return {}
  }
}

function cleanOAuthParams() {
  window.sessionStorage.removeItem(PKCE_STORAGE_KEY)
  window.sessionStorage.removeItem(OAUTH_STATE_KEY)
  window.history.replaceState({}, document.title, window.location.pathname + window.location.hash)
}

function normalizeCognitoDomain(value) {
  const domain = trimValue(value)

  if (!domain) {
    return ''
  }

  return domain.startsWith('https://') ? domain.replace(/\/+$/, '') : `https://${domain.replace(/\/+$/, '')}`
}

function trimValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getInitials(value) {
  const parts = String(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'CU'
}

function createCodeVerifier() {
  return createRandomString(64)
}

function createRandomString(length) {
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function createCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

function base64UrlEncode(bytes) {
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
