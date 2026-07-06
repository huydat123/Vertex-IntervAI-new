import { useState } from 'react'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import Interview from './pages/Interview/Interview.jsx'
import Login from './pages/Login/Login.jsx'
import Profile from './pages/Profile/Profile.jsx'
import UploadCV from './pages/UploadCV/UploadCV.jsx'
import { loadAuthUser, logoutAuthUser } from './services/authService.js'
import { loadCvAnalysis } from './services/cvStorage.js'

const availablePages = ['dashboard', 'upload-cv', 'interview', 'profile']

function App() {
  const [currentUser, setCurrentUser] = useState(() => loadAuthUser())
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [cvAnalysis, setCvAnalysis] = useState(() => loadCvAnalysis())

  function handleNavigate(page) {
    if (availablePages.includes(page)) {
      setCurrentPage(page)
    }
  }

  function handleUploadComplete(analysis) {
    setCvAnalysis(analysis)
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

  return (
    <Dashboard
      cvAnalysis={cvAnalysis}
      currentUser={currentUser}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    />
  )
}

export default App
