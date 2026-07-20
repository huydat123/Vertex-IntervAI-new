import { useCallback, useEffect, useState } from 'react'
import Admin from './pages/Admin/Admin.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import History from './pages/History/History.jsx'
import Interview from './pages/Interview/Interview.jsx'
import Login from './pages/Login/Login.jsx'
import Profile from './pages/Profile/Profile.jsx'
import Result from './pages/Result/Result.jsx'
import Settings from './pages/Settings/Settings.jsx'
import UploadCV from './pages/UploadCV/UploadCV.jsx'
import {
  completeCognitoRedirectIfNeeded,
  hasCognitoCallback,
  loadAuthUser,
  logoutAuthUser,
  mergeAuthUserProfile,
  saveAuthUser,
} from './services/authService.js'
import {
  deleteCvAnalysis,
  isCvHistoryItemDeleted,
  loadCvAnalysis,
  loadCvHistory,
  saveCvHistory,
} from './services/cvStorage.js'
import { getHistoryFromAws } from './services/historyApi.js'
import {
  loadInterviewHistory,
  loadInterviewResult,
  saveInterviewHistory,
} from './services/interviewStorage.js'
import { normalizeLanguage } from './services/language.js'
import { loadSettings, saveSettings } from './services/settingsStorage.js'
import './App.css'
import './theme.css'

const availablePages = ['dashboard', 'upload-cv', 'interview', 'result', 'history', 'profile', 'settings', 'admin']

