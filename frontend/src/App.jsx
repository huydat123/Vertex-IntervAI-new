import { useState } from 'react'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import History from './pages/History/History.jsx'
import Interview from './pages/Interview/Interview.jsx'
import Login from './pages/Login/Login.jsx'
import Profile from './pages/Profile/Profile.jsx'
import UploadCV from './pages/UploadCV/UploadCV.jsx'
import { loadAuthUser, logoutAuthUser } from './services/authService.js'
import { loadCvAnalysis, loadCvHistory } from './services/cvStorage.js'
import { loadInterviewHistory, loadInterviewResult } from './services/interviewStorage.js'

const availablePages = ['dashboard', 'upload-cv', 'interview', 'history', 'profile']

function App() {
  const [currentUser, setCurrentUser] = useState(() => loadAuthUser())
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [cvAnalysis, setCvAnalysis] = useState(() => loadCvAnalysis())
  const [interviewResult, setInterviewResult] = useState(() => loadInterviewResult())
  const [cvHistory, setCvHistory] = useState(() => loadCvHistory())
  const [interviewHistory, setInterviewHistory] = useState(() => loadInterviewHistory())

  function handleNavigate(page) {
    const resolvedPage = page === 'result' ? 'history' : page

    if (availablePages.includes(resolvedPage)) {
      setCurrentPage(resolvedPage)
    }
  }

  function handleUploadComplete(analysis) {
    setCvAnalysis(analysis)
    setCvHistory(loadCvHistory())
  }

  function handleInterviewComplete(result) {
    setInterviewResult(result)
    setInterviewHistory(loadInterviewHistory())
  }

  function handleLogin(user) {
    setCurrentUser(user)
    setCurrentPage('dashboard')
  }

  function handleLogout() {
    logoutAuthUser()
    setCurrentUser(null)
    setCurrentPage('dashboard')
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />
  }

  if (currentPage === 'upload-cv') {
    return (
      <UploadCV
        cvAnalysis={cvAnalysis}
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onUploadComplete={handleUploadComplete}
      />
    )
  }

  if (currentPage === 'interview') {
    return (
      <Interview
        cvAnalysis={cvAnalysis}
        currentUser={currentUser}
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
        onNavigate={handleNavigate}
        onLogout={handleLogout}
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
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    />
  )
}

export default App
