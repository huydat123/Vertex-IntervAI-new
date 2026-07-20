import { useEffect, useMemo, useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import { formatFileSize, formatUploadDate } from '../../services/cvStorage.js'
import { getAppCopy } from '../../services/i18n.js'
import { formatInterviewDate } from '../../services/interviewStorage.js'
import heroArtwork from '../../assets/image_processing20250122-990885-hel775.gif'
import './Dashboard.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

const fallbackCvAnalysis = {
  fileName: 'No CV uploaded yet',
  fileSize: 0,
  uploadedAt: '',
  cvScore: 0,
  suggestedPosition: 'Upload CV to get a suggested role',
  recommendation:
    'Upload a CV first so Vertex-IntervAI can extract skills, calculate a CV score, and prepare interview questions for this account.',
  skills: [],
  talentScores: [
    { label: 'Frontend', score: 0 },
    { label: 'Backend', score: 0 },
    { label: 'Cloud', score: 0 },
    { label: 'Database', score: 0 },
    { label: 'Communication', score: 0 },
    { label: 'Problem Solving', score: 0 },
  ],
  skillGroups: [
    { label: 'Frontend', value: 0, skills: 'Waiting for CV analysis', tone: 'purple' },
    { label: 'Backend', value: 0, skills: 'Waiting for CV analysis', tone: 'blue' },
    { label: 'Cloud', value: 0, skills: 'Waiting for CV analysis', tone: 'orange' },
    { label: 'Communication', value: 0, skills: 'Waiting for interview result', tone: 'green' },
  ],
}

const interviews = []

const actions = [
  { label: 'Upload CV', icon: 'upload', tone: 'purple', page: 'upload-cv' },
  { label: 'Start Interview', icon: 'play', tone: 'green', page: 'interview' },
  { label: 'View History', icon: 'history', tone: 'blue', page: 'history' },
]

const fallbackUser = {
  fullName: 'Nguyen Huy Dat',
  initials: 'HD',
  role: 'user',
}

const VISIBLE_CV_LIMIT = 3

export default function Dashboard({
  cvAnalysis,
  cvHistory = [],
  interviewResult,
  interviewHistory = [],
  currentUser = fallbackUser,
  language = 'en',
  colorTheme = 'black',
  onLanguageChange = () => {},
  onThemeChange = () => {},
  onNavigate = () => {},
  onLogout = () => {},
  onDeleteCv = () => {},
}) {
  const appCopy = getAppCopy(language)
  const copy = appCopy.dashboard
  const cvRows = useMemo(() => mergeLatestCv(cvHistory, cvAnalysis), [cvHistory, cvAnalysis])
  const [selectedCvKey, setSelectedCvKey] = useState(() => getCvKey(cvRows[0] || cvAnalysis))
  const [showAllCvs, setShowAllCvs] = useState(false)
  const selectedCv = cvRows.find((item) => getCvKey(item) === selectedCvKey) || cvRows[0] || cvAnalysis
  const hasUploadedCv = Boolean(selectedCv)
  const analysis = normalizeDashboardAnalysis(selectedCv)
  const mergedInterviewHistory = useMemo(
    () => mergeLatestInterview(interviewHistory, interviewResult),
    [interviewHistory, interviewResult],
  )
  const selectedInterviewHistory = filterInterviewsForCv(mergedInterviewHistory, analysis)
  const latestInterviewScore = selectedInterviewHistory[0]?.overallScore ?? 0
  const averageScore = latestInterviewScore ? Math.round((analysis.cvScore + latestInterviewScore) / 2) : analysis.cvScore
  const interviewRows = selectedInterviewHistory.length
    ? [
      ...selectedInterviewHistory.slice(0, 3).map((interview) => ({
        role: interview.role,
        date: formatInterviewDate(interview.completedAt),
        score: interview.overallScore,
        status: interview.status || copy.table[3],
      })),
    ]
    : interviewResult
      && shouldShowFallbackInterview(interviewResult, analysis)
      ? [
      {
        role: interviewResult.role,
        date: formatInterviewDate(interviewResult.completedAt),
        score: interviewResult.overallScore,
        status: interviewResult.status,
      },
      ...interviews.slice(0, 2),
    ]
    : interviews
  const firstName = currentUser.fullName?.trim().split(/\s+/)[0] || ''
  const cvCount = cvRows.length
  const visibleCvRows = showAllCvs ? cvRows : cvRows.slice(0, VISIBLE_CV_LIMIT)
  const hiddenCvCount = Math.max(0, cvRows.length - VISIBLE_CV_LIMIT)
  const completedInterviewCount = selectedInterviewHistory.length
  const readinessLabel = getReadinessLabel(averageScore, copy)
  const stats = [
    { label: copy.stats[0], value: String(analysis.cvScore), suffix: '/100', icon: 'file', tone: 'purple' },
    { label: copy.stats[1], value: String(latestInterviewScore), suffix: '/100', icon: 'mic', tone: 'green' },
    { label: copy.stats[2], value: String(completedInterviewCount), suffix: '', icon: 'check', tone: 'orange' },
    { label: copy.stats[3], value: String(averageScore), suffix: '/100', icon: 'chart', tone: 'blue' },
  ]

  useEffect(() => {
    const latestKey = getCvKey(cvRows[0] || cvAnalysis)

    if (!cvRows.length) {
      setSelectedCvKey('')
      setShowAllCvs(false)
      return
    }

    setSelectedCvKey((currentKey) => (
      currentKey && cvRows.some((item) => getCvKey(item) === currentKey)
        ? currentKey
        : latestKey
    ))
  }, [cvRows, cvAnalysis])

  return (
    <div className="dashboard-page">
      <div className="dashboard-frame">
        <Sidebar appCopy={appCopy} currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="dashboard-main">
          <Topbar
            appCopy={appCopy}
            colorTheme={colorTheme}
            currentUser={currentUser}
            language={language}
            onLanguageChange={onLanguageChange}
            onThemeChange={onThemeChange}
          />

          <div className="dashboard-content">
            <section className="hero-panel" aria-label="Dashboard overview">
              <div className="hero-copy">
                <p className="eyebrow">{copy.heroEyebrow}</p>
                <h1>{copy.welcome(firstName)}</h1>
                <p>
                  {hasUploadedCv
                    ? copy.heroReady
                    : copy.heroEmpty}
                </p>
                <div className="hero-actions">
                  <button className="primary-action" type="button" onClick={() => onNavigate('interview')}>
                    <Icon name="play" />
                    {appCopy.common.startInterview}
                  </button>
                  <button className="secondary-action" type="button" onClick={() => onNavigate('upload-cv')}>
                    <Icon name="upload" />
                    {copy.uploadNewCv}
                  </button>
                </div>

                <div className="workflow-strip" aria-label="Interview workflow status">
                  <WorkflowStep icon="file" label={copy.workflow[0][0]} status={hasUploadedCv ? copy.workflow[0][1] : copy.workflow[0][2]} active />
                  <WorkflowStep icon="brain" label={copy.workflow[1][0]} status={copy.workflow[1][1]} active={hasUploadedCv} />
                  <WorkflowStep icon="mic" label={copy.workflow[2][0]} status={latestInterviewScore ? copy.workflow[2][1] : copy.workflow[2][2]} active={Boolean(latestInterviewScore)} />
                  <WorkflowStep icon="chart" label={copy.workflow[3][0]} status={latestInterviewScore ? copy.workflow[3][1] : copy.workflow[3][2]} active={Boolean(latestInterviewScore)} />
                </div>
              </div>

              <div className="hero-visual" aria-label="Candidate readiness overview">
                <img src={heroArtwork} alt="" />
                <div className="hero-score-card">
                  <span>{copy.readiness}</span>
                  <strong>{averageScore}<small>/100</small></strong>
                  <p>{readinessLabel}</p>
                </div>
                <div className="hero-role-card">
                  <span>{copy.suggestedRole}</span>
                  <strong>{analysis.suggestedPosition}</strong>
                  <small>{copy.cvSaved(cvCount)}</small>
                </div>
              </div>
            </section>

            <section className="stats-grid" aria-label="Key dashboard metrics">
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </section>

            <div className="dashboard-grid">
              <section className="panel talent-panel">
                <PanelHeader
                  title={copy.talentTitle}
                  description={copy.talentDescription}
                />
                <div className="talent-layout">
                  <RadarChart data={analysis.talentScores} />
                  <div className="skill-breakdown">
                    {analysis.skillGroups.map((group) => (
                      <SkillBar key={group.label} {...group} />
                    ))}
                  </div>
                </div>
              </section>

              <aside className="right-rail">
                <section className="panel score-panel">
                  <PanelHeader title={copy.scoreTitle} description={copy.scoreDescription} />
                  <div className="score-rings">
                    <ScoreRing label="CV" value={analysis.cvScore} color="#7c3aed" />
                    <ScoreRing label="Interview" value={latestInterviewScore} color="#10b981" />
                  </div>
                </section>

                <section className="panel cv-panel">
                  <PanelHeader
                    title={copy.cvStatusTitle}
                    description={copy.cvStatusDescription(cvCount)}
                  />
                  <div className="cv-list" aria-label="Saved CV analyses">
                    {visibleCvRows.length ? (
                      visibleCvRows.map((item) => {
                        const itemKey = getCvKey(item)
                        const isActive = itemKey === getCvKey(analysis)

                        return (
                          <article
                            className={`cv-file ${isActive ? 'active' : ''}`}
                            key={itemKey}
                          >
                            <button
                              className="cv-select-button"
                              type="button"
                              onClick={() => setSelectedCvKey(itemKey)}
                              aria-pressed={isActive}
                            >
                              <div className="file-icon"><Icon name="file" /></div>
                              <div className="cv-file-copy">
                                <strong>{item.fileName || copy.uploadedCv}</strong>
                                <span>
                                  {formatUploadDate(getCvDate(item))} / {formatFileSize(item.fileSize)}
                                </span>
                              </div>
                              <em>{Number(item.cvScore || 0)}/100</em>
                            </button>
                            <button
                              className="cv-delete-button"
                              type="button"
                              aria-label={`${appCopy.common.delete} ${item.fileName || copy.uploadedCv}`}
                              title={appCopy.common.delete}
                              onClick={() => handleDeleteCv(item, onDeleteCv, copy)}
                            >
                              <Icon name="trash" />
                            </button>
                          </article>
                        )
                      })
                    ) : (
                      <div className="cv-file empty">
                        <div className="file-icon"><Icon name="file" /></div>
                        <div className="cv-file-copy">
                          <strong>{analysis.fileName}</strong>
                          <span>{copy.cvEmpty}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {hiddenCvCount > 0 ? (
                    <button
                      className="cv-toggle-button"
                      type="button"
                      onClick={() => setShowAllCvs((current) => !current)}
                      aria-expanded={showAllCvs}
                    >
                      <Icon name={showAllCvs ? 'chevronUp' : 'chevronDown'} />
                      {showAllCvs ? copy.showFewer : copy.showMore(hiddenCvCount)}
                    </button>
                  ) : null}

                  <div className="tag-list" aria-label="Extracted skills">
                    {analysis.skills.slice(0, 6).map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </section>
              </aside>

              <section className="panel recommendation-panel">
                <PanelHeader title={copy.recommendationTitle} description={copy.recommendationDescription} />
                <p>{analysis.recommendation}</p>
                <div className="focus-list">
                  {copy.focusItems.map((item) => <span key={item}>{item}</span>)}
                </div>
              </section>

              <section className="panel history-panel">
                <PanelHeader title={copy.recentTitle} description={copy.recentDescription} />
                <div className="interview-table" role="table" aria-label="Recent interviews">
                  <div className="table-row table-head" role="row">
                    {copy.table.map((item) => <span role="columnheader" key={item}>{item}</span>)}
                  </div>
                  {interviewRows.map((interview) => (
                    <div className="table-row" role="row" key={`${interview.role}-${interview.date}`}>
                      <span role="cell">{interview.role}</span>
                      <span role="cell">{interview.date}</span>
                      <span role="cell">{interview.score}/100</span>
                      <span role="cell">
                        <span className={`status-pill ${interview.status.toLowerCase()}`}>
                          {interview.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel quick-panel">
                <PanelHeader title={copy.quickTitle} description={copy.quickDescription} />
                <div className="action-list">
                  {actions.map((action, index) => (
                    <button
                      className={`action-button ${action.tone}`}
                      type="button"
                      key={action.label}
                      onClick={() => onNavigate(action.page)}
                    >
                      <Icon name={action.icon} />
                      <span>{copy.actions[index] || action.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function mergeLatestCv(items, latest) {
  const source = Array.isArray(items) ? items : []

  if (!latest) {
    return source
  }

  const key = getCvKey(latest)
  return [latest, ...source.filter((item) => getCvKey(item) !== key)]
}

function mergeLatestInterview(items, latest) {
  const source = Array.isArray(items) ? items : []

  if (!latest) {
    return source
  }

  const key = latest.interviewId || latest.completedAt
  return [latest, ...source.filter((item) => (item.interviewId || item.completedAt) !== key)]
}

function normalizeDashboardAnalysis(item) {
  if (!item) {
    return fallbackCvAnalysis
  }

  return {
    ...fallbackCvAnalysis,
    ...item,
    cvScore: Number(item.cvScore || 0),
    fileSize: Number(item.fileSize || 0),
    uploadedAt: getCvDate(item),
    skills: normalizeStringList(item.skills, fallbackCvAnalysis.skills),
    talentScores: normalizeTalentScores(item.talentScores),
    skillGroups: normalizeSkillGroups(item.skillGroups),
    recommendation: item.recommendation || fallbackCvAnalysis.recommendation,
    suggestedPosition: item.suggestedPosition || fallbackCvAnalysis.suggestedPosition,
  }
}

function normalizeStringList(value, fallback) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : fallback
}

function normalizeTalentScores(value) {
  if (!Array.isArray(value) || !value.length) {
    return fallbackCvAnalysis.talentScores
  }

  return value.map((item) => ({
    label: item.label || 'Skill',
    score: Number(item.score || 0),
  }))
}

function normalizeSkillGroups(value) {
  if (!Array.isArray(value) || !value.length) {
    return fallbackCvAnalysis.skillGroups
  }

  return value.map((item, index) => ({
    label: item.label || `Group ${index + 1}`,
    value: Number(item.value || item.score || 0),
    skills: item.skills || 'No skills listed',
    tone: item.tone || getSkillTone(index),
  }))
}

function getSkillTone(index) {
  return ['purple', 'blue', 'orange', 'green'][index % 4]
}

function filterInterviewsForCv(interviews, analysis) {
  if (!analysis?.cvId) {
    return interviews
  }

  return interviews.filter((interview) => interview.cvId === analysis.cvId)
}

function shouldShowFallbackInterview(interview, analysis) {
  return !analysis?.cvId || interview?.cvId === analysis.cvId
}

function handleDeleteCv(item, onDeleteCv, copy) {
  const fileName = item?.fileName || 'this CV'

  if (window.confirm(copy.deleteConfirm(fileName))) {
    onDeleteCv(item)
  }
}

function getCvKey(item) {
  return item?.cvId || `${item?.fileName || 'cv'}-${getCvDate(item)}`
}

function getCvDate(item) {
  return item?.uploadedAt || item?.analyzedAt || item?.updatedAt || item?.createdAt || ''
}

function getReadinessLabel(score, copy) {
  if (score >= 85) return copy.readinessLabels.strong
  if (score >= 70) return copy.readinessLabels.ready
  if (score > 0) return copy.readinessLabels.needs
  return copy.readinessLabels.empty
}

function Sidebar({ appCopy, currentPage, onNavigate, onLogout }) {
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
        {navItems.slice(0, 5).map((item) => (
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
        {navItems.slice(5).map((item) => (
          <button
            className="nav-item"
            type="button"
            key={item.id}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} />
            <span>{appCopy.nav[item.id] || item.label}</span>
          </button>
        ))}
      </nav>

      <button className="logout-button" type="button" onClick={onLogout}>
        <Icon name="logout" />
        {appCopy.common.logOut}
      </button>
    </aside>
  )
}

function Topbar({
  appCopy,
  colorTheme,
  currentUser,
  language,
  onLanguageChange,
  onThemeChange,
}) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="icon-button" type="button" aria-label={appCopy.common.goBack} title={appCopy.common.goBack}>
          <Icon name="arrowLeft" />
        </button>
        <div>
          <p>{appCopy.dashboard.page}</p>
          <h2>{appCopy.dashboard.title}</h2>
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
          <span>{currentUser.fullName}</span>
          <small>{currentUser.role}</small>
          <div className="avatar">{currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : currentUser.initials}</div>
        </div>
      </div>
    </header>
  )
}

function WorkflowStep({ icon, label, status, active = false }) {
  return (
    <div className={`workflow-step ${active ? 'active' : ''}`}>
      <span className="workflow-icon"><Icon name={icon} /></span>
      <strong>{label}</strong>
      <small>{status}</small>
    </div>
  )
}

function StatCard({ label, value, suffix, icon, tone }) {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-icon"><Icon name={icon} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}<small>{suffix}</small></strong>
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

function SkillBar({ label, value, skills, tone }) {
  return (
    <div className="skill-row">
      <div className="skill-meta">
        <strong>{label}</strong>
        <span>{skills}</span>
      </div>
      <div className="skill-score">
        <span>{value}%</span>
        <div className="skill-track">
          <div className={`skill-fill ${tone}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    </div>
  )
}

function ScoreRing({ label, value, color }) {
  return (
    <div className="score-ring-item">
      <div
        className="score-ring"
        style={{ '--score': `${value}%`, '--ring-color': color }}
        aria-label={`${label} score ${value} out of 100`}
      >
        <strong>{value}%</strong>
      </div>
      <span>{label}</span>
    </div>
  )
}

function RadarChart({ data }) {
  const center = 120
  const radius = 76
  const angleStep = (Math.PI * 2) / data.length

  const pointFor = (index, scale) => {
    const angle = angleStep * index - Math.PI / 2
    return {
      x: center + Math.cos(angle) * radius * scale,
      y: center + Math.sin(angle) * radius * scale,
    }
  }

  const polygonPoints = data
    .map((item, index) => {
      const point = pointFor(index, item.score / 100)
      return `${point.x},${point.y}`
    })
    .join(' ')

  const gridPolygons = [0.25, 0.5, 0.75, 1].map((scale) =>
    data
      .map((_, index) => {
        const point = pointFor(index, scale)
        return `${point.x},${point.y}`
      })
      .join(' '),
  )

  return (
    <div className="radar-wrap" aria-label="Talent graph radar chart">
      <svg viewBox="0 0 240 240" role="img">
        <title>Talent Graph scores</title>
        {gridPolygons.map((points) => (
          <polygon className="radar-grid" points={points} key={points} />
        ))}
        {data.map((item, index) => {
          const axisPoint = pointFor(index, 1)
          const labelPoint = pointFor(index, 1.28)
          return (
            <g key={item.label}>
              <line className="radar-axis" x1={center} y1={center} x2={axisPoint.x} y2={axisPoint.y} />
              <text className="radar-label" x={labelPoint.x} y={labelPoint.y} textAnchor="middle">
                {item.label}
              </text>
            </g>
          )
        })}
        <polygon className="radar-shape" points={polygonPoints} />
        {data.map((item, index) => {
          const point = pointFor(index, item.score / 100)
          return <circle className="radar-dot" cx={point.x} cy={point.y} r="3.5" key={`${item.label}-dot`} />
        })}
      </svg>
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
    check: <path d="M20 6 9 17l-5-5" />,
    upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    play: <path d="M8 5v14l11-7z" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
