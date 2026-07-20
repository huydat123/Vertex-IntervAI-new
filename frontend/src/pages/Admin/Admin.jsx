import { useEffect, useMemo, useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import {
  createCvPresignedUrl,
  deleteAdminInterview,
  exportAdminCsv,
  generateReviewSummary,
  getAdminAuditLogs,
  getAdminCvs,
  getAdminInterviews,
  getAdminReviewQueue,
  getAdminSummary,
  getAdminUsers,
  sendFeedbackEmail,
  updateAdminUserAccess,
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

const defaultAdminFilters = {
  usersSearch: '',
  usersAccess: 'all',
  usersStatus: 'all',
  cvsSearch: '',
  cvsStatus: 'all',
  interviewsSearch: '',
  interviewsStatus: 'all',
  interviewsScore: 'all',
  reviewSearch: '',
  reviewType: 'all',
  reviewStatus: 'all',
  auditSearch: '',
  auditAction: 'all',
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
  const [pendingUserAction, setPendingUserAction] = useState('')
  const [pendingInterviewAction, setPendingInterviewAction] = useState('')
  const [filters, setFilters] = useState(defaultAdminFilters)
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
        setStatus(`Could not load user accounts: ${userResult.reason.message}`)
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
  const candidateUsers = useMemo(() => users.filter((user) => !isAdminAccount(user)), [users])
  const filteredUsers = useMemo(() => filterAdminUsers(candidateUsers, filters), [candidateUsers, filters])
  const filteredCvs = useMemo(() => filterAdminCvs(cvs, filters), [cvs, filters])
  const filteredInterviews = useMemo(() => filterAdminInterviews(interviews, filters), [interviews, filters])
  const filteredReviewQueue = useMemo(() => filterAdminReviewItems(reviewQueue, filters), [reviewQueue, filters])
  const filteredAuditLogs = useMemo(() => filterAdminAuditLogs(auditLogs, filters), [auditLogs, filters])
  const adminSummary = {
    ...summary,
    totalUsers: candidateUsers.length,
  }
  const overviewMetrics = useMemo(() => ([
    candidateUsers.filter((user) => isUserLocked(user)).length,
    candidateUsers.filter((user) => isUserUnconfirmed(user)).length,
    reviewQueue.length,
    cvs.slice(0, 7).length,
  ]), [candidateUsers, cvs, reviewQueue])

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

  function handleFilterChange(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleUserAccessAction(user, action) {
    const name = getUserDisplayName(user, copy)
    const actionCopy = copy.userActions
    const confirmMessage = action === 'delete'
      ? actionCopy.deleteConfirm(name)
      : action === 'unlock'
        ? actionCopy.unlockConfirm(name)
        : actionCopy.lockConfirm(name)

    if (!window.confirm(confirmMessage)) {
      return
    }

    setPendingUserAction(`${action}-${user.userId || user.username}`)
    setOperationStatus(action === 'delete'
      ? actionCopy.deleteLoading(name)
      : action === 'unlock'
        ? actionCopy.unlockLoading(name)
        : actionCopy.lockLoading(name))

    try {
      const result = await updateAdminUserAccess({
        userId: user.userId,
        username: user.username,
        action,
      })

      setUsers((current) => {
        if (action === 'delete') {
          return current.filter((item) => !isSameUser(item, user))
        }

        return current.map((item) => (
          isSameUser(item, user)
            ? {
              ...item,
              ...(result.user || {}),
              enabled: action === 'unlock',
            }
            : item
        ))
      })

      await refreshAdminCoreData()
      setOperationStatus(action === 'delete'
        ? actionCopy.deleteDone(name)
        : action === 'unlock'
          ? actionCopy.unlockDone(name)
          : actionCopy.lockDone(name))
    } catch (error) {
      setOperationStatus(actionCopy.actionError(name, error.message))
    } finally {
      setPendingUserAction('')
    }
  }

  async function handleDeleteInterview(interview) {
    const title = interview.role || interview.interviewId || copy.tabs.interviews
    const actionKey = getInterviewActionKey(interview)
    const actionCopy = copy.interviewActions

    if (!window.confirm(actionCopy.deleteConfirm(title))) {
      return
    }

    setPendingInterviewAction(actionKey)
    setOperationStatus(actionCopy.deleteLoading(title))

    try {
      await deleteAdminInterview({
        userId: interview.userId,
        interviewId: interview.interviewId,
      })

      setInterviews((current) => current.filter((item) => getInterviewActionKey(item) !== actionKey))
      setReviewItems((current) => current.filter((item) => (
        item.id !== interview.interviewId
        && item.interviewId !== interview.interviewId
      )))
      await refreshAdminCoreData()
      setOperationStatus(actionCopy.deleteDone(title))
    } catch (error) {
      setOperationStatus(actionCopy.deleteError(title, error.message))
    } finally {
      setPendingInterviewAction('')
    }
  }

  async function handleGenerateReviewSummary(userId = '') {
    try {
      setOperationStatus(copy.statuses.summary)
      const data = await generateReviewSummary({ userId })
      setReviewSummary(data.summary || '')
      setReviewSummarySource('AI')
      setOperationStatus('Review summary generated.')
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

  async function refreshAdminCoreData() {
    const [summaryResult, userResult, auditResult] = await Promise.allSettled([
      getAdminSummary(),
      getAdminUsers(),
      getAdminAuditLogs(),
    ])

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value.summary || summaryResult.value)
    }

    if (userResult.status === 'fulfilled') {
      setUsers(userResult.value.users)
      setStatus(getAdminSyncStatus(userResult.value, language))
    }

    if (auditResult.status === 'fulfilled') {
      setAuditLogs(auditResult.value.auditLogs)
      setAuditDiagnostics(auditResult.value.diagnostics)
    }
  }

  function handleFeedbackUserChange(userId) {
    const selectedUser = candidateUsers.find((user) => user.userId === userId)
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
      setOperationStatus(`Feedback email queued. Message id: ${data.messageId || 'created'}.`)
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
                <strong>{adminSummary.completedInterviews || 0}<small>/{adminSummary.totalInterviews || 0}</small></strong>
                <p>{getCompletionLabel(adminSummary.completedInterviews, adminSummary.totalInterviews, copy)}</p>
              </div>
            </section>

            <section className="admin-stats-grid" aria-label="Admin summary">
              <AdminStat icon="user" label={copy.stats[0]} value={adminSummary.totalUsers} tone="blue" />
              <AdminStat icon="file" label={copy.stats[1]} value={adminSummary.totalCvs} tone="purple" />
              <AdminStat icon="check" label={copy.stats[2]} value={adminSummary.analyzedCvs} tone="green" />
              <AdminStat icon="mic" label={copy.stats[3]} value={adminSummary.totalInterviews} tone="orange" />
              <AdminStat icon="chart" label={copy.stats[4]} value={adminSummary.averageCvScore} suffix="/100" tone="blue" />
              <AdminStat icon="shield" label={copy.stats[5]} value={adminSummary.averageInterviewScore} suffix="/100" tone="green" />
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
              <OverviewPanel
                copy={copy}
                users={candidateUsers}
                cvs={cvs}
                interviews={interviews}
                overviewMetrics={overviewMetrics}
                reviewQueue={reviewQueue}
                onTabChange={setActiveTab}
              />
            ) : null}
            {activeTab === 'users' ? (
              <UsersPanel
                copy={copy}
                users={filteredUsers}
                filters={filters}
                onFilterChange={handleFilterChange}
                isFiltered={hasAdminFilters(filters, ['usersSearch', 'usersAccess', 'usersStatus'])}
                pendingUserAction={pendingUserAction}
                onUserAction={handleUserAccessAction}
              />
            ) : null}
            {activeTab === 'cvs' ? (
              <CvsPanel
                copy={copy}
                cvs={filteredCvs}
                filters={filters}
                isFiltered={hasAdminFilters(filters, ['cvsSearch', 'cvsStatus'])}
                language={language}
                onFilterChange={handleFilterChange}
                onOpenCv={handleOpenCv}
              />
            ) : null}
            {activeTab === 'interviews' ? (
              <InterviewsPanel
                copy={copy}
                interviews={filteredInterviews}
                filters={filters}
                isFiltered={hasAdminFilters(filters, ['interviewsSearch', 'interviewsStatus', 'interviewsScore'])}
                language={language}
                pendingInterviewAction={pendingInterviewAction}
                onDeleteInterview={handleDeleteInterview}
                onFilterChange={handleFilterChange}
              />
            ) : null}
            {activeTab === 'review' ? (
              <ReviewPanel
                copy={copy}
                language={language}
                reviewItems={filteredReviewQueue}
                filters={filters}
                isFiltered={hasAdminFilters(filters, ['reviewSearch', 'reviewType', 'reviewStatus'])}
                reviewSummary={reviewSummary}
                reviewSummarySource={reviewSummarySource}
                onFilterChange={handleFilterChange}
                onGenerateSummary={handleGenerateReviewSummary}
              />
            ) : null}
            {activeTab === 'audit' ? (
              <AuditPanel
                copy={copy}
                auditLogs={filteredAuditLogs}
                diagnostics={auditDiagnostics}
                filters={filters}
                isFiltered={hasAdminFilters(filters, ['auditSearch', 'auditAction'])}
                language={language}
                onFilterChange={handleFilterChange}
              />
            ) : null}
            {activeTab === 'export' ? <ExportPanel copy={copy} onExport={handleExport} /> : null}
            {activeTab === 'feedback' ? (
              <FeedbackPanel
                copy={copy}
                users={candidateUsers}
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

function OverviewPanel({ copy, users, cvs, interviews, overviewMetrics, reviewQueue, onTabChange }) {
  const overviewActionCards = [
    { id: 'users', icon: 'user', tone: 'blue' },
    { id: 'review', icon: 'list', tone: 'orange' },
    { id: 'export', icon: 'download', tone: 'purple' },
    { id: 'feedback', icon: 'mail', tone: 'green' },
  ]

  return (
    <section className="admin-overview-grid">
      <div className="panel admin-list-panel admin-action-panel">
        <PanelHeader title={copy.overview.actionTitle} description={copy.overview.actionText} />
        <div className="admin-overview-actions">
          {overviewActionCards.map((item) => {
            const [title, text, actionLabel] = copy.overview.actions[item.id]

            return (
              <button
                className={`admin-overview-action ${item.tone}`}
                type="button"
                key={item.id}
                onClick={() => onTabChange(item.id)}
              >
                <span><Icon name={item.icon} /></span>
                <strong>{title}</strong>
                <small>{text}</small>
                <em>{actionLabel}</em>
              </button>
            )
          })}
        </div>
      </div>

      <div className="panel admin-list-panel admin-health-panel">
        <PanelHeader title={copy.overview.healthTitle} description={copy.overview.healthText} />
        <div className="admin-health-grid">
          {copy.overview.healthItems.map((item, index) => (
            <div className="admin-health-card" key={item}>
              <span>{item}</span>
              <strong>{overviewMetrics[index] || 0}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="panel admin-list-panel">
        <PanelHeader title={copy.overview.usersTitle} description={copy.overview.usersText} />
        <div className="admin-compact-list">
          {users.slice(0, 5).map((user) => (
            <CompactRow
              icon="user"
              title={user.fullName || user.email || user.userId}
              meta={`${isUserLocked(user) ? copy.userActions.locked : copy.userActions.active} / ${user.status || copy.unknown}`}
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

function UsersPanel({ copy, users, filters, isFiltered, pendingUserAction, onFilterChange, onUserAction }) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.usersTitle} description={copy.usersText} />
      <AdminFilters
        fields={[
          {
            id: 'usersSearch',
            label: copy.filters.search,
            value: filters.usersSearch,
            placeholder: copy.filters.userSearch,
          },
          {
            id: 'usersAccess',
            label: copy.filters.access,
            value: filters.usersAccess,
            options: [
              ['all', copy.filters.all],
              ['active', copy.userActions.active],
              ['locked', copy.userActions.locked],
            ],
          },
          {
            id: 'usersStatus',
            label: copy.filters.status,
            value: filters.usersStatus,
            options: [
              ['all', copy.filters.all],
              ['confirmed', copy.filters.confirmed],
              ['unconfirmed', copy.filters.unconfirmed],
              ['other', copy.filters.other],
            ],
          },
        ]}
        onFieldChange={onFilterChange}
      />
      <AdminTable
        emptyTitle={isFiltered ? copy.filterEmptyTitle : copy.emptyTitle}
        emptyText={isFiltered ? copy.filterEmptyText : copy.emptyText}
        columns={copy.usersColumns}
        rows={users.map((user) => {
          const actionKey = user.userId || user.username || user.email
          const isLocked = isUserLocked(user)
          const canLock = Boolean(user.username)
          const canDelete = Boolean(user.username || user.userId)

          return [
          getUserDisplayName(user, copy),
          user.email || copy.noEmail,
          <StatusPill
            key={`${actionKey}-access`}
            label={isLocked ? copy.userActions.locked : copy.userActions.active}
            tone={isLocked ? 'danger' : 'success'}
          />,
          <StatusPill
            key={`${actionKey}-status`}
            label={user.status || copy.unknown}
            tone={isUserUnconfirmed(user) ? 'warning' : 'neutral'}
          />,
          formatScore(user.latestCvScore, copy),
          formatScore(user.latestInterviewScore, copy),
          (
            <div className="admin-user-actions" key={`${actionKey}-actions`}>
              <button
                className={`admin-row-action ${isLocked ? 'success' : 'warning'}`}
                type="button"
                disabled={!canLock || Boolean(pendingUserAction)}
                onClick={() => onUserAction(user, isLocked ? 'unlock' : 'lock')}
              >
                <Icon name={isLocked ? 'unlock' : 'lock'} />
                {isLocked ? copy.userActions.unlock : copy.userActions.lock}
              </button>
              <button
                className="admin-row-action danger"
                type="button"
                disabled={!canDelete || Boolean(pendingUserAction)}
                onClick={() => onUserAction(user, 'delete')}
              >
                <Icon name="trash" />
                {copy.userActions.delete}
              </button>
            </div>
          ),
        ]
        })}
      />
    </section>
  )
}

function CvsPanel({ copy, cvs, filters, isFiltered, language, onFilterChange, onOpenCv }) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.cvsTitle} description={copy.cvsText} />
      <AdminFilters
        fields={[
          {
            id: 'cvsSearch',
            label: copy.filters.search,
            value: filters.cvsSearch,
            placeholder: copy.filters.cvSearch,
          },
          {
            id: 'cvsStatus',
            label: copy.filters.status,
            value: filters.cvsStatus,
            options: [
              ['all', copy.filters.all],
              ['analyzed', copy.filters.analyzed],
              ['uploaded', copy.filters.uploaded],
              ['processing', copy.filters.processing],
              ['failed', copy.filters.failed],
              ['other', copy.filters.other],
            ],
          },
        ]}
        onFieldChange={onFilterChange}
      />
      <AdminTable
        emptyTitle={isFiltered ? copy.filterEmptyTitle : copy.emptyTitle}
        emptyText={isFiltered ? copy.filterEmptyText : copy.emptyText}
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

function InterviewsPanel({
  copy,
  interviews,
  filters,
  isFiltered,
  language,
  pendingInterviewAction,
  onDeleteInterview,
  onFilterChange,
}) {
  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.interviewsTitle} description={copy.interviewsText} />
      <AdminFilters
        fields={[
          {
            id: 'interviewsSearch',
            label: copy.filters.search,
            value: filters.interviewsSearch,
            placeholder: copy.filters.interviewSearch,
          },
          {
            id: 'interviewsStatus',
            label: copy.filters.status,
            value: filters.interviewsStatus,
            options: [
              ['all', copy.filters.all],
              ['completed', copy.filters.completed],
              ['in_progress', copy.filters.inProgress],
              ['other', copy.filters.other],
            ],
          },
          {
            id: 'interviewsScore',
            label: copy.filters.score,
            value: filters.interviewsScore,
            options: [
              ['all', copy.filters.all],
              ['low', copy.filters.lowScore],
              ['passing', copy.filters.passing],
              ['no_score', copy.filters.noScore],
            ],
          },
        ]}
        onFieldChange={onFilterChange}
      />
      <AdminTable
        emptyTitle={isFiltered ? copy.filterEmptyTitle : copy.emptyTitle}
        emptyText={isFiltered ? copy.filterEmptyText : copy.emptyText}
        columns={copy.interviewsColumns}
        rows={interviews.map((item) => {
          const actionKey = getInterviewActionKey(item)

          return [
            item.role || 'Interview',
            item.userId || copy.unknown,
            item.status || 'IN_PROGRESS',
            `${item.answeredQuestions || 0}/${item.totalQuestions || 0}`,
            formatScore(item.overallScore, copy),
            formatDate(item.completedAt || item.updatedAt || item.createdAt, language),
            (
              <button
                key={`${actionKey}-delete`}
                className="admin-row-action danger"
                type="button"
                disabled={!item.userId || !item.interviewId || Boolean(pendingInterviewAction)}
                onClick={() => onDeleteInterview(item)}
              >
                <Icon name="trash" />
                {copy.interviewActions.delete}
              </button>
            ),
          ]
        })}
      />
    </section>
  )
}

function ReviewPanel({
  copy,
  language,
  reviewItems,
  filters,
  isFiltered,
  reviewSummary,
  reviewSummarySource,
  onFilterChange,
  onGenerateSummary,
}) {
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
      <AdminFilters
        fields={[
          {
            id: 'reviewSearch',
            label: copy.filters.search,
            value: filters.reviewSearch,
            placeholder: copy.filters.reviewSearch,
          },
          {
            id: 'reviewType',
            label: copy.filters.type,
            value: filters.reviewType,
            options: [
              ['all', copy.filters.all],
              ['interview', copy.filters.interview],
              ['cv', copy.filters.cv],
              ['user', copy.filters.user],
            ],
          },
          {
            id: 'reviewStatus',
            label: copy.filters.status,
            value: filters.reviewStatus,
            options: [
              ['all', copy.filters.all],
              ['completed', copy.filters.completed],
              ['in_progress', copy.filters.inProgress],
              ['other', copy.filters.other],
            ],
          },
        ]}
        onFieldChange={onFilterChange}
      />

      {reviewSummary ? (
        <div className="admin-summary-box">
          <strong>{copy.aiSummary(reviewSummarySource)}</strong>
          <p>{reviewSummary}</p>
        </div>
      ) : null}

      <AdminTable
        emptyTitle={isFiltered ? copy.filterEmptyTitle : copy.emptyTitle}
        emptyText={isFiltered ? copy.filterEmptyText : copy.emptyText}
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

function AuditPanel({ copy, auditLogs, diagnostics, filters, isFiltered, language, onFilterChange }) {
  const errorCode = diagnostics?.auditErrorCode

  return (
    <section className="panel admin-table-panel">
      <PanelHeader title={copy.auditTitle} description={copy.auditText} />
      <AdminFilters
        fields={[
          {
            id: 'auditSearch',
            label: copy.filters.search,
            value: filters.auditSearch,
            placeholder: copy.filters.auditSearch,
          },
          {
            id: 'auditAction',
            label: copy.filters.action,
            value: filters.auditAction,
            options: [
              ['all', copy.filters.all],
              ['user', copy.filters.user],
              ['interview', copy.filters.interview],
              ['cv', copy.filters.cv],
              ['export', copy.filters.export],
              ['email', copy.filters.email],
            ],
          },
        ]}
        onFieldChange={onFilterChange}
      />
      {errorCode ? (
        <div className="admin-warning">
          {copy.auditWarning(errorCode)}
        </div>
      ) : null}
      <AdminTable
        emptyTitle={isFiltered ? copy.filterEmptyTitle : copy.emptyTitle}
        emptyText={isFiltered ? copy.filterEmptyText : copy.emptyText}
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

function StatusPill({ label, tone = 'neutral' }) {
  return <span className={`admin-status-pill ${tone}`}>{label}</span>
}

function AdminFilters({ fields, onFieldChange }) {
  return (
    <div className="admin-filter-bar" aria-label="Admin filters">
      {fields.map((field) => (
        <label className="admin-filter-field" key={field.id}>
          <span>{field.label}</span>
          {field.options ? (
            <select value={field.value} onChange={(event) => onFieldChange(field.id, event.target.value)}>
              {field.options.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          ) : (
            <input
              type="search"
              value={field.value}
              onChange={(event) => onFieldChange(field.id, event.target.value)}
              placeholder={field.placeholder}
            />
          )}
        </label>
      ))}
    </div>
  )
}

function AdminTable({ columns, rows, emptyTitle = 'No records yet', emptyText = 'Records will appear here after users start using the workflow.' }) {
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

function isAdminAccount(user) {
  return user?.role === 'admin' || user?.groups?.includes?.('admin')
}

function isUserLocked(user) {
  return user?.enabled === false || String(user?.access || '').toUpperCase() === 'LOCKED'
}

function isUserUnconfirmed(user) {
  return String(user?.status || '').toUpperCase() === 'UNCONFIRMED'
}

function isSameUser(left, right) {
  return Boolean(
    (left.userId && left.userId === right.userId)
    || (left.username && left.username === right.username)
    || (left.email && left.email === right.email),
  )
}

function getUserDisplayName(user, copy) {
  return user.fullName || user.email || user.userId || copy.unknown
}

function hasAdminFilters(filters, keys) {
  return keys.some((key) => filters[key] !== defaultAdminFilters[key])
}

function filterAdminUsers(users, filters) {
  return users.filter((user) => {
    if (!matchesAdminSearch(filters.usersSearch, [
      user.fullName,
      user.email,
      user.userId,
      user.username,
      user.status,
    ])) {
      return false
    }

    if (filters.usersAccess === 'active' && isUserLocked(user)) {
      return false
    }

    if (filters.usersAccess === 'locked' && !isUserLocked(user)) {
      return false
    }

    return matchesAdminStatus(user.status, filters.usersStatus, ['confirmed', 'unconfirmed'])
  })
}

function filterAdminCvs(cvs, filters) {
  return cvs.filter((cv) => (
    matchesAdminSearch(filters.cvsSearch, [
      cv.fileName,
      cv.userId,
      cv.cvId,
      cv.status,
      cv.suggestedPosition,
    ])
    && matchesAdminStatus(cv.status || 'UPLOADED', filters.cvsStatus, ['analyzed', 'uploaded', 'processing', 'failed'])
  ))
}

function filterAdminInterviews(interviews, filters) {
  return interviews.filter((interview) => (
    matchesAdminSearch(filters.interviewsSearch, [
      interview.role,
      interview.userId,
      interview.interviewId,
      interview.status,
      interview.cvId,
    ])
    && matchesAdminStatus(interview.status || 'IN_PROGRESS', filters.interviewsStatus, ['completed', 'in_progress'])
    && matchesScoreFilter(interview.overallScore, filters.interviewsScore)
  ))
}

function filterAdminReviewItems(items, filters) {
  return items.filter((item) => {
    const type = normalizeAdminText(item.type)

    if (!matchesAdminSearch(filters.reviewSearch, [
      item.type,
      item.userName,
      item.userId,
      item.title,
      item.id,
      item.status,
      Array.isArray(item.reasons) ? item.reasons.join(' ') : '',
    ])) {
      return false
    }

    if (filters.reviewType !== 'all' && type !== filters.reviewType) {
      return false
    }

    return matchesAdminStatus(item.status || 'UNKNOWN', filters.reviewStatus, ['completed', 'in_progress'])
  })
}

function filterAdminAuditLogs(logs, filters) {
  return logs.filter((item) => {
    const action = normalizeAdminText(item.action)
    const resource = normalizeAdminText(item.resourceType)

    if (!matchesAdminSearch(filters.auditSearch, [
      item.createdAt,
      item.adminEmail,
      item.adminUserId,
      item.action,
      item.resourceType,
      item.resourceId,
      JSON.stringify(item.details || {}),
    ])) {
      return false
    }

    if (filters.auditAction === 'all') {
      return true
    }

    return action.includes(filters.auditAction) || resource.includes(filters.auditAction)
  })
}

function matchesAdminSearch(search, values) {
  const needle = normalizeAdminText(search)

  if (!needle) {
    return true
  }

  return values.some((value) => normalizeAdminText(value).includes(needle))
}

function matchesAdminStatus(status, selected, knownStatuses) {
  if (selected === 'all') {
    return true
  }

  const value = normalizeAdminText(status).replace(/\s+/g, '_')

  if (selected === 'other') {
    return !knownStatuses.includes(value)
  }

  return value === selected || value.includes(selected)
}

function matchesScoreFilter(score, selected) {
  const value = Number(score || 0)

  if (selected === 'low') {
    return value > 0 && value < 60
  }

  if (selected === 'passing') {
    return value >= 60
  }

  if (selected === 'no_score') {
    return !value
  }

  return true
}

function normalizeAdminText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getInterviewActionKey(interview) {
  return `${interview.userId || ''}:${interview.interviewId || ''}`
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
    const count = userData.users?.length ?? diagnostics.cognitoLoadedCount ?? 0
    if (diagnostics.groupLookupErrors) {
      return isVi
        ? `Đã đồng bộ tài khoản: ${count}, lỗi kiểm tra nhóm: ${diagnostics.groupLookupErrors}`
        : `Synced user accounts: ${count}, group lookup issues: ${diagnostics.groupLookupErrors}`
    }
    if (tableIssueCount) {
      return isVi
        ? `Đã đồng bộ tài khoản: ${count}, lỗi dữ liệu: ${tableIssueCount}`
        : `Synced user accounts: ${count}, data issues: ${tableIssueCount}`
    }
    return isVi
      ? `Đã đồng bộ tài khoản: ${count}`
      : `Synced user accounts: ${count}`
  }

  if (!diagnostics.cognitoConfigured) {
    return isVi
      ? 'Đã đồng bộ dữ liệu hiện có / cấu hình tài khoản chưa đầy đủ'
      : 'Synced available records / account configuration is incomplete'
  }

  if (diagnostics.cognitoErrorCode) {
    return isVi
      ? `Đã đồng bộ dữ liệu hiện có / lỗi tài khoản: ${diagnostics.cognitoErrorCode}`
      : `Synced available records / account lookup failed: ${diagnostics.cognitoErrorCode}`
  }

  if (diagnostics.groupLookupErrors) {
    return isVi
      ? `Đã đồng bộ dữ liệu hiện có / lỗi kiểm tra nhóm: ${diagnostics.groupLookupErrors}`
      : `Synced available records / group lookup issues: ${diagnostics.groupLookupErrors}`
  }

  return isVi
    ? 'Đã đồng bộ dữ liệu hiện có'
    : 'Synced available records'
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
    lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6zM12 15v3" />,
    unlock: <path d="M7 11V8a5 5 0 0 1 9.5-2.2M6 11h12v10H6zM12 15v3" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
