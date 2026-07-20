import { useEffect, useMemo, useRef, useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import { formatFileSize, formatUploadDate } from '../../services/cvStorage.js'
import { getAppCopy } from '../../services/i18n.js'
import { getProfileFromAws, saveProfileToAws } from '../../services/profileApi.js'
import '../Dashboard/Dashboard.css'
import './Profile.css'

const PROFILE_STORAGE_KEY = 'talentGraph.profile'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
]

const defaultProfile = {
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  avatarUrl: '',
  location: '',
  university: '',
  github: '',
  linkedin: '',
  portfolio: '',
  goal: '',
}

const fallbackUser = {
  userId: 'anonymous_user',
  fullName: '',
  email: '',
  phone: '',
  avatarUrl: '',
  initials: 'U',
  role: 'user',
}

export default function Profile({
  cvAnalysis,
  currentUser = fallbackUser,
  language = 'en',
  colorTheme = 'black',
  onLanguageChange = () => {},
  onThemeChange = () => {},
  onNavigate = () => {},
  onLogout = () => {},
  onProfileUpdate = () => {},
}) {
  const appCopy = getAppCopy(language)
  const copy = appCopy.profile
  const didSyncLocalProfileRef = useRef(false)
  const [profile, setProfile] = useState(() => loadProfile(currentUser))
  const [isEditing, setIsEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [syncStatus, setSyncStatus] = useState(copy.localProfile)
  const [avatarError, setAvatarError] = useState('')
  const analysis = cvAnalysis ?? null
  const displayUser = getDisplayUser(currentUser, profile)

  useEffect(() => {
    if (didSyncLocalProfileRef.current) {
      return
    }

    didSyncLocalProfileRef.current = true
    onProfileUpdate(profile)
  }, [onProfileUpdate, profile])

  useEffect(() => {
    let isMounted = true

    async function loadAwsProfile() {
      try {
        const awsProfile = await getProfileFromAws(currentUser.userId)

        if (!isMounted) return

        setProfile((current) => {
          const nextProfile = normalizeProfile({ ...current, ...awsProfile }, currentUser)
          onProfileUpdate(nextProfile)
          return nextProfile
        })
        setSyncStatus(copy.syncedAws)
      } catch {
        if (isMounted) {
          setSyncStatus(copy.savedLocal)
        }
      }
    }

    loadAwsProfile()

    return () => {
      isMounted = false
    }
  }, [copy, currentUser.userId, onProfileUpdate])

  const topSkills = useMemo(() => {
    const fromAnalysis = analysis?.skills?.slice(0, 8)
    return fromAnalysis?.length ? fromAnalysis : []
  }, [analysis])
  const readinessItems = useMemo(() => createReadinessItems(profile, analysis), [analysis, profile])

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    const profileToSave = {
      ...trimProfile(profile),
    }
    let finalProfile = profileToSave

    window.localStorage.setItem(getProfileStorageKey(currentUser.userId), JSON.stringify(profileToSave))

    try {
      const savedProfile = await saveProfileToAws(profileToSave, currentUser.userId)
      finalProfile = { ...profileToSave, ...savedProfile }
      window.localStorage.setItem(getProfileStorageKey(currentUser.userId), JSON.stringify(finalProfile))
      setProfile(finalProfile)
      setSyncStatus(copy.savedAws)
    } catch {
      setSyncStatus(copy.savedLocal)
    } finally {
      setProfile(finalProfile)
      onProfileUpdate(finalProfile)
      setIsEditing(false)
      setSaved(true)
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      setAvatarError('')
      const avatarUrl = await readAvatarFile(file, copy)
      updateField('avatarUrl', avatarUrl)
    } catch (error) {
      setAvatarError(error.message)
    }
  }

  function handleRemoveAvatar() {
    setAvatarError('')
    updateField('avatarUrl', '')
  }

  return (
    <div className="dashboard-page profile-page">
      <div className="dashboard-frame">
        <ProfileSidebar appCopy={appCopy} currentPage="profile" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="dashboard-main">
          <header className="topbar">
            <div className="topbar-title">
              <button
                className="icon-button"
                type="button"
                aria-label={appCopy.common.backDashboard}
                title={appCopy.common.backDashboard}
                onClick={() => onNavigate('dashboard')}
              >
                <Icon name="arrowLeft" />
              </button>
              <div>
                <p>{copy.page}</p>
                <h2>{copy.title}</h2>
              </div>
            </div>

            <div className="topbar-actions">
              <PreferenceControls
                colorTheme={colorTheme}
                language={language}
                onLanguageChange={onLanguageChange}
                onThemeChange={onThemeChange}
              />
              <div className="user-chip" aria-label={appCopy.common.currentUser}>
                <span>{displayUser.fullName}</span>
                <small>{displayUser.role}</small>
                <UserAvatar user={displayUser} />
              </div>
            </div>
          </header>

          <div className="dashboard-content profile-content">
            <section className="profile-hero panel">
              <div className="profile-identity">
                <div className="profile-avatar-stack">
                  <UserAvatar user={displayUser} className="profile-avatar" />
                  {isEditing ? (
                    <div className="profile-avatar-actions">
                      <label className="avatar-upload-button">
                        <Icon name="upload" />
                        {copy.uploadPhoto}
                        <input type="file" accept="image/*" onChange={handleAvatarChange} />
                      </label>
                      {profile.avatarUrl ? (
                        <button className="avatar-remove-button" type="button" onClick={handleRemoveAvatar}>
                          <Icon name="trash" />
                          {copy.remove}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {avatarError ? <span className="avatar-error">{avatarError}</span> : null}
                </div>
                <div>
                  <p className="eyebrow">{copy.heroEyebrow}</p>
                  <h1>{profile.fullName || copy.title}</h1>
                  <span>{profile.headline}</span>
                </div>
              </div>

              <div className="profile-actions">
                {saved ? <span className="save-status">{copy.saved}</span> : null}
                <span className="sync-status">{syncStatus}</span>
                <button className="secondary-upload-action" type="button" onClick={() => setIsEditing((value) => !value)}>
                  <Icon name="edit" />
                  {isEditing ? appCopy.common.cancel : copy.editProfile}
                </button>
                <button className="primary-upload-action" type="button" onClick={handleSave}>
                  <Icon name="save" />
                  {appCopy.common.save}
                </button>
              </div>
            </section>

            <section className="profile-grid">
              <div className="panel profile-form-panel">
                <PanelHeader title={copy.personalTitle} description={copy.personalText} />
                <div className="profile-form-grid">
                  <ProfileField label={copy.fields[0]} value={profile.fullName} editing={isEditing} onChange={(value) => updateField('fullName', value)} />
                  <ProfileField label={copy.fields[1]} value={profile.headline} editing={isEditing} onChange={(value) => updateField('headline', value)} />
                  <ProfileField label={copy.fields[2]} value={profile.email} editing={isEditing} onChange={(value) => updateField('email', value)} />
                  <ProfileField label={copy.fields[3]} value={profile.phone} editing={isEditing} onChange={(value) => updateField('phone', value)} />
                  <ProfileField label={copy.fields[4]} value={profile.location} editing={isEditing} onChange={(value) => updateField('location', value)} />
                  <ProfileField label={copy.fields[5]} value={profile.university} editing={isEditing} onChange={(value) => updateField('university', value)} />
                </div>
              </div>

              <aside className="panel readiness-panel">
                <PanelHeader title={copy.readinessTitle} description={copy.readinessText} />
                <div className="readiness-list">
                  {readinessItems.map((item, index) => (
                    <ReadinessBar key={item.label} {...item} label={copy.readinessItems[index] || item.label} />
                  ))}
                </div>
              </aside>

              <div className="panel profile-goal-panel">
                <PanelHeader title={copy.goalTitle} description={copy.goalText} />
                {isEditing ? (
                  <textarea
                    className="profile-textarea"
                    value={profile.goal}
                    onChange={(event) => updateField('goal', event.target.value)}
                    rows="5"
                  />
                ) : (
                  <p>{profile.goal}</p>
                )}
              </div>

              <aside className="panel cv-summary-panel">
                <PanelHeader title={copy.latestCvTitle} description={analysis ? copy.latestCvLinked : copy.latestCvEmpty} />
                <div className="profile-cv-card">
                  <div className="file-icon"><Icon name="file" /></div>
                  <div>
                    <strong>{analysis?.fileName ?? copy.noCv}</strong>
                    <span>
                      {analysis
                        ? `${formatUploadDate(analysis.uploadedAt)} / ${formatFileSize(analysis.fileSize)}`
                        : copy.uploadUnlock}
                    </span>
                  </div>
                </div>
                <div className="profile-score">
                  <strong>{analysis?.cvScore ?? 0}</strong>
                  <span>{copy.cvScore}</span>
                </div>
              </aside>

              <div className="panel skills-panel">
                <PanelHeader title={copy.skillsTitle} description={copy.skillsText} />
                <div className="tag-list profile-tags">
                  {topSkills.map((skill) => <span key={skill}>{skill}</span>)}
                </div>
              </div>

              <aside className="panel links-panel">
                <PanelHeader title={copy.linksTitle} description={copy.linksText} />
                <div className="link-list">
                  <LinkField icon="github" label="GitHub" value={profile.github} editing={isEditing} onChange={(value) => updateField('github', value)} />
                  <LinkField icon="linkedin" label="LinkedIn" value={profile.linkedin} editing={isEditing} onChange={(value) => updateField('linkedin', value)} />
                  <LinkField icon="globe" label="Portfolio" value={profile.portfolio} editing={isEditing} onChange={(value) => updateField('portfolio', value)} />
                </div>
              </aside>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

function getProfileStorageKey(userId) {
  return `${PROFILE_STORAGE_KEY}.${userId}`
}

function loadProfile(currentUser) {
  try {
    const stored = window.localStorage.getItem(getProfileStorageKey(currentUser.userId))
    const baseProfile = createBaseProfile(currentUser)

    return stored
      ? normalizeProfile({ ...baseProfile, ...JSON.parse(stored) }, currentUser)
      : baseProfile
  } catch {
    return createBaseProfile(currentUser)
  }
}

function createBaseProfile(currentUser) {
  return normalizeProfile({
    ...defaultProfile,
    fullName: currentUser.fullName || '',
    email: currentUser.email || '',
    phone: currentUser.phone || '',
    avatarUrl: currentUser.avatarUrl || '',
  }, currentUser)
}

function normalizeProfile(profile, currentUser) {
  return trimProfile(clearLegacyDemoProfile(profile, currentUser))
}

function trimProfile(profile) {
  return Object.fromEntries(
    Object.entries({ ...defaultProfile, ...profile }).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  )
}

function clearLegacyDemoProfile(profile, currentUser) {
  const legacyValues = {
    fullName: currentUser.fullName ? '' : 'Nguyen Huy Dat',
    headline: 'Frontend Developer Intern',
    email: currentUser.email ? '' : 'huydat@example.com',
    phone: currentUser.phone ? '' : '+84 901 234 567',
    location: 'Ho Chi Minh City, Vietnam',
    university: 'Software Engineering Student',
    github: 'github.com/huydat123',
    linkedin: 'linkedin.com/in/huydat',
    portfolio: 'vertex-intervai.vercel.app',
    goal: 'Build a strong AI interview platform and prepare for frontend/cloud internship roles.',
  }
  const nextProfile = { ...profile }

  Object.entries(legacyValues).forEach(([field, legacyValue]) => {
    if (legacyValue && nextProfile[field] === legacyValue) {
      nextProfile[field] = ''
    }
  })

  return nextProfile
}

function getDisplayUser(currentUser, profile) {
  const fullName = profile.fullName?.trim() || currentUser.fullName || ''
  const email = profile.email?.trim() || currentUser.email || ''

  return {
    ...currentUser,
    fullName,
    email,
    phone: profile.phone?.trim() || currentUser.phone || '',
    avatarUrl: profile.avatarUrl || currentUser.avatarUrl || '',
    initials: getInitials(fullName || email),
  }
}

function UserAvatar({ user, className = 'avatar' }) {
  return (
    <div className={className}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.initials}
    </div>
  )
}

function getInitials(value) {
  const parts = String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'U'
}

function readAvatarFile(file, copy) {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error(copy.imageOnly))
  }

  if (file.size > 4 * 1024 * 1024) {
    return Promise.reject(new Error(copy.imageSize))
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const canvas = document.createElement('canvas')
      const size = 256
      const context = canvas.getContext('2d')
      const scale = Math.max(size / image.width, size / image.height)
      const width = image.width * scale
      const height = image.height * scale
      const x = (size - width) / 2
      const y = (size - height) / 2

      canvas.width = size
      canvas.height = size
      context.drawImage(image, x, y, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(copy.imageRead))
    }

    image.src = objectUrl
  })
}

function ProfileSidebar({ appCopy, currentPage, onNavigate, onLogout }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <div className="brand-mark"><Icon name="brain" /></div>
        <div>
          <strong>Vertex-IntervAI</strong>
          <span>InterviewAI</span>
        </div>
      </div>

      <nav className="nav-menu">
        <span className="nav-caption">{appCopy.common.mainMenu}</span>
        {navItems.map((item) => (
          <button
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            type="button"
            key={item.id}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} />
            <span>{appCopy.nav[item.id] || item.label}</span>
          </button>
        ))}

        <span className="nav-caption nav-caption-spaced">{appCopy.common.general}</span>
        <button className="nav-item active" type="button" onClick={() => onNavigate('profile')}>
          <Icon name="user" />
          <span>{appCopy.nav.profile}</span>
        </button>
        <button className="nav-item" type="button" onClick={() => onNavigate('settings')}>
          <Icon name="settings" />
          <span>{appCopy.nav.settings}</span>
        </button>
      </nav>

      <button className="logout-button" type="button" onClick={onLogout}>
        <Icon name="logout" />
        {appCopy.common.logOut}
      </button>
    </aside>
  )
}

