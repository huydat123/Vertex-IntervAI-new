import PreferenceControls from '../../components/PreferenceControls.jsx'
import { formatFileSize, formatUploadDate } from '../../services/cvStorage.js'
import { getAppCopy } from '../../services/i18n.js'
import { formatInterviewDate } from '../../services/interviewStorage.js'
import '../Dashboard/Dashboard.css'
import './Result.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

const fallbackUser = {
  fullName: 'Nguyen Huy Dat',
  initials: 'HD',
  role: 'user',
}

export default function Result({
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
}) {
  const appCopy = getAppCopy(language)
  const copy = appCopy.result
  const result = getLatestInterviewResult(interviewResult, interviewHistory)
  const cvContext = getCvContext(result, cvAnalysis, cvHistory)

  return (
    <div className="dashboard-page result-page">
      <div className="dashboard-frame">
        <ResultSidebar appCopy={appCopy} currentPage="result" onNavigate={onNavigate} onLogout={onLogout} />

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
                <span>{currentUser.fullName}</span>
                <small>{currentUser.role}</small>
                <div className="avatar">{currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : currentUser.initials}</div>
              </div>
            </div>
          </header>

          {result ? (
            <ResultContent
              appCopy={appCopy}
              cvContext={cvContext}
              copy={copy}
              result={result}
              onNavigate={onNavigate}
            />
          ) : (
            <EmptyResult appCopy={appCopy} copy={copy} onNavigate={onNavigate} />
          )}
        </main>
      </div>
    </div>
  )
}

