const AUTH_STORAGE_KEY = 'talentGraph.authUser'

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

export function loginWithDemoAccount(email, password) {
  const normalizedEmail = email.trim().toLowerCase()
  const account = demoAccounts.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password,
  )

  if (!account) {
    throw new Error('Email or password is not correct.')
  }

  const { password: _password, ...safeUser } = account
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeUser))
  return safeUser
}

export function logoutAuthUser() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}
