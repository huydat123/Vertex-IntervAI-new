import { useEffect, useMemo, useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import {
  createCvPresignedUrl,
  exportAdminCsv,
  generateReviewSummary,
  getAdminAuditLogs,
  getAdminCvs,
  getAdminInterviews,
  getAdminReviewQueue,
  getAdminSummary,
  getAdminUsers,
  sendFeedbackEmail,
} from '../../services/adminApi.js'
import { getAppCopy, getLocale } from '../../services/i18n.js'
import '../Dashboard/Dashboard.css'
import './Admin.css'

const adminNavItems = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'users', label: 'Users', icon: 'user' },
  { id: 'cvs', label: 'CVs', icon: 'file' },
  { id: 'interviews', label: 'Interviews', icon: 'mic' },
  { id: 'review', label: 'Review Queue', icon: 'list' },
  { id: 'audit', label: 'Audit Log', icon: 'shield' },
  { id: 'export', label: 'Export CSV', icon: 'download' },
  { id: 'feedback', label: 'Email Feedback', icon: 'mail' },
]

const fallbackUser = {
  userId: 'admin_demo_001',
  fullName: 'Admin Talent Graph',
  initials: 'AD',
  role: 'admin',
}

const fallbackData = {
  summary: {
    totalUsers: 2,
    totalCvs: 1,
    analyzedCvs: 1,
    totalInterviews: 1,
    completedInterviews: 1,
    averageCvScore: 82,
    averageInterviewScore: 76,
  },
  users: [
    {
      userId: 'user_demo_001',
      fullName: 'Nguyen Huy Dat',
      email: 'user@talentgraph.ai',
      role: 'user',
      status: 'CONFIRMED',
      latestCvScore: 82,
      latestInterviewScore: 76,
    },
    {
      userId: 'admin_demo_001',
      fullName: 'Admin Talent Graph',
      email: 'admin@talentgraph.ai',
      role: 'admin',
      status: 'CONFIRMED',
      latestCvScore: 0,
      latestInterviewScore: 0,
    },
  ],
  cvs: [
    {
      cvId: 'cv_demo_001',
      userId: 'user_demo_001',
      fileName: 'Nguyen-Huy-Dat-CV.pdf',
      status: 'ANALYZED',
      cvScore: 82,
      suggestedPosition: 'Frontend Developer Intern',
      createdAt: '2026-07-13T08:00:00.000Z',
    },
  ],
  interviews: [
    {
      interviewId: 'interview_demo_001',
      userId: 'user_demo_001',
      role: 'Frontend Developer Intern',
      status: 'COMPLETED',
      answeredQuestions: 6,
      totalQuestions: 6,
      overallScore: 76,
      completedAt: '2026-07-13T09:00:00.000Z',
    },
  ],
}