function ResultContent({ appCopy, result, cvContext, copy, onNavigate }) {
  const score = clampScore(result.overallScore)
  const scoreBand = getScoreBand(score, copy)
  const answers = getInterviewAnswers(result)
  const strengths = normalizeList(result.strengths, [copy.fallbackStrength])
  const improvements = normalizeList(result.improvements, [copy.fallbackImprove])
  const answeredQuestions = result.answeredQuestions || answers.length || 0
  const totalQuestions = result.totalQuestions || answers.length || 0

  return (
    <div className="dashboard-content result-content">
      <section className={`result-hero panel ${scoreBand.tone}`}>
        <div className="result-hero-copy">
          <p className="eyebrow">{copy.heroEyebrow}</p>
          <h1>{scoreBand.title}</h1>
          <p>{result.recommendation || scoreBand.description}</p>
          <div className="result-hero-actions">
            <button className="primary-result-page-action" type="button" onClick={() => onNavigate('interview')}>
              <Icon name="shuffle" />
              {copy.newInterview}
            </button>
            <button className="secondary-result-page-action" type="button" onClick={() => onNavigate('history')}>
              <Icon name="history" />
              {appCopy.common.viewHistory}
            </button>
          </div>
        </div>

        <div className="result-score-orb" style={{ '--score': `${score}%` }}>
          <div>
            <strong>{score}<small>/100</small></strong>
            <span>{copy.finalScore}</span>
          </div>
        </div>
      </section>

      <section className="result-stats" aria-label="Result summary">
        <ResultStat icon="chart" label={copy.stats[0]} value={score} suffix="/100" tone="blue" />
        <ResultStat icon="file" label={copy.stats[1]} value={clampScore(result.cvScore ?? cvContext?.cvScore)} suffix="/100" tone="purple" />
        <ResultStat icon="check" label={copy.stats[2]} value={answeredQuestions} suffix={`/${totalQuestions}`} tone="green" />
        <ResultStat icon="calendar" label={copy.stats[3]} value={formatInterviewDate(result.completedAt)} tone="orange" />
      </section>

      <div className="result-grid">
        <section className="panel result-recommendation-panel">
          <PanelHeader
            title={copy.recommendationTitle}
            description={copy.recommendationText}
          />
          <p>{result.recommendation || scoreBand.description}</p>
        </section>

        <section className="panel result-list-panel">
          <PanelHeader title={copy.strengths} description={copy.strengthsText} />
          <ResultList items={strengths} tone="green" />
        </section>

        <section className="panel result-list-panel">
          <PanelHeader title={copy.improvements} description={copy.improvementsText} />
          <ResultList items={improvements} tone="orange" />
        </section>

        <aside className="panel result-context-panel">
          <PanelHeader title={copy.cvContextTitle} description={copy.cvContextText} />
          <div className="result-context-card">
            <span className="result-context-icon"><Icon name="file" /></span>
            <div>
              <strong>{cvContext?.fileName || copy.noCvLinked}</strong>
              <p>{result.role || cvContext?.suggestedPosition || 'AI Interview'}</p>
              <small>
                {cvContext
                  ? `${formatUploadDate(cvContext.uploadedAt || cvContext.analyzedAt || cvContext.createdAt)} / ${formatFileSize(cvContext.fileSize)}`
                  : copy.uploadLink}
              </small>
            </div>
          </div>

          <div className="result-skill-tags">
            {(cvContext?.skills || []).slice(0, 8).map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
            {!cvContext?.skills?.length ? <span>{copy.noSkills}</span> : null}
          </div>
        </aside>

        <section className="panel result-answer-panel">
          <PanelHeader
            title={copy.questionReview}
            description={copy.questionReviewText}
          />
          {answers.length ? (
            <div className="result-answer-list">
              {answers.map((answer, index) => (
                <AnswerCard answer={answer} copy={copy} index={index} key={`${answer.question}-${index}`} />
              ))}
            </div>
          ) : (
            <div className="result-empty-block">
              <Icon name="mic" />
              <strong>{copy.noAnswerTitle}</strong>
              <p>{copy.noAnswerText}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function EmptyResult({ appCopy, copy, onNavigate }) {
  return (
    <div className="dashboard-content result-content">
      <section className="result-empty-hero panel">
        <div>
          <p className="eyebrow">{copy.emptyEyebrow}</p>
          <h1>{copy.emptyTitle}</h1>
          <p>{copy.emptyText}</p>
          <div className="result-hero-actions">
            <button className="primary-result-page-action" type="button" onClick={() => onNavigate('interview')}>
              <Icon name="mic" />
              {appCopy.common.startInterview}
            </button>
            <button className="secondary-result-page-action" type="button" onClick={() => onNavigate('upload-cv')}>
              <Icon name="upload" />
              {appCopy.common.uploadCv}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function ResultSidebar({ appCopy, currentPage, onNavigate, onLogout }) {
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
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
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

function ResultStat({ icon, label, value, suffix = '', tone }) {
  return (
    <article className={`result-stat ${tone}`}>
      <span><Icon name={icon} /></span>
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

function ResultList({ items, tone }) {
  return (
    <ul className={`result-point-list ${tone}`}>
      {items.map((item) => (
        <li key={item}>
          <span><Icon name="check" /></span>
          <p>{item}</p>
        </li>
      ))}
    </ul>
  )
}

function AnswerCard({ answer, copy, index }) {
  const score = clampScore(answer.score)
  const band = getScoreBand(score, copy)

  return (
    <article className="result-answer-card">
      <div className="result-answer-heading">
        <div>
          <span>{copy.question} {index + 1}</span>
          <h3>{answer.question}</h3>
        </div>
        <strong className={band.tone}>{score}<small>/100</small></strong>
      </div>

      <div className="result-answer-grid">
        <section>
          <small>{copy.yourAnswer}</small>
          <p>{answer.answer || copy.noSavedAnswer}</p>
        </section>
        <section>
          <small>{copy.aiFeedback}</small>
          <p>{answer.feedback || copy.noFeedback}</p>
        </section>
      </div>
    </article>
  )
}

function getLatestInterviewResult(interviewResult, interviewHistory) {
  const items = [
    interviewResult,
    ...(Array.isArray(interviewHistory) ? interviewHistory : []),
  ].filter(Boolean)

  if (!items.length) {
    return null
  }

  return items.sort((first, second) => (
    new Date(second.completedAt || second.updatedAt || 0) - new Date(first.completedAt || first.updatedAt || 0)
  ))[0]
}

function getCvContext(result, cvAnalysis, cvHistory) {
  const cvRows = [cvAnalysis, ...(Array.isArray(cvHistory) ? cvHistory : [])].filter(Boolean)

  if (!cvRows.length) {
    return null
  }

  if (result?.cvId) {
    return cvRows.find((item) => item.cvId === result.cvId) || cvRows[0]
  }

  return cvRows[0]
}

function getInterviewAnswers(item) {
  const answers = Array.isArray(item?.answers)
    ? item.answers
    : Array.isArray(item?.answerAttempts)
      ? item.answerAttempts
      : []

  return answers.map((answer, index) => {
    const evaluation = answer.evaluation || {}

    return {
      question: answer.question || answer.questionText || `Question ${index + 1}`,
      answer: answer.answer || answer.answerText || answer.transcript || '',
      score: Number(answer.score ?? evaluation.score ?? 0),
      feedback: answer.feedback || evaluation.feedback || answer.review || '',
    }
  })
}

function normalizeList(items, fallback) {
  if (!Array.isArray(items)) {
    return fallback
  }

  const normalizedItems = items
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  return normalizedItems.length ? normalizedItems : fallback
}

function clampScore(value) {
  const score = Number(value)

  if (!Number.isFinite(score)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function getScoreBand(score, copy) {
  if (score >= 85) {
    return {
      tone: 'excellent',
      title: copy.scoreBands.excellentTitle,
      description: copy.scoreBands.excellentDescription,
    }
  }

  if (score >= 70) {
    return {
      tone: 'good',
      title: copy.scoreBands.goodTitle,
      description: copy.scoreBands.goodDescription,
    }
  }

  return {
    tone: 'practice',
    title: copy.scoreBands.practiceTitle,
    description: copy.scoreBands.practiceDescription,
  }
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
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    shuffle: <path d="M16 3h5v5M4 17l5-5 3 3 7-7M16 21h5v-5M4 7h4l3 3" />,
    check: <path d="M20 6 9 17l-5-5" />,
    calendar: <path d="M7 3v4M17 3v4M4 8h16M5 5h14v16H5z" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