function PanelHeader({ title, description }) {
  return (
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}

function ProfileField({ label, value, editing, onChange }) {
  return (
    <label className="profile-field">
      <span>{label}</span>
      {editing ? (
        <input value={value || ''} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <strong>{value || ''}</strong>
      )}
    </label>
  )
}

function LinkField({ icon, label, value, editing, onChange }) {
  return (
    <label className="link-field">
      <span className="link-icon"><Icon name={icon} /></span>
      <div>
        <small>{label}</small>
        {editing ? (
          <input value={value || ''} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <strong>{value || ''}</strong>
        )}
      </div>
    </label>
  )
}

function ReadinessBar({ label, value, tone }) {
  return (
    <div className="readiness-row">
      <div>
        <strong>{label}</strong>
        <span>{value}%</span>
      </div>
      <div className="skill-track">
        <div className={`skill-fill ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function createReadinessItems(profile, analysis) {
  const completeness = calculateProfileCompleteness(profile)
  const cvUploaded = analysis ? 100 : 0
  const interviewReadiness = Math.round((completeness * 0.55) + (cvUploaded * 0.45))

  return [
    { label: 'CV uploaded', value: cvUploaded, tone: 'purple' },
    { label: 'Profile completeness', value: completeness, tone: 'blue' },
    { label: 'Interview readiness', value: interviewReadiness, tone: 'green' },
  ]
}

function calculateProfileCompleteness(profile) {
  const fields = ['fullName', 'headline', 'email', 'phone', 'location', 'university', 'goal']
  const completedFields = fields.filter((field) => String(profile[field] || '').trim()).length

  return Math.round((completedFields / fields.length) * 100)
}

function Icon({ name }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    file: <path d="M7 3h7l4 4v14H7zM14 3v5h5M9 13h6M9 17h4" />,
    mic: <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />,
    chart: <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8" />,
    history: <path d="M4 12a8 8 0 1 0 3-6.25M4 5v5h5M12 8v5l3 2" />,
    user: <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />,
    settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />,
    bell: <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0" />,
    brain: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 5 2.2M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-5 2.2M12 5v14M8 10h3M13 10h3M8 15h3M13 15h3" />,
    edit: <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 7.5l3 3" />,
    save: <path d="M5 4h12l2 2v14H5zM8 4v6h8M8 20v-6h8" />,
    upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
    github: <path d="M9 19c-4 1.2-4-2-5.5-2.5M15 22v-3.5c0-1 .3-1.7.8-2.2 2.7-.3 5.2-1.3 5.2-6A4.7 4.7 0 0 0 19.7 7c.1-.3.6-1.7-.1-3.5 0 0-1.1-.3-3.6 1.3a12.6 12.6 0 0 0-6.5 0C7 3.2 5.9 3.5 5.9 3.5 5.2 5.3 5.7 6.7 5.8 7A4.7 4.7 0 0 0 4.5 10.3c0 4.6 2.5 5.6 5.2 6 .4.4.7 1 .8 1.9V22" />,
    linkedin: <path d="M4 9h4v11H4zM6 5.5a2 2 0 1 0 0 .1M11 9h4v1.8A4 4 0 0 1 22 13v7h-4v-6a2 2 0 0 0-4 0v6h-4z" />,
    globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
