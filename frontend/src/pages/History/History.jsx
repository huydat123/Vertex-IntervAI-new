import { useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import { formatFileSize, formatUploadDate } from '../../services/cvStorage.js'
import { getAppCopy, getLocale } from '../../services/i18n.js'
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
  language = 'en',
  colorTheme = 'black',
  onLanguageChange = () => {},
  onThemeChange = () => {},
  onNavigate = () => {},
  onLogout = () => {},
  onDeleteCv = () => {},
}) {
  const appCopy = getAppCopy(language)
  const copy = appCopy.history
  const [selectedInterview, setSelectedInterview] = useState(null)
  const cvRows = mergeLatest(cvHistory, cvAnalysis, getCvKey)
  const interviewRows = mergeLatest(interviewHistory, interviewResult, getInterviewKey)
  const activities = buildActivities(cvRows, interviewRows, copy)
  const averageCvScore = averageScore(cvRows, 'cvScore')
  const averageInterviewScore = averageScore(interviewRows, 'overallScore')
  const bestInterview = interviewRows.reduce((best, item) => (
    Number(item.overallScore || 0) > Number(best?.overallScore || 0) ? item : best
  ), null)

  return (
    <div className="dashboard-page history-page">
      <div className="dashboard-frame">
        <HistorySidebar appCopy={appCopy} currentPage="history" onNavigate={onNavigate} onLogout={onLogout} />

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

          <div className="dashboard-content history-content">
            <section className="history-hero panel">
              <div>
                <p className="eyebrow">{copy.heroEyebrow}</p>
                <h1>{copy.heroTitle}</h1>
                <p>{copy.heroText}</p>
              </div>
              <div className="history-hero-actions">
                <button className="primary-history-action" type="button" onClick={() => onNavigate('upload-cv')}>
                  <Icon name="upload" />
                  {appCopy.common.uploadCv}
                </button>
                <button className="secondary-history-action" type="button" onClick={() => onNavigate('interview')}>
                  <Icon name="mic" />
                  {appCopy.common.startInterview}
                </button>
              </div>
            </section>

            <section className="history-stats" aria-label="History statistics">
              <HistoryStat icon="file" label={copy.stats[0]} value={cvRows.length} tone="purple" />
              <HistoryStat icon="mic" label={copy.stats[1]} value={interviewRows.length} tone="green" />
              <HistoryStat icon="chart" label={copy.stats[2]} value={averageCvScore || 0} suffix="/100" tone="blue" />
              <HistoryStat icon="check" label={copy.stats[3]} value={bestInterview?.overallScore || 0} suffix="/100" tone="orange" />
            </section>

            <div className="history-grid">
              <section className="panel history-list-panel">
                <PanelHeader
                  title={copy.cvTitle}
                  description={copy.cvText}
                />
                {cvRows.length ? (
                  <div className="history-list">
                    {cvRows.map((item) => (
                      <CvHistoryItem appCopy={appCopy} copy={copy} key={getCvKey(item)} item={item} onDeleteCv={onDeleteCv} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="file"
                    title={copy.noCvTitle}
                    text={copy.noCvText}
                    actionLabel={appCopy.common.uploadCv}
                    onAction={() => onNavigate('upload-cv')}
                  />
                )}
              </section>

              <section className="panel history-list-panel">
                <PanelHeader
                  title={copy.interviewTitle}
                  description={copy.interviewText}
                />
                {interviewRows.length ? (
                  <div className="history-list">
                    {interviewRows.map((item) => (
                      <InterviewHistoryItem
                        key={getInterviewKey(item)}
                        copy={copy}
                        item={item}
                        onViewDetails={setSelectedInterview}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="mic"
                    title={copy.noInterviewTitle}
                    text={copy.noInterviewText}
                    actionLabel={appCopy.common.startInterview}
                    onAction={() => onNavigate('interview')}
                  />
                )}
              </section>

              <section className="panel timeline-panel">
                <PanelHeader
                  title={copy.activityTitle}
                  description={copy.activityText}
                />
                {activities.length ? (
                  <div className="timeline-list">
                    {activities.map((item) => (
                      <TimelineItem appCopy={appCopy} key={item.id} item={item} language={language} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="history"
                    title={copy.noActivityTitle}
                    text={copy.noActivityText}
                    actionLabel={appCopy.common.backDashboard}
                    onAction={() => onNavigate('dashboard')}
                  />
                )}
              </section>

              <aside className="panel summary-panel">
                <PanelHeader title={copy.summaryTitle} description={copy.summaryText} />
                <div className="summary-score">
                  <strong>{calculateReadinessScore(averageCvScore, averageInterviewScore)}</strong>
                  <span>{copy.readinessScore}</span>
                </div>
                <div className="summary-list">
                  <SummaryItem label={copy.summaryLabels[0]} value={cvRows[0]?.suggestedPosition || copy.notAvailable} />
                  <SummaryItem label={copy.summaryLabels[1]} value={cvRows[0]?.fileName || copy.noCvUploaded} />
                  <SummaryItem label={copy.summaryLabels[2]} value={interviewRows[0]?.role || copy.noInterviewCompleted} />
                  <SummaryItem label={copy.summaryLabels[3]} value={getNextAction(cvRows, interviewRows, copy)} />
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>

      {selectedInterview ? (
        <InterviewDetailModal
          item={selectedInterview}
          appCopy={appCopy}
          copy={copy}
          language={language}
          onClose={() => setSelectedInterview(null)}
        />
      ) : null}
    </div>
  )
}

function HistorySidebar({ appCopy, currentPage, onNavigate, onLogout }) {
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
        <button className="nav-item" type="button" onClick={() => onNavigate('profile')}>
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

function CvHistoryItem({ appCopy, copy, item, onDeleteCv }) {
  const skills = item.skills?.slice(0, 4) || []

  return (
    <article className="history-item">
      <div className="history-item-main">
        <span className="history-icon purple"><Icon name="file" /></span>
        <div>
          <h3>{item.fileName || copy.uploadedCv}</h3>
          <p>{item.suggestedPosition || copy.suggestedMissing}</p>
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
        <button
          className="history-delete-button"
          type="button"
          aria-label={`${appCopy.common.delete} ${item.fileName || copy.uploadedCv}`}
          onClick={() => handleDeleteCv(item, onDeleteCv, copy)}
        >
          <Icon name="trash" />
          {appCopy.common.delete}
        </button>
      </div>
    </article>
  )
}

function InterviewHistoryItem({ copy, item, onViewDetails }) {
  return (
    <article className="history-item">
      <div className="history-item-main">
        <span className="history-icon green"><Icon name="mic" /></span>
        <div>
          <h3>{item.role || 'AI Interview'}</h3>
          <p>{item.recommendation || copy.interviewSaved}</p>
          <div className="history-tags">
            <span>{item.answeredQuestions || 0}/{item.totalQuestions || 0} {copy.answered}</span>
            <span>{item.status || copy.completed}</span>
          </div>
        </div>
      </div>
      <div className="history-item-meta">
        <strong>{item.overallScore || 0}<small>/100</small></strong>
        <span>{formatInterviewDate(item.completedAt)}</span>
        <span>{copy.cvScore} {item.cvScore || 0}/100</span>
        <button
          className="history-detail-button"
          type="button"
          onClick={() => onViewDetails(item)}
        >
          <Icon name="chart" />
          {copy.viewDetails}
        </button>
      </div>
    </article>
  )
}

function InterviewDetailModal({ appCopy, copy, item, language, onClose }) {
  const answers = getInterviewAnswers(item)
  const strengths = normalizeList(item.strengths, ['Interview result saved'])
  const improvements = normalizeList(item.improvements, ['Practice another round to collect more feedback'])
  const answeredQuestions = item.answeredQuestions || answers.length || 0
  const totalQuestions = item.totalQuestions || answers.length || 0

  return (
    <div
      className="interview-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="interview-detail-modal" role="dialog" aria-modal="true" aria-label={copy.detailEyebrow}>
        <div className="interview-detail-header">
          <div>
            <p className="eyebrow">{copy.detailEyebrow}</p>
            <h2>{item.role || 'AI Interview'}</h2>
            <span>{formatDateTime(item.completedAt, language, appCopy)}</span>
          </div>
          <button className="modal-close-button" type="button" onClick={onClose}>
            {appCopy.common.close}
          </button>
        </div>

        <div className="interview-detail-score-row">
          <div className="detail-score-card primary">
            <span>{copy.finalScore}</span>
            <strong>{item.overallScore || 0}<small>/100</small></strong>
          </div>
          <div className="detail-score-card">
            <span>{copy.answered}</span>
            <strong>{answeredQuestions}<small>/{totalQuestions}</small></strong>
          </div>
          <div className="detail-score-card">
            <span>{copy.cvScore}</span>
            <strong>{item.cvScore || 0}<small>/100</small></strong>
          </div>
        </div>

        <section className="interview-detail-advice">
          <h3>{copy.aiRecommendation}</h3>
          <p>{item.recommendation || copy.noRecommendation}</p>
        </section>

        <div className="interview-detail-columns">
          <DetailList title={copy.strengths} items={strengths} />
          <DetailList title={copy.improvements} items={improvements} />
        </div>

        <section className="interview-answer-section">
          <h3>{copy.questionReview}</h3>
          {answers.length ? (
            <div className="interview-answer-list">
              {answers.map((answer, index) => (
                <AnswerReviewItem answer={answer} copy={copy} index={index} key={`${answer.question}-${index}`} />
              ))}
            </div>
          ) : (
            <p className="detail-empty-text">{copy.noAnswerReview}</p>
          )}
        </section>
      </section>
    </div>
  )
}

function DetailList({ title, items }) {
  return (
    <section className="detail-list-panel">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function AnswerReviewItem({ answer, copy, index }) {
  return (
    <article className="answer-review-item">
      <div className="answer-review-heading">
        <strong>{copy.question} {index + 1}</strong>
        <span>{answer.score || 0}/100</span>
      </div>
      <p className="answer-review-question">{answer.question}</p>
      <div className="answer-review-grid">
        <div>
          <small>{copy.yourAnswer}</small>
          <p>{answer.answer}</p>
        </div>
        <div>
          <small>{copy.aiFeedback}</small>
          <p>{answer.feedback || copy.noFeedback}</p>
        </div>
      </div>
    </article>
  )
}

function TimelineItem({ appCopy, item, language }) {
  return (
    <article className="timeline-item">
      <span className={`timeline-dot ${item.tone}`}><Icon name={item.icon} /></span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
        <span>{formatDateTime(item.date, language, appCopy)}</span>
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

function buildActivities(cvRows, interviewRows, copy) {
  const cvActivities = cvRows.map((item) => ({
    id: `cv-${getCvKey(item)}`,
    type: 'cv',
    title: item.fileName || copy.activities.cvDefault,
    description: item.suggestedPosition || copy.activities.cvDescription,
    date: item.analyzedAt || item.uploadedAt || item.createdAt,
    score: item.cvScore || 0,
    icon: 'file',
    tone: 'purple',
  }))
  const interviewActivities = interviewRows.map((item) => ({
    id: `interview-${getInterviewKey(item)}`,
    type: 'interview',
    title: item.role || copy.activities.interviewDefault,
    description: item.recommendation || copy.activities.interviewDescription,
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

function getNextAction(cvRows, interviewRows, copy) {
  if (!cvRows.length) {
    return copy.nextActions[0]
  }

  if (!interviewRows.length) {
    return copy.nextActions[1]
  }

  return copy.nextActions[2]
}

function handleDeleteCv(item, onDeleteCv, copy) {
  const fileName = item?.fileName || 'this CV'

  if (window.confirm(copy.deleteConfirm(fileName))) {
    onDeleteCv(item)
  }
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
      answer: answer.answer || answer.answerText || answer.transcript || 'No saved answer.',
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

function formatDateTime(value, language = 'en', appCopy = getAppCopy(language)) {
  if (!value) {
    return appCopy.common.noDate
  }

  return new Intl.DateTimeFormat(getLocale(language), {
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
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