export default function Admin({
  currentUser = fallbackUser,
  language = 'en',
  colorTheme = 'black',
  onLanguageChange = () => {},
  onThemeChange = () => {},
  onNavigate = () => {},
  onLogout = () => {},
}) {
  const appCopy = getAppCopy(language)
  const copy = appCopy.admin
  const [activeTab, setActiveTab] = useState('overview')
  const [summary, setSummary] = useState(fallbackData.summary)
  const [users, setUsers] = useState(fallbackData.users)
  const [cvs, setCvs] = useState(fallbackData.cvs)
  const [interviews, setInterviews] = useState(fallbackData.interviews)
  const [reviewItems, setReviewItems] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [auditDiagnostics, setAuditDiagnostics] = useState({})
  const [status, setStatus] = useState(copy.statuses.loading)
  const [operationStatus, setOperationStatus] = useState('')
  const [reviewSummary, setReviewSummary] = useState('')
  const [reviewSummarySource, setReviewSummarySource] = useState('')
  const [feedbackForm, setFeedbackForm] = useState({
    userId: '',
    recipientEmail: '',
    subject: 'Talent Graph AI interview feedback',
    message: '',
  })
  const isAdmin = isAdminUser(currentUser)

  useEffect(() => {
    if (!isAdmin) {
      setStatus(copy.statuses.required)
      return
    }

    let isMounted = true

    async function loadAdminData() {
      const [summaryResult, userResult, cvResult, interviewResult, reviewResult, auditResult] =
        await Promise.allSettled([
          getAdminSummary(),
          getAdminUsers(),
          getAdminCvs(),
          getAdminInterviews(),
          getAdminReviewQueue(),
          getAdminAuditLogs(),
        ])

      if (!isMounted) return

      if (userResult.status === 'fulfilled') {
        setUsers(userResult.value.users)
        setStatus(getAdminSyncStatus(userResult.value, language))
      } else {
        setUsers([])
        setStatus(`Could not load Cognito users: ${userResult.reason.message}`)
      }

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value.summary || summaryResult.value)
      } else if (userResult.status === 'fulfilled') {
        setSummary((current) => ({
          ...current,
          totalUsers: userResult.value.users.length,
        }))
      }

      if (cvResult.status === 'fulfilled') {
        setCvs(cvResult.value)
      } else {
        setCvs([])
      }

      if (interviewResult.status === 'fulfilled') {
        setInterviews(interviewResult.value)
      } else {
        setInterviews([])
      }

      if (reviewResult.status === 'fulfilled') {
        setReviewItems(reviewResult.value)
      } else {
        setReviewItems([])
      }

      if (auditResult.status === 'fulfilled') {
        setAuditLogs(auditResult.value.auditLogs)
        setAuditDiagnostics(auditResult.value.diagnostics)
      } else {
        setAuditLogs([])
        setAuditDiagnostics({
          auditErrorMessage: auditResult.reason.message,
        })
      }
    }

    loadAdminData()

    return () => {
      isMounted = false
    }
  }, [copy, isAdmin, language])

  const reviewQueue = useMemo(() => {
    if (reviewItems.length) {
      return reviewItems
    }

    return interviews
      .filter((item) => Number(item.overallScore || 0) < 60 || item.status === 'IN_PROGRESS')
      .map((item) => ({
        type: 'interview',
        id: item.interviewId,
        userId: item.userId,
        title: item.role || 'Interview',
        status: item.status || 'IN_PROGRESS',
        score: Number(item.overallScore || 0),
        reasons: [Number(item.overallScore || 0) < 60 ? 'Interview score below 60' : 'Interview still in progress'],
        updatedAt: item.completedAt || item.updatedAt || item.createdAt,
      }))
  }, [interviews, reviewItems])

  async function handleOpenCv(cv) {
    try {
      setOperationStatus(copy.statuses.cvLink)
      const data = await createCvPresignedUrl({ userId: cv.userId, cvId: cv.cvId })
      window.open(data.url, '_blank', 'noopener,noreferrer')
      setOperationStatus(`Secure CV link created. It expires in ${data.expiresIn || 300} seconds.`)
      void refreshAuditLogs()
    } catch (error) {
      setOperationStatus(`Could not open CV: ${error.message}`)
    }
  }

  async function handleGenerateReviewSummary(userId = '') {
    try {
      setOperationStatus(copy.statuses.summary)
      const data = await generateReviewSummary({ userId })
      setReviewSummary(data.summary || '')
      setReviewSummarySource(data.source || 'unknown')
      setOperationStatus(`Review summary generated from ${data.source || 'admin API'}.`)
      void refreshAuditLogs()
    } catch (error) {
      setOperationStatus(`Could not generate summary: ${error.message}`)
    }
  }

  async function handleExport(dataset) {
    try {
      setOperationStatus(`Exporting ${dataset} CSV...`)
      const data = await exportAdminCsv(dataset)
      window.open(data.url, '_blank', 'noopener,noreferrer')
      setOperationStatus(`CSV export ready: ${data.rowCount || 0} rows. Link expires in ${data.expiresIn || 300} seconds.`)
      void refreshAuditLogs()
    } catch (error) {
      setOperationStatus(`Could not export CSV: ${error.message}`)
    }
  }

  function handleFeedbackUserChange(userId) {
    const selectedUser = users.find((user) => user.userId === userId)
    setFeedbackForm({
      userId,
      recipientEmail: selectedUser?.email || '',
      subject: 'Talent Graph AI interview feedback',
      message: buildDefaultFeedbackMessage(selectedUser, language),
    })
  }

  function handleFeedbackFieldChange(field, value) {
    setFeedbackForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSendFeedback(event) {
    event.preventDefault()

    try {
      setOperationStatus(copy.statuses.sending)
      const data = await sendFeedbackEmail(feedbackForm)
      setOperationStatus(`Feedback email sent. SES message id: ${data.messageId || 'created'}.`)
      void refreshAuditLogs()
    } catch (error) {
      setOperationStatus(`Could not send feedback email: ${error.message}`)
    }
  }

  async function refreshAuditLogs() {
    try {
      const data = await getAdminAuditLogs()
      setAuditLogs(data.auditLogs)
      setAuditDiagnostics(data.diagnostics)
    } catch {
      // The main action already reports a useful status. Audit refresh is best-effort.
    }
  }

  if (!isAdmin) {
    return (
      <div className="dashboard-page admin-page">
        <div className="admin-denied panel">
          <span><Icon name="shield" /></span>
          <h1>{copy.deniedTitle}</h1>
          <p>{copy.deniedText}</p>
          <button className="primary-action" type="button" onClick={() => onNavigate('dashboard')}>
            <Icon name="dashboard" />
            {appCopy.common.backDashboard}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page admin-page">
      <div className="dashboard-frame">
        <AdminSidebar appCopy={appCopy} currentTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} />

        <main className="dashboard-main">
          <header className="topbar">
            <div className="topbar-title">
              <span className="icon-button admin-topbar-icon" aria-hidden="true">
                <Icon name="shield" />
              </span>
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
              <span className="admin-sync-state">{status}</span>
              <div className="user-chip" aria-label={appCopy.common.currentUser}>
                <span>{currentUser.fullName}</span>
                <small>{currentUser.role}</small>
                <div className="avatar">{currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : currentUser.initials}</div>
              </div>
            </div>
          </header>

          <div className="dashboard-content admin-content">
            <section className="admin-hero panel">
              <div>
                <p className="eyebrow">{copy.heroEyebrow}</p>
                <h1>{copy.heroTitle}</h1>
                <p>{copy.heroText}</p>
              </div>
              <div className="admin-hero-meter">
                <span>{copy.completedInterviews}</span>
                <strong>{summary.completedInterviews || 0}<small>/{summary.totalInterviews || 0}</small></strong>
                <p>{getCompletionLabel(summary.completedInterviews, summary.totalInterviews, copy)}</p>
              </div>
            </section>

            <section className="admin-stats-grid" aria-label="Admin summary">
              <AdminStat icon="user" label={copy.stats[0]} value={summary.totalUsers} tone="blue" />
              <AdminStat icon="file" label={copy.stats[1]} value={summary.totalCvs} tone="purple" />
              <AdminStat icon="check" label={copy.stats[2]} value={summary.analyzedCvs} tone="green" />
              <AdminStat icon="mic" label={copy.stats[3]} value={summary.totalInterviews} tone="orange" />
              <AdminStat icon="chart" label={copy.stats[4]} value={summary.averageCvScore} suffix="/100" tone="blue" />
              <AdminStat icon="shield" label={copy.stats[5]} value={summary.averageInterviewScore} suffix="/100" tone="green" />
            </section>

            <div className="admin-tabs" role="tablist" aria-label="Admin views">
              {adminNavItems.map((item) => (
                <button
                  className={activeTab === item.id ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                >
                  {copy.tabs[item.id] || item.label}
                </button>
              ))}
            </div>

            {operationStatus ? <div className="admin-action-status">{operationStatus}</div> : null}

            {activeTab === 'overview' ? (
              <OverviewPanel copy={copy} users={users} cvs={cvs} interviews={interviews} reviewQueue={reviewQueue} />
            ) : null}
            {activeTab === 'users' ? <UsersPanel copy={copy} users={users} /> : null}
            {activeTab === 'cvs' ? <CvsPanel copy={copy} cvs={cvs} language={language} onOpenCv={handleOpenCv} /> : null}
            {activeTab === 'interviews' ? <InterviewsPanel copy={copy} interviews={interviews} language={language} /> : null}
            {activeTab === 'review' ? (
              <ReviewPanel
                copy={copy}
                language={language}
                reviewItems={reviewQueue}
                reviewSummary={reviewSummary}
                reviewSummarySource={reviewSummarySource}
                onGenerateSummary={handleGenerateReviewSummary}
              />
            ) : null}
            {activeTab === 'audit' ? <AuditPanel copy={copy} auditLogs={auditLogs} diagnostics={auditDiagnostics} language={language} /> : null}
            {activeTab === 'export' ? <ExportPanel copy={copy} onExport={handleExport} /> : null}
            {activeTab === 'feedback' ? (
              <FeedbackPanel
                copy={copy}
                users={users}
                form={feedbackForm}
                onUserChange={handleFeedbackUserChange}
                onFieldChange={handleFeedbackFieldChange}
                onSubmit={handleSendFeedback}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function OverviewPanel({ copy, users, cvs, interviews, reviewQueue }) {
  return (
    <section className="admin-overview-grid">
      <div className="panel admin-list-panel">
        <PanelHeader title={copy.overview.usersTitle} description={copy.overview.usersText} />
        <div className="admin-compact-list">
          {users.slice(0, 5).map((user) => (
            <CompactRow
              icon="user"
              title={user.fullName || user.email || user.userId}
              meta={`${user.role || 'user'} / ${user.status || copy.unknown}`}
              value={user.latestCvScore ? `${user.latestCvScore}/100` : copy.noScore}
              key={user.userId || user.email}
            />
          ))}
        </div>
      </div>

      <div className="panel admin-list-panel">
        <PanelHeader title={copy.overview.reviewTitle} description={copy.overview.reviewText} />
        {reviewQueue.length ? (
          <div className="admin-compact-list">
            {reviewQueue.slice(0, 6).map((item) => (
              <CompactRow
                icon="mic"
                title={item.title || item.role || copy.tabs.review}
                meta={`${item.userName || item.userId || copy.unknown} / ${item.status || 'UNKNOWN'}`}
                value={`${item.score ?? item.overallScore ?? 0}/100`}
                key={`${item.type || 'review'}-${item.id || item.interviewId}`}
              />
            ))}
          </div>
        ) : (
          <EmptyAdminState title={copy.overview.noWeakTitle} text={copy.overview.noWeakText} />
        )}
      </div>

      <div className="panel admin-list-panel">
        <PanelHeader title={copy.overview.cvsTitle} description={copy.overview.cvsText} />
        <div className="admin-compact-list">
          {cvs.slice(0, 5).map((item) => (
            <CompactRow
              icon="file"
              title={item.fileName || item.cvId}
              meta={`${item.userId} / ${item.status || 'UPLOADED'}`}
              value={`${item.cvScore || 0}/100`}
              key={item.cvId}
            />
          ))}
        </div>
      </div>

      <div className="panel admin-list-panel">
        <PanelHeader title={copy.overview.interviewsTitle} description={copy.overview.interviewsText} />
        <div className="admin-compact-list">
          {interviews.slice(0, 5).map((item) => (
            <CompactRow
              icon="chart"
              title={item.role || 'Interview'}
              meta={`${item.answeredQuestions || 0}/${item.totalQuestions || 0} answered`}
              value={`${item.overallScore || 0}/100`}
              key={item.interviewId}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function UsersPanel({ copy, users }) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.usersTitle} description={copy.usersText} />
      <AdminTable
        emptyTitle={copy.emptyTitle}
        emptyText={copy.emptyText}
        columns={copy.usersColumns}
        rows={users.map((user) => [
          user.fullName || user.userId || 'User',
          user.email || copy.noEmail,
          user.role || 'user',
          user.status || 'unknown',
          formatScore(user.latestCvScore, copy),
          formatScore(user.latestInterviewScore, copy),
        ])}
      />
    </section>
  )
}

function CvsPanel({ copy, cvs, language, onOpenCv }) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.cvsTitle} description={copy.cvsText} />
      <AdminTable
        emptyTitle={copy.emptyTitle}
        emptyText={copy.emptyText}
        columns={copy.cvsColumns}
        rows={cvs.map((cv) => [
          cv.fileName || cv.cvId || 'CV',
          cv.userId || copy.unknown,
          cv.status || 'UPLOADED',
          formatScore(cv.cvScore, copy),
          cv.suggestedPosition || copy.notAnalyzed,
          formatDate(cv.analyzedAt || cv.updatedAt || cv.createdAt, language),
          (
            <button
              key={`${cv.userId}-${cv.cvId}-open`}
              className="admin-row-action"
              type="button"
              disabled={!cv.userId || !cv.cvId}
              onClick={() => onOpenCv(cv)}
            >
              <Icon name="external" />
              {copy.openCv}
            </button>
          ),
        ])}
      />
    </section>
  )
}

function InterviewsPanel({ copy, interviews, language }) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.interviewsTitle} description={copy.interviewsText} />
      <AdminTable
        emptyTitle={copy.emptyTitle}
        emptyText={copy.emptyText}
        columns={copy.interviewsColumns}
        rows={interviews.map((item) => [
          item.role || 'Interview',
          item.userId || copy.unknown,
          item.status || 'IN_PROGRESS',
          `${item.answeredQuestions || 0}/${item.totalQuestions || 0}`,
          formatScore(item.overallScore, copy),
          formatDate(item.completedAt || item.updatedAt || item.createdAt, language),
        ])}
      />
    </section>
  )
}

function ReviewPanel({ copy, language, reviewItems, reviewSummary, reviewSummarySource, onGenerateSummary }) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader
        title={copy.reviewTitle}
        description={copy.reviewText}
      />
      <div className="admin-panel-actions">
        <button className="admin-command-button" type="button" onClick={() => onGenerateSummary()}>
          <Icon name="sparkles" />
          {copy.generateSummary}
        </button>
      </div>

      {reviewSummary ? (
        <div className="admin-summary-box">
          <strong>{copy.aiSummary(reviewSummarySource)}</strong>
          <p>{reviewSummary}</p>
        </div>
      ) : null}

      <AdminTable
        emptyTitle={copy.emptyTitle}
        emptyText={copy.emptyText}
        columns={copy.reviewColumns}
        rows={reviewItems.map((item) => [
          item.type || 'review',
          item.userName || item.userId || copy.unknown,
          item.title || item.id || copy.reviewColumns[2],
          item.status || 'UNKNOWN',
          formatScore(item.score, copy),
          Array.isArray(item.reasons) ? item.reasons.join('; ') : copy.reviewTitle,
          formatDate(item.updatedAt, language),
        ])}
      />
    </section>
  )
}

