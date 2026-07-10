import { formatFileSize, formatUploadDate } from '../../services/cvStorage.js'
import { formatInterviewDate } from '../../services/interviewStorage.js'
import './History.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
]

const fallbackUser = {
  fullName: 'Nguyen Huy Dat',
  initials: 'HD',
  role: 'user',
}

export default function History({
  cvAnalysis,
  cvHistory = [],
  interviewResult,
  interviewHistory = [],
  currentUser = fallbackUser,
  onNavigate = () => {},
  onLogout = () => {},
}) {
  const cvRows = mergeLatest(cvHistory, cvAnalysis, getCvKey)
  const interviewRows = mergeLatest(interviewHistory, interviewResult, getInterviewKey)
  const activities = buildActivities(cvRows, interviewRows)
  const averageCvScore = averageScore(cvRows, 'cvScore')
  const averageInterviewScore = averageScore(interviewRows, 'overallScore')
  const bestInterview = interviewRows.reduce((best, item) => (
    Number(item.overallScore || 0) > Number(best?.overallScore || 0) ? item : best
  ), null)

  return (
    <div className="dashboard-page history-page">
      <div className="dashboard-frame">
        <HistorySidebar currentPage="history" onNavigate={onNavigate} onLogout={onLogout} />

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
                <p>History</p>
                <h2>CV and Interview Timeline</h2>
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

          <div className="dashboard-content history-content">
            <section className="history-hero panel">
              <div>
                <p className="eyebrow">Candidate Progress</p>
                <h1>Review every CV analysis and interview result</h1>
                <p>
                  Track uploaded CVs, AI scores, suggested roles, interview scores, and recent
                  practice activity in one place.
                </p>
              </div>
              <div className="history-hero-actions">
                <button className="primary-history-action" type="button" onClick={() => onNavigate('upload-cv')}>
                  <Icon name="upload" />
                  Upload CV
                </button>
                <button className="secondary-history-action" type="button" onClick={() => onNavigate('interview')}>
                  <Icon name="mic" />
                  Start Interview
                </button>
              </div>
            </section>

            <section className="history-stats" aria-label="History statistics">
              <HistoryStat icon="file" label="CV Analyses" value={cvRows.length} tone="purple" />
              <HistoryStat icon="mic" label="Interviews" value={interviewRows.length} tone="green" />
              <HistoryStat icon="chart" label="Avg CV Score" value={averageCvScore || 0} suffix="/100" tone="blue" />
              <HistoryStat icon="check" label="Best Interview" value={bestInterview?.overallScore || 0} suffix="/100" tone="orange" />
            </section>

            <div className="history-grid">
              <section className="panel history-list-panel">
                <PanelHeader
                  title="CV Analysis History"
                  description="Uploaded CVs and extracted AI assessment results."
                />
                {cvRows.length ? (
                  <div className="history-list">
                    {cvRows.map((item) => (
                      <CvHistoryItem key={getCvKey(item)} item={item} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="file"
                    title="No CV analysis yet"
                    text="Upload a CV first, then this page will keep the analysis history."
                    actionLabel="Upload CV"
                    onAction={() => onNavigate('upload-cv')}
                  />
                )}
              </section>

              <section className="panel history-list-panel">
                <PanelHeader
                  title="Interview History"
                  description="Completed AI interview rounds and final scoring."
                />
                {interviewRows.length ? (
                  <div className="history-list">
                    {interviewRows.map((item) => (
                      <InterviewHistoryItem key={getInterviewKey(item)} item={item} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="mic"
                    title="No interview result yet"
                    text="Finish an AI interview to save the final score and feedback."
                    actionLabel="Start Interview"
                    onAction={() => onNavigate('interview')}
                  />
                )}
              </section>

              <section className="panel timeline-panel">
                <PanelHeader
                  title="Recent Activity"
                  description="Latest CV and interview events sorted by date."
                />
                {activities.length ? (
                  <div className="timeline-list">
                    {activities.map((item) => (
                      <TimelineItem key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="history"
                    title="No activity yet"
                    text="Your upload and interview activity will appear here."
                    actionLabel="Go to Dashboard"
                    onAction={() => onNavigate('dashboard')}
                  />
                )}
              </section>

              <aside className="panel summary-panel">
                <PanelHeader title="Progress Summary" description="Quick readiness snapshot." />
                <div className="summary-score">
                  <strong>{calculateReadinessScore(averageCvScore, averageInterviewScore)}</strong>
                  <span>Readiness score</span>
                </div>
                <div className="summary-list">
                  <SummaryItem label="Latest role" value={cvRows[0]?.suggestedPosition || 'Not available'} />
                  <SummaryItem label="Latest CV" value={cvRows[0]?.fileName || 'No CV uploaded'} />
                  <SummaryItem label="Latest interview" value={interviewRows[0]?.role || 'No interview completed'} />
                  <SummaryItem label="Next action" value={getNextAction(cvRows, interviewRows)} />
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function HistorySidebar({ currentPage, onNavigate, onLogout }) {
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
        <button className="nav-item" type="button" onClick={() => onNavigate('profile')}>
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

function HistoryStat({ icon, label, value, suffix = '', tone }) {
  return (
    <article className={`history-stat ${tone}`}>
      <span className="history-stat-icon"><Icon name={icon} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}<em>{suffix}</em></strong>
      </div>
    </article>
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

function CvHistoryItem({ item }) {
  const skills = item.skills?.slice(0, 4) || []

  return (
    <article className="history-item">
      <div className="history-item-main">
        <span className="history-icon purple"><Icon name="file" /></span>
        <div>
          <h3>{item.fileName || 'Uploaded CV'}</h3>
          <p>{item.suggestedPosition || 'Suggested role not available'}</p>
          <div className="history-tags">
            {skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="history-item-meta">
        <strong>{item.cvScore || 0}<small>/100</small></strong>
        <span>{formatUploadDate(item.uploadedAt || item.analyzedAt || item.createdAt)}</span>
        <span>{formatFileSize(item.fileSize)}</span>
      </div>
    </article>
  )
}

function InterviewHistoryItem({ item }) {
  return (
    <article className="history-item">
      <div className="history-item-main">
        <span className="history-icon green"><Icon name="mic" /></span>
        <div>
          <h3>{item.role || 'AI Interview'}</h3>
          <p>{item.recommendation || 'Interview result saved.'}</p>
          <div className="history-tags">
            <span>{item.answeredQuestions || 0}/{item.totalQuestions || 0} answered</span>
            <span>{item.status || 'Completed'}</span>
          </div>
        </div>
      </div>
      <div className="history-item-meta">
        <strong>{item.overallScore || 0}<small>/100</small></strong>
        <span>{formatInterviewDate(item.completedAt)}</span>
        <span>CV {item.cvScore || 0}/100</span>
      </div>
    </article>
  )
}

function TimelineItem({ item }) {
  return (
    <article className="timeline-item">
      <span className={`timeline-dot ${item.tone}`}><Icon name={item.icon} /></span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
        <span>{formatDateTime(item.date)}</span>
      </div>
      <em>{item.score}/100</em>
    </article>
  )
}

function EmptyState({ icon, title, text, actionLabel, onAction }) {
  return (
    <div className="history-empty">
      <span><Icon name={icon} /></span>
      <strong>{title}</strong>
      <p>{text}</p>
      <button className="secondary-history-action" type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function mergeLatest(items, latest, getKey) {
  const source = Array.isArray(items) ? items : []

  if (!latest) {
    return source
  }

  const latestKey = getKey(latest)
  return [latest, ...source.filter((item) => getKey(item) !== latestKey)]
}

function getCvKey(item) {
  return item?.cvId || `${item?.fileName || 'cv'}-${item?.uploadedAt || item?.createdAt || ''}`
}

function getInterviewKey(item) {
  return item?.interviewId || `${item?.role || 'interview'}-${item?.completedAt || ''}`
}

function averageScore(items, key) {
  const scores = items
    .map((item) => Number(item[key]))
    .filter((score) => Number.isFinite(score) && score > 0)

  if (!scores.length) {
    return 0
  }

  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
}

function buildActivities(cvRows, interviewRows) {
  const cvActivities = cvRows.map((item) => ({
    id: `cv-${getCvKey(item)}`,
    type: 'cv',
    title: item.fileName || 'CV analyzed',
    description: item.suggestedPosition || 'CV analysis completed',
    date: item.analyzedAt || item.uploadedAt || item.createdAt,
    score: item.cvScore || 0,
    icon: 'file',
    tone: 'purple',
  }))
  const interviewActivities = interviewRows.map((item) => ({
    id: `interview-${getInterviewKey(item)}`,
    type: 'interview',
    title: item.role || 'AI Interview completed',
    description: item.recommendation || 'Interview feedback saved',
    date: item.completedAt,
    score: item.overallScore || 0,
    icon: 'mic',
    tone: 'green',
  }))

  return [...cvActivities, ...interviewActivities]
    .filter((item) => item.date)
    .sort((first, second) => new Date(second.date) - new Date(first.date))
    .slice(0, 8)
}

function calculateReadinessScore(cvScore, interviewScore) {
  if (cvScore && interviewScore) {
    return Math.round(cvScore * 0.45 + interviewScore * 0.55)
  }

  return cvScore || interviewScore || 0
}

function getNextAction(cvRows, interviewRows) {
  if (!cvRows.length) {
    return 'Upload your first CV'
  }

  if (!interviewRows.length) {
    return 'Start an AI interview'
  }

  return 'Practice another interview'
}

function formatDateTime(value) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
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
    check: <path d="M20 6 9 17l-5-5" />,
    upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