function App() {
  const [initialAuthState] = useState(() => {
    const user = prepareAuthUser(loadAuthUser())

    return {
      user,
      page: getLandingPage(user),
    }
  })
  const initialUserId = initialAuthState.user?.userId
  const [currentUser, setCurrentUser] = useState(initialAuthState.user)
  const [isResolvingAuth, setIsResolvingAuth] = useState(() => hasCognitoCallback())
  const [currentPage, setCurrentPage] = useState(initialAuthState.page)
  const [cvAnalysis, setCvAnalysis] = useState(() => loadCvAnalysis(initialUserId))
  const [interviewResult, setInterviewResult] = useState(() => loadInterviewResult(initialUserId))
  const [cvHistory, setCvHistory] = useState(() => loadCvHistory(initialUserId))
  const [interviewHistory, setInterviewHistory] = useState(() => loadInterviewHistory(initialUserId))
  const [authError, setAuthError] = useState('')
  const [colorTheme, setColorTheme] = useState(() => normalizeColorTheme(loadSettings().colorTheme))
  const [appLanguage, setAppLanguage] = useState(() => normalizeLanguage(loadSettings().language))

  useEffect(() => {
    document.body.classList.toggle('theme-black', colorTheme === 'black')
    document.body.dataset.theme = colorTheme

    return () => {
      document.body.classList.remove('theme-black')
      delete document.body.dataset.theme
    }
  }, [colorTheme])

  useEffect(() => {
    document.documentElement.lang = appLanguage === 'vi' ? 'vi' : 'en'
  }, [appLanguage])

  useEffect(() => {
    let isMounted = true

    async function completeLogin() {
      try {
        const user = await completeCognitoRedirectIfNeeded()

        if (isMounted && user) {
          const nextUser = prepareAuthUser(user)
          setCurrentUser(nextUser)
          setCurrentPage(getLandingPage(nextUser))
        }
      } catch (error) {
        if (isMounted) {
          setAuthError(
            error.message
              || 'Secure sign-in could not be completed. Please check the login configuration and try again.',
          )
          setCurrentUser(null)
        }
      } finally {
        if (isMounted) {
          setIsResolvingAuth(false)
        }
      }
    }

    if (hasCognitoCallback()) {
      completeLogin()
    } else {
      setIsResolvingAuth(false)
    }

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setCvAnalysis(null)
      setInterviewResult(null)
      setCvHistory([])
      setInterviewHistory([])
      return
    }

    const userId = currentUser.userId
    setCvAnalysis(loadCvAnalysis(userId))
    setInterviewResult(loadInterviewResult(userId))
    setCvHistory(loadCvHistory(userId))
    setInterviewHistory(loadInterviewHistory(userId))
    refreshAwsHistory(currentUser)
  }, [currentUser])

  useEffect(() => {
    if (isAdminUser(currentUser) && currentPage !== 'admin') {
      setCurrentPage('admin')
    }
  }, [currentUser, currentPage])

  function handleNavigate(page) {
    const resolvedPage = page

    if (isAdminUser(currentUser) && resolvedPage !== 'admin') {
      setCurrentPage('admin')
      return
    }

    if (resolvedPage === 'admin' && !isAdminUser(currentUser)) {
      setCurrentPage('dashboard')
      return
    }

    if (availablePages.includes(resolvedPage)) {
      setCurrentPage(resolvedPage)
    }
  }

  function handleUploadComplete(analysis) {
    setCvAnalysis(analysis)
    setCvHistory(loadCvHistory(currentUser?.userId))
    refreshAwsHistory(currentUser)
  }

  function handleInterviewComplete(result) {
    setInterviewResult(result)
    setInterviewHistory(loadInterviewHistory(currentUser?.userId))
    refreshAwsHistory(currentUser)
  }

  function handleDeleteCv(item) {
    if (!currentUser) {
      return
    }

    const nextCvState = deleteCvAnalysis(item, currentUser.userId)
    setCvAnalysis(nextCvState.cvAnalysis)
    setCvHistory(nextCvState.cvHistory)
  }

  function handleLogin(user) {
    const nextUser = prepareAuthUser(user)
    setAuthError('')
    setCurrentUser(nextUser)
    setCurrentPage(getLandingPage(nextUser))
  }

  const handleProfileUpdate = useCallback((profile) => {
    setCurrentUser((current) => {
      if (!current) {
        return current
      }

      return saveAuthUser(mergeAuthUserProfile(current, profile))
    })
  }, [])

  const handleThemeChange = useCallback((theme) => {
    const nextSettings = saveSettings({
      ...loadSettings(),
      colorTheme: normalizeColorTheme(theme),
    })

    setColorTheme(normalizeColorTheme(nextSettings.colorTheme))
  }, [])

  const handleLanguageChange = useCallback((language) => {
    const nextSettings = saveSettings({
      ...loadSettings(),
      language: normalizeLanguage(language),
    })

    setAppLanguage(normalizeLanguage(nextSettings.language))
  }, [])

  const preferenceProps = {
    language: appLanguage,
    colorTheme,
    onLanguageChange: handleLanguageChange,
    onThemeChange: handleThemeChange,
  }

  function handleLogout() {
    logoutAuthUser({ redirect: currentUser?.authProvider === 'cognito' })
    setCurrentUser(null)
    setCvAnalysis(null)
    setInterviewResult(null)
    setCvHistory([])
    setInterviewHistory([])
    setCurrentPage('dashboard')
  }

  async function refreshAwsHistory(user = currentUser) {
    if (!user) {
      return
    }

    try {
      const history = await getHistoryFromAws(user.userId)
      const mergedCvHistory = mergeHistoryItems(
        loadCvHistory(user.userId),
        history.cvHistory,
        getCvHistoryKey,
        getCvHistoryDate,
      )
      const mergedInterviewHistory = mergeHistoryItems(
        loadInterviewHistory(user.userId),
        history.interviewHistory,
        getInterviewHistoryKey,
        getInterviewHistoryDate,
      )

      const visibleCvHistory = mergedCvHistory.filter((item) => !isCvHistoryItemDeleted(item, user.userId))

      saveCvHistory(visibleCvHistory, user.userId)
      saveInterviewHistory(mergedInterviewHistory, user.userId)
      setCvHistory(visibleCvHistory)
      setInterviewHistory(mergedInterviewHistory)
    } catch {
      setCvHistory(loadCvHistory(user.userId))
      setInterviewHistory(loadInterviewHistory(user.userId))
    }
  }

  if (isResolvingAuth) {
    return (
      <main className="auth-loading-page">
        <div>
          <strong>Signing you in...</strong>
          <span>Preparing secure sign-in</span>
        </div>
      </main>
    )
  }

  if (!currentUser) {
    return <Login authError={authError} onLogin={handleLogin} {...preferenceProps} />
  }

  if (currentPage === 'upload-cv') {
    return (
      <UploadCV
        cvAnalysis={cvAnalysis}
        cvHistory={cvHistory}
        currentUser={currentUser}
        {...preferenceProps}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onUploadComplete={handleUploadComplete}
        onDeleteCv={handleDeleteCv}
      />
    )
  }

  if (currentPage === 'interview') {
    return (
      <Interview
        cvAnalysis={cvAnalysis}
        currentUser={currentUser}
        {...preferenceProps}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onInterviewComplete={handleInterviewComplete}
      />
    )
  }

  if (currentPage === 'profile') {
    return (
      <Profile
        cvAnalysis={cvAnalysis}
        currentUser={currentUser}
        {...preferenceProps}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onProfileUpdate={handleProfileUpdate}
      />
    )
  }

  if (currentPage === 'history') {
    return (
      <History
        cvAnalysis={cvAnalysis}
        cvHistory={cvHistory}
        interviewResult={interviewResult}
        interviewHistory={interviewHistory}
        currentUser={currentUser}
        {...preferenceProps}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onDeleteCv={handleDeleteCv}
      />
    )
  }

  if (currentPage === 'result') {
    return (
      <Result
        cvAnalysis={cvAnalysis}
        cvHistory={cvHistory}
        interviewResult={interviewResult}
        interviewHistory={interviewHistory}
        currentUser={currentUser}
        {...preferenceProps}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
    )
  }

  if (currentPage === 'settings') {
    return (
      <Settings
        currentUser={currentUser}
        {...preferenceProps}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onThemeChange={handleThemeChange}
        onLanguageChange={handleLanguageChange}
      />
    )
  }

  if (currentPage === 'admin') {
    return (
      <Admin
        currentUser={currentUser}
        {...preferenceProps}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <Dashboard
      cvAnalysis={cvAnalysis}
      cvHistory={cvHistory}
      interviewResult={interviewResult}
      interviewHistory={interviewHistory}
      currentUser={currentUser}
      {...preferenceProps}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      onDeleteCv={handleDeleteCv}
    />
  )
}