function AuditPanel({ copy, auditLogs, diagnostics, language }) {
  const errorCode = diagnostics?.auditErrorCode

  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.auditTitle} description={copy.auditText} />
      {errorCode ? (
        <div className="admin-warning">
          {copy.auditWarning(errorCode)}
        </div>
      ) : null}
      <AdminTable
        emptyTitle={copy.emptyTitle}
        emptyText={copy.emptyText}
        columns={copy.auditColumns}
        rows={auditLogs.map((item) => [
          formatDateTime(item.createdAt, language),
          item.adminEmail || item.adminUserId || copy.admin,
          item.action || 'ACTION',
          `${item.resourceType || 'resource'} / ${item.resourceId || '-'}`,
          formatDetails(item.details, copy),
        ])}
      />
    </section>
  )
}

function ExportPanel({ copy, onExport }) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.exportTitle} description={copy.exportText} />
      <div className="admin-export-grid">
        {copy.datasets.map(([id, label, description]) => (
          <button className="admin-export-card" type="button" key={id} onClick={() => onExport(id)}>
            <span><Icon name="download" /></span>
            <strong>{label}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function FeedbackPanel({ copy, users, form, onUserChange, onFieldChange, onSubmit }) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.feedbackTitle} description={copy.feedbackText} />
      <form className="admin-feedback-form" onSubmit={onSubmit}>
        <label>
          <span>{copy.feedbackFields[0]}</span>
          <select value={form.userId} onChange={(event) => onUserChange(event.target.value)}>
            <option value="">{copy.chooseUser}</option>
            {users.map((user) => (
              <option value={user.userId} key={user.userId || user.email}>
                {user.fullName || user.email || user.userId}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{copy.feedbackFields[1]}</span>
          <input
            type="email"
            value={form.recipientEmail}
            onChange={(event) => onFieldChange('recipientEmail', event.target.value)}
            placeholder="candidate@example.com"
            required
          />
        </label>

        <label>
          <span>{copy.feedbackFields[2]}</span>
          <input
            value={form.subject}
            onChange={(event) => onFieldChange('subject', event.target.value)}
            required
          />
        </label>

        <label className="admin-feedback-message">
          <span>{copy.feedbackFields[3]}</span>
          <textarea
            value={form.message}
            onChange={(event) => onFieldChange('message', event.target.value)}
            rows={9}
            required
          />
        </label>

        <button className="admin-command-button" type="submit">
          <Icon name="mail" />
          {copy.sendFeedback}
        </button>
      </form>
    </section>
  )
}

function AdminSidebar({ appCopy, currentTab, onTabChange, onLogout }) {
  return (
    <aside className="sidebar" aria-label="Admin navigation">
      <div className="brand">
        <div className="brand-mark"><Icon name="brain" /></div>
        <div>
          <strong>Vertex-IntervAI</strong>
          <span>{appCopy.admin.page}</span>
        </div>
      </div>

      <nav className="nav-menu">
        <span className="nav-caption">{appCopy.common.adminMenu}</span>
        {adminNavItems.map((item) => (
          <button
            className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
            type="button"
            key={item.id}
            onClick={() => onTabChange(item.id)}
          >
            <Icon name={item.icon} />
            <span>{appCopy.admin.tabs[item.id] || item.label}</span>
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

function AdminStat({ icon, label, value = 0, suffix = '', tone }) {
  return (
    <article className={`admin-stat ${tone}`}>
      <span><Icon name={icon} /></span>
      <div>
        <small>{label}</small>
        <strong>{Number(value || 0)}<em>{suffix}</em></strong>
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

function CompactRow({ icon, title, meta, value }) {
  return (
    <article className="admin-compact-row">
      <span><Icon name={icon} /></span>
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
      <em>{value}</em>
    </article>
  )
}

function EmptyAdminState({ title, text }) {
  return (
    <div className="admin-empty">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

function AdminTable({ columns, rows, emptyTitle = 'No records yet', emptyText = 'AWS data will appear here after users start using the workflow.' }) {
  if (!rows.length) {
    return <EmptyAdminState title={emptyTitle} text={emptyText} />
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function isAdminUser(user) {
  return user?.role === 'admin' || user?.groups?.includes?.('admin')
}

function formatScore(value, copy) {
  return Number(value || 0) ? `${Number(value)}/100` : copy.noScore
}

function formatDate(value, language = 'en') {
  if (!value) return getAppCopy(language).common.noDate

  return new Intl.DateTimeFormat(getLocale(language), {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value, language = 'en') {
  if (!value) return getAppCopy(language).common.noDate

  return new Intl.DateTimeFormat(getLocale(language), {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDetails(value, copy) {
  if (!value || typeof value !== 'object') {
    return copy.noDetails
  }

  return Object.entries(value)
    .slice(0, 3)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(', ')
}

function buildDefaultFeedbackMessage(user, language = 'en') {
  const name = user?.fullName || user?.email || 'Candidate'
  const cvScore = Number(user?.latestCvScore || 0)
  const interviewScore = Number(user?.latestInterviewScore || 0)

  if (language === 'vi') {
    return [
      `Chào ${name},`,
      '',
      'Cảm ơn bạn đã sử dụng Talent Graph AI. Đây là feedback ngắn từ admin:',
      cvScore ? `- Điểm CV mới nhất: ${cvScore}/100` : '- CV của bạn đã sẵn sàng để review.',
      interviewScore ? `- Điểm phỏng vấn mới nhất: ${interviewScore}/100` : '- Hãy hoàn thành một vòng phỏng vấn AI để nhận feedback phỏng vấn.',
      '- Hãy tập trung vào bằng chứng dự án rõ hơn, quyết định kỹ thuật cụ thể và câu trả lời có cấu trúc.',
      '',
      'Trân trọng,',
      'Talent Graph AI Admin Team',
    ].join('\n')
  }

  return [
    `Hello ${name},`,
    '',
    'Thank you for using Talent Graph AI. Here is a short feedback note from the admin team:',
    cvScore ? `- Latest CV score: ${cvScore}/100` : '- Your CV is available for review.',
    interviewScore ? `- Latest interview score: ${interviewScore}/100` : '- Please complete an AI interview round to receive interview feedback.',
    '- Focus on clearer project evidence, concrete technical decisions, and structured interview answers.',
    '',
    'Best regards,',
    'Talent Graph AI Admin Team',
  ].join('\n')
}

function getCompletionLabel(completed, total, copy) {
  if (!total) return copy.completion.none
  if (completed >= total) return copy.completion.all
  return copy.completion.review
}

function getAdminSyncStatus(userData, language = 'en') {
  const isVi = language === 'vi'
  const diagnostics = userData?.diagnostics || {}
  const tableDiagnostics = Object.values(userData?.tableDiagnostics || {})
  const tableIssueCount = tableDiagnostics.filter((item) => item?.errorCode).length

  if (userData?.source === 'cognito') {
    const count = diagnostics.cognitoLoadedCount ?? userData.users?.length ?? 0
    if (diagnostics.groupLookupErrors) {
      return isVi
        ? `Đã đồng bộ từ AWS admin API / Cognito users: ${count}, lỗi group lookup: ${diagnostics.groupLookupErrors}`
        : `Synced from AWS admin API / Cognito users: ${count}, group lookup issues: ${diagnostics.groupLookupErrors}`
    }
    if (tableIssueCount) {
      return isVi
        ? `Đã đồng bộ từ AWS admin API / Cognito users: ${count}, lỗi bảng: ${tableIssueCount}`
        : `Synced from AWS admin API / Cognito users: ${count}, table issues: ${tableIssueCount}`
    }
    return isVi
      ? `Đã đồng bộ từ AWS admin API / Cognito users: ${count}`
      : `Synced from AWS admin API / Cognito users: ${count}`
  }

  if (!diagnostics.cognitoConfigured) {
    return isVi
      ? 'Đã đồng bộ từ AWS admin API / thiếu Cognito env, chỉ hiển thị DynamoDB users'
      : 'Synced from AWS admin API / Cognito env missing, showing DynamoDB users only'
  }

  if (diagnostics.cognitoErrorCode) {
    return isVi
      ? `Đã đồng bộ từ AWS admin API / Cognito lỗi: ${diagnostics.cognitoErrorCode}`
      : `Synced from AWS admin API / Cognito failed: ${diagnostics.cognitoErrorCode}`
  }

  if (diagnostics.groupLookupErrors) {
    return isVi
      ? `Đã đồng bộ từ AWS admin API / lỗi group lookup: ${diagnostics.groupLookupErrors}`
      : `Synced from AWS admin API / Group lookup issues: ${diagnostics.groupLookupErrors}`
  }

  return isVi
    ? 'Đã đồng bộ từ AWS admin API / chỉ có DynamoDB users'
    : 'Synced from AWS admin API / DynamoDB users only'
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
    brain: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 5 2.2M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-5 2.2M12 5v14M8 10h3M13 10h3M8 15h3M13 15h3" />,
    shield: <path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6zM9 12l2 2 4-4" />,
    check: <path d="M20 6 9 17l-5-5" />,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
    mail: <path d="M4 5h16v14H4zM4 7l8 6 8-6" />,
    sparkles: <path d="M12 3l1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z" />,
    external: <path d="M14 4h6v6M20 4l-9 9M20 14v5H5V4h5" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
