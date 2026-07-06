import { useEffect, useMemo, useState } from 'react'
import { formatFileSize, formatUploadDate } from '../../services/cvStorage.js'
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

const readinessItems = [
  { label: 'CV uploaded', value: 92, tone: 'purple' },
  { label: 'Profile completeness', value: 86, tone: 'blue' },
  { label: 'Interview readiness', value: 78, tone: 'green' },
]

const fallbackUser = {
  userId: 'user_demo_001',
  fullName: 'Nguyen Huy Dat',
  email: 'user@talentgraph.ai',
  initials: 'HD',
  role: 'user',
}

export default function Profile({
  cvAnalysis,
  currentUser = fallbackUser,
  onNavigate = () => {},
  onLogout = () => {},
}) {
  const [profile, setProfile] = useState(() => loadProfile(currentUser))
  const [isEditing, setIsEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [syncStatus, setSyncStatus] = useState('Local profile')
  const analysis = cvAnalysis ?? null

  useEffect(() => {
    let isMounted = true

    async function loadAwsProfile() {
      try {
        const awsProfile = await getProfileFromAws(currentUser.userId)

        if (!isMounted) return

        setProfile((current) => ({ ...current, ...awsProfile }))
        setSyncStatus('Synced from AWS')
      } catch {
        if (isMounted) {
          setSyncStatus('Saved locally')
        }
      }
    }

    loadAwsProfile()

    return () => {
      isMounted = false
    }
  }, [currentUser.userId])

  const topSkills = useMemo(() => {
    const fromAnalysis = analysis?.skills?.slice(0, 8)
    return fromAnalysis?.length ? fromAnalysis : ['React', 'JavaScript', 'Python', 'AWS Lambda', 'DynamoDB', 'REST API']
  }, [analysis])

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    window.localStorage.setItem(getProfileStorageKey(currentUser.userId), JSON.stringify(profile))

    try {
      const savedProfile = await saveProfileToAws(profile, currentUser.userId)
      setProfile((current) => ({ ...current, ...savedProfile }))
      setSyncStatus('Saved to AWS')
    } catch {
      setSyncStatus('Saved locally')
    } finally {
      setIsEditing(false)
      setSaved(true)
    }
  }

  return (
    <div className="dashboard-page profile-page">
      <div className="dashboard-frame">
        <ProfileSidebar currentPage="profile" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="dashboard-main">
          <header className="topbar">
            <div className="topbar-title">
              <button
                className="icon-button"
                type="button"
                aria-label="Back to dashboard"
                title="Back to dashboard"
                onClick={() => onNavigate('dashboard')}
              >
                <Icon name="arrowLeft" />
              </button>
              <div>
                <p>Profile</p>
                <h2>Candidate Profile</h2>
              </div>
            </div>

            <div className="topbar-actions">
              <button className="icon-button" type="button" aria-label="Notifications" title="Notifications">
                <Icon name="bell" />
              </button>
              <div className="user-chip" aria-label="Current user">
                <span>{currentUser.fullName}</span>
                <small>{currentUser.role}</small>
                <div className="avatar">{currentUser.initials}</div>
              </div>
            </div>
          </header>

          <div className="dashboard-content profile-content">
            <section className="profile-hero panel">
              <div className="profile-identity">
                <div className="profile-avatar">{currentUser.initials}</div>
                <div>
                  <p className="eyebrow">Candidate Identity</p>
                  <h1>{profile.fullName}</h1>
                  <span>{profile.headline}</span>
                </div>
              </div>

              <div className="profile-actions">
                {saved ? <span className="save-status">Saved</span> : null}
                <span className="sync-status">{syncStatus}</span>
                <button className="secondary-upload-action" type="button" onClick={() => setIsEditing((value) => !value)}>
                  <Icon name="edit" />
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
                <button className="primary-upload-action" type="button" onClick={handleSave}>
                  <Icon name="save" />
                  Save
                </button>
              </div>
            </section>

            <section className="profile-grid">
              <div className="panel profile-form-panel">
                <PanelHeader title="Personal Information" description="Used for CV matching and interview context." />
                <div className="profile-form-grid">
                  <ProfileField label="Full name" value={profile.fullName} editing={isEditing} onChange={(value) => updateField('fullName', value)} />
                  <ProfileField label="Headline" value={profile.headline} editing={isEditing} onChange={(value) => updateField('headline', value)} />
                  <ProfileField label="Email" value={profile.email} editing={isEditing} onChange={(value) => updateField('email', value)} />
                  <ProfileField label="Phone" value={profile.phone} editing={isEditing} onChange={(value) => updateField('phone', value)} />
                  <ProfileField label="Location" value={profile.location} editing={isEditing} onChange={(value) => updateField('location', value)} />
                  <ProfileField label="Education" value={profile.university} editing={isEditing} onChange={(value) => updateField('university', value)} />
                </div>
              </div>

              <aside className="panel readiness-panel">
                <PanelHeader title="Readiness" description="Overview for the next interview round." />
                <div className="readiness-list">
                  {readinessItems.map((item) => (
                    <ReadinessBar key={item.label} {...item} />
                  ))}
                </div>
              </aside>

              <div className="panel profile-goal-panel">
                <PanelHeader title="Career Goal" description="Shown as context for AI-generated questions." />
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
                <PanelHeader title="Latest CV" description={analysis ? 'Connected from UploadCV' : 'Upload a CV to replace demo data.'} />
                <div className="profile-cv-card">
                  <div className="file-icon"><Icon name="file" /></div>
                  <div>
                    <strong>{analysis?.fileName ?? 'No uploaded CV yet'}</strong>
                    <span>
                      {analysis
                        ? `${formatUploadDate(analysis.uploadedAt)} / ${formatFileSize(analysis.fileSize)}`
                        : 'Upload a CV to unlock AI score'}
                    </span>
                  </div>
                </div>
                <div className="profile-score">
                  <strong>{analysis?.cvScore ?? 0}</strong>
                  <span>CV Score</span>
                </div>
              </aside>

              <div className="panel skills-panel">
                <PanelHeader title="Technical Skills" description="Pulled from CV analysis when available." />
                <div className="tag-list profile-tags">
                  {topSkills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </div>

              <aside className="panel links-panel">
                <PanelHeader title="Candidate Links" description="Useful for recruiter review." />
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
    const baseProfile = {
      ...defaultProfile,
      fullName: currentUser.fullName,
      email: currentUser.email,
    }

    return stored ? { ...baseProfile, ...JSON.parse(stored) } : baseProfile
  } catch {
    return {
      ...defaultProfile,
      fullName: currentUser.fullName,
      email: currentUser.email,
    }
  }
}

function ProfileSidebar({ currentPage, onNavigate, onLogout }) {
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
        <span className="nav-caption">Main Menu</span>
        {navItems.map((item) => (
          <button
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            type="button"
            key={item.id}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}

        <span className="nav-caption nav-caption-spaced">General</span>
        <button className="nav-item active" type="button" onClick={() => onNavigate('profile')}>
          <Icon name="user" />
          <span>Profile</span>
        </button>
        <button className="nav-item" type="button">
          <Icon name="settings" />
          <span>Settings</span>
        </button>
      </nav>

      <button className="logout-button" type="button" onClick={onLogout}>
        <Icon name="logout" />
        Log Out
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
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <strong>{value}</strong>
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
          <input value={value} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <strong>{value}</strong>
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