function isAdminUser(user) {
  return user?.role === 'admin' || user?.groups?.includes?.('admin')
}

function getLandingPage(user) {
  return isAdminUser(user) ? 'admin' : 'dashboard'
}

function prepareAuthUser(user) {
  return user
    ? saveAuthUser(mergeAuthUserProfile(user, loadStoredProfile(user.userId)))
    : null
}

function normalizeColorTheme(theme) {
  return theme === 'black' ? 'black' : 'current'
}

function loadStoredProfile(userId) {
  if (!userId) {
    return {}
  }

  try {
    const stored = window.localStorage.getItem(`talentGraph.profile.${userId}`)
    return stored ? sanitizeStoredProfile(JSON.parse(stored)) : {}
  } catch {
    return {}
  }
}

function sanitizeStoredProfile(profile) {
  const sanitized = { ...(profile || {}) }
  const legacyValues = {
    fullName: 'Nguyen Huy Dat',
    headline: 'Frontend Developer Intern',
    email: 'huydat@example.com',
    phone: '+84 901 234 567',
    location: 'Ho Chi Minh City, Vietnam',
    university: 'Software Engineering Student',
    github: 'github.com/huydat123',
    linkedin: 'linkedin.com/in/huydat',
    portfolio: 'vertex-intervai.vercel.app',
    goal: 'Build a strong AI interview platform and prepare for frontend/cloud internship roles.',
  }

  Object.entries(legacyValues).forEach(([field, legacyValue]) => {
    if (sanitized[field] === legacyValue) {
      sanitized[field] = ''
    }
  })

  return sanitized
}

function mergeHistoryItems(localItems, remoteItems, getKey, getDate) {
  const merged = new Map()

  ;[...(Array.isArray(remoteItems) ? remoteItems : []), ...(Array.isArray(localItems) ? localItems : [])]
    .filter(Boolean)
    .forEach((item) => {
      const key = getKey(item)

      if (!key) {
        return
      }

      merged.set(key, {
        ...(merged.get(key) || {}),
        ...item,
      })
    })

  return Array.from(merged.values()).sort((first, second) => (
    new Date(getDate(second) || 0) - new Date(getDate(first) || 0)
  ))
}

function getCvHistoryKey(item) {
  return item?.cvId || `${item?.fileName || 'cv'}-${getCvHistoryDate(item)}`
}

function getCvHistoryDate(item) {
  return item?.uploadedAt || item?.analyzedAt || item?.updatedAt || item?.createdAt || ''
}

function getInterviewHistoryKey(item) {
  return item?.interviewId || `${item?.role || 'interview'}-${getInterviewHistoryDate(item)}`
}

function getInterviewHistoryDate(item) {
  return item?.completedAt || item?.updatedAt || item?.createdAt || ''
}

export default App
