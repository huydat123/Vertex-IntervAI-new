import { useRef, useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import {
  createMockCvAnalysis,
  formatFileSize,
  formatUploadDate,
  saveCvAnalysis,
  validateCvFile,
} from '../../services/cvStorage.js'
import { analyzeCvOnAws, uploadCvToAws } from '../../services/cvApi.js'
import { getAppCopy } from '../../services/i18n.js'
import heroArtwork from '../../assets/image_processing20250318-3918123-1ew3drz.gif'
import './UploadCV.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
]

const uploadSteps = [
  { label: 'Validate document', description: 'Check file type and size' },
  { label: 'Upload securely', description: 'Send CV to your private workspace' },
  { label: 'Analyze CV', description: 'Extract skills, role fit, and score with AI' },
  { label: 'Save result', description: 'Keep the analysis for Dashboard and History' },
]

const uploadBenefits = [
  { label: 'Secure Upload', value: 'Private CV intake', icon: 'cloud' },
  { label: 'AI Profile', value: 'Skills & projects', icon: 'brain' },
  { label: 'Saved Progress', value: 'History & context', icon: 'database' },
]

const fallbackUser = {
  userId: 'user_demo_001',
  fullName: 'Nguyen Huy Dat',
  initials: 'HD',
  role: 'user',
}

export default function UploadCV({
  cvAnalysis,
  cvHistory = [],
  currentUser = fallbackUser,
  language = 'en',
  colorTheme = 'black',
  onLanguageChange = () => {},
  onThemeChange = () => {},
  onNavigate = () => {},
  onLogout = () => {},
  onUploadComplete = () => {},
  onDeleteCv = () => {},
}) {
  const appCopy = getAppCopy(language)
  const copy = appCopy.upload
  const inputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('idle')
  const [analysis, setAnalysis] = useState(null)

  const isWorking = status === 'uploading' || status === 'analyzing'
  const latestAnalysis = analysis ?? cvAnalysis
  const savedCvRows = mergeLatestCv(cvHistory, latestAnalysis)

  function handleFile(file) {
    const issue = validateCvFile(file)

    if (issue) {
      setSelectedFile(null)
      setAnalysis(null)
      setProgress(0)
      setStatus('idle')
      setError(issue)
      return
    }

    setSelectedFile(file)
    setAnalysis(null)
    setError('')
    setProgress(0)
    setStatus('ready')
  }

  async function handleUpload() {
    const issue = validateCvFile(selectedFile)

    if (issue) {
      setError(issue)
      return
    }

    setError('')
    setStatus('uploading')
    setProgress(15)

    try {
      await wait(150)
      setProgress(35)

      const uploadedCv = await uploadCvToAws(selectedFile, currentUser.userId)
      setProgress(72)
      setStatus('analyzing')

      const analyzedCv = await analyzeCvOnAws(uploadedCv)
      const result = createDashboardAnalysis(selectedFile, analyzedCv, currentUser.userId)
      saveCvAnalysis(result, currentUser.userId)
      setAnalysis(result)
      setProgress(100)
      setStatus('done')
      onUploadComplete(result)
    } catch (uploadError) {
      setError(uploadError.message || copy.uploadError)
      setProgress(0)
      setStatus('ready')
    }
  }

  return (
    <div className="dashboard-page upload-page">
      <div className="dashboard-frame">
        <UploadSidebar appCopy={appCopy} currentPage="upload-cv" onNavigate={onNavigate} onLogout={onLogout} />

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

          <div className="dashboard-content upload-content">
            <section className="upload-hero panel">
              <div className="upload-hero-copy">
                <p className="eyebrow">{copy.heroEyebrow}</p>
                <h1>{copy.heroTitle}</h1>
                <p>{copy.heroText}</p>
                <div className="upload-hero-actions">
                  <button className="primary-action upload-hero-action" type="button" onClick={() => inputRef.current?.click()}>
                    <Icon name="upload" />
                    {copy.chooseCv}
                  </button>
                  <button className="secondary-action upload-hero-secondary" type="button" onClick={() => onNavigate('history')}>
                    <Icon name="history" />
                    {appCopy.common.viewHistory}
                  </button>
                </div>
              </div>

              <div className="upload-hero-visual" aria-label="Upload pipeline preview">
                <img src={heroArtwork} alt="" />
                <div className="upload-preview-card">
                  <span>{copy.currentFile}</span>
                  <strong>{selectedFile?.name || latestAnalysis?.fileName || copy.noCvSelected}</strong>
                  <small>{selectedFile ? formatFileSize(selectedFile.size) : getStatusLabel(status, copy)}</small>
                </div>
                <div className="upload-score-card">
                  <span>{copy.latestScore}</span>
                  <strong>{latestAnalysis?.cvScore ?? '--'}<small>/100</small></strong>
                </div>
              </div>

              <div className="upload-benefit-strip" aria-label="CV upload pipeline">
                {uploadBenefits.map((item, index) => (
                  <div className="upload-benefit" key={item.label}>
                    <span><Icon name={item.icon} /></span>
                    <div>
                      <strong>{copy.benefits[index]?.[0] || item.label}</strong>
                      <small>{copy.benefits[index]?.[1] || item.value}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="upload-grid">
              <section className="panel upload-card">
                <div
                  className={`dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    setIsDragging(false)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    setIsDragging(false)
                    handleFile(event.dataTransfer.files[0])
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => handleFile(event.target.files[0])}
                    hidden
                  />

                  <div className="dropzone-content">
                    <div className="dropzone-icon"><Icon name={selectedFile ? 'file' : 'upload'} /></div>
                    <h3>{selectedFile ? selectedFile.name : copy.dropTitle}</h3>
                    <p>
                      {selectedFile
                        ? copy.selectedReady(formatFileSize(selectedFile.size))
                        : copy.supported}
                    </p>
                    <div className="file-format-list" aria-label="Supported file formats">
                      <span>PDF</span>
                      <span>DOCX</span>
                      <span>DOC</span>
                    </div>
                  </div>

                  <div className="dropzone-actions">
                    <button className="secondary-upload-action" type="button" onClick={() => inputRef.current?.click()} disabled={isWorking}>
                      {copy.browse}
                    </button>
                    <button className="primary-upload-action" type="button" onClick={handleUpload} disabled={!selectedFile || isWorking}>
                      {isWorking ? copy.processing : copy.uploadAnalyze}
                    </button>
                  </div>
                </div>

                {error ? <p className="upload-error">{error}</p> : null}

                <div className={`upload-progress ${status}`} aria-label="Upload progress">
                  <div className="progress-meta">
                    <span>{getStatusLabel(status, copy)}</span>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </section>

              <aside className="panel upload-steps-card">
                <div className="panel-header">
                  <div>
                    <h3>{copy.flowTitle}</h3>
                    <p>{copy.flowText}</p>
                  </div>
                </div>

                <div className="upload-step-list">
                  {uploadSteps.map((step, index) => (
                    <div className={`upload-step ${getStepState(status, index)}`} key={step.label}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{copy.steps[index]?.[0] || step.label}</strong>
                        <p>{copy.steps[index]?.[1] || step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="upload-security-note">
                  <Icon name="shield" />
                  <div>
                    <strong>{copy.securityTitle}</strong>
                    <p>{copy.securityText}</p>
                  </div>
                </div>
              </aside>
            </div>

            <section className="panel saved-cvs-card">
              <div className="panel-header">
                <div>
                  <h3>{copy.savedTitle}</h3>
                  <p>{copy.savedText}</p>
                </div>
                <button className="secondary-upload-action" type="button" onClick={() => onNavigate('dashboard')}>
                  {appCopy.common.viewDashboard}
                </button>
              </div>

              {savedCvRows.length ? (
                <div className="upload-cv-list">
                  {savedCvRows.map((item) => (
                    <article
                      className={`upload-cv-row ${getCvKey(item) === getCvKey(latestAnalysis) ? 'active' : ''}`}
                      key={getCvKey(item)}
                    >
                      <button
                        className="upload-cv-select-button"
                        type="button"
                        onClick={() => handleSelectSavedCv(item, setSelectedFile, setAnalysis, setStatus, setProgress, setError)}
                        aria-pressed={getCvKey(item) === getCvKey(latestAnalysis)}
                      >
                        <span className="upload-cv-icon"><Icon name="file" /></span>
                        <div>
                          <strong>{item.fileName || copy.uploadedCv}</strong>
                          <span>
                            {formatUploadDate(getCvDate(item))} / {formatFileSize(item.fileSize)} / {Number(item.cvScore || 0)}/100
                          </span>
                        </div>
                        <em>{copy.viewDetails}</em>
                      </button>
                      <button
                        className="delete-upload-cv-button"
                        type="button"
                        aria-label={`${appCopy.common.delete} ${item.fileName || copy.uploadedCv}`}
                        onClick={() => handleDeleteSavedCv(item, onDeleteCv, analysis, setAnalysis, copy)}
                      >
                        <Icon name="trash" />
                        {appCopy.common.delete}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="upload-empty-cvs">
                  <span><Icon name="file" /></span>
                  <strong>{copy.emptyTitle}</strong>
                  <p>{copy.emptyText}</p>
                </div>
              )}
            </section>

            {latestAnalysis ? (
              <section className="panel analysis-preview">
                <div className="panel-header">
                  <div>
                    <h3>{copy.resultTitle}</h3>
                    <p>{copy.resultText}</p>
                  </div>
                  <div className="analysis-actions">
                    <button className="secondary-upload-action" type="button" onClick={() => onNavigate('dashboard')}>
                      {appCopy.common.viewDashboard}
                    </button>
                    <button className="primary-upload-action" type="button" onClick={() => onNavigate('interview')}>
                      <Icon name="mic" />
                      {copy.startInterview}
                    </button>
                  </div>
                </div>

                <div className="analysis-grid">
                  <AnalysisMetric label={copy.metrics[0]} value={`${latestAnalysis.cvScore}/100`} />
                  <AnalysisMetric label={copy.metrics[1]} value={latestAnalysis.suggestedPosition} />
                  <AnalysisMetric label={copy.metrics[2]} value={formatUploadDate(latestAnalysis.uploadedAt)} />
                  <AnalysisMetric label={copy.metrics[3]} value={formatFileSize(latestAnalysis.fileSize)} />
                </div>

                <div className="analysis-sections">
                  <ResultBlock title={copy.blocks[0]} items={latestAnalysis.skills} />
                  <ResultBlock title={copy.blocks[1]} items={latestAnalysis.projects} />
                  <ResultBlock title={copy.blocks[2]} items={latestAnalysis.experience} />
                  <ResultBlock title={copy.blocks[3]} items={latestAnalysis.certificates} />
                </div>

                <InterviewPreparation analysis={latestAnalysis} copy={copy} />
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function UploadSidebar({ appCopy, currentPage, onNavigate, onLogout }) {
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
        <button
          className={`nav-item ${currentPage === 'profile' ? 'active' : ''}`}
          type="button"
          onClick={() => onNavigate('profile')}
        >
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

function AnalysisMetric({ label, value }) {
  return (
    <div className="analysis-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ResultBlock({ title, items }) {
  return (
    <div className="result-block">
      <h4>{title}</h4>
      <div className="tag-list">
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  )
}

function InterviewPreparation({ analysis, copy }) {
  const skills = analysis.skills?.slice(0, 5) ?? []

  return (
    <section className="interview-prep" aria-label="Interview preparation">
      <div className="prep-copy">
        <span className="prep-icon"><Icon name="brain" /></span>
        <div>
          <h4>{copy.prepTitle}</h4>
          <p>{copy.prepText}</p>
        </div>
      </div>

      <div className="prep-grid">
        <PrepItem label={copy.prepItems[0]} value={analysis.suggestedPosition} />
        <PrepItem label={copy.prepItems[1]} value={getInterviewLevel(analysis.cvScore, copy)} />
        <PrepItem label={copy.prepItems[2]} value={copy.estimatedQuestions} />
        <PrepItem label={copy.prepItems[3]} value={skills.join(', ') || 'React, Python, Databases'} />
      </div>
    </section>
  )
}

function PrepItem({ label, value }) {
  return (
    <div className="prep-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function getStatusLabel(status, copy) {
  return copy.statuses[status] ?? copy.statuses.idle
}

function getStepState(status, index) {
  if (status === 'done') return 'complete'
  if (status === 'analyzing') return index <= 2 ? 'active' : ''
  if (status === 'uploading') return index <= 1 ? 'active' : ''
  if (status === 'ready') return index === 0 ? 'active' : ''
  return ''
}

function getInterviewLevel(score, copy) {
  if (score >= 85) return copy.levels.strong
  if (score >= 70) return copy.levels.ready
  return copy.levels.foundation
}

function createDashboardAnalysis(file, uploadedCv, userId) {
  const mockAnalysis = createMockCvAnalysis(file)

  return {
    ...mockAnalysis,
    ...uploadedCv,
    cvId: uploadedCv.cvId || mockAnalysis.cvId,
    userId: uploadedCv.userId || userId,
    fileName: uploadedCv.fileName || mockAnalysis.fileName,
    fileSize: Number(uploadedCv.fileSize || mockAnalysis.fileSize),
    uploadedAt: uploadedCv.createdAt || uploadedCv.uploadedAt || mockAnalysis.uploadedAt,
    status: uploadedCv.status || 'UPLOADED',
    s3Bucket: uploadedCv.s3Bucket,
    s3Key: uploadedCv.s3Key,
  }
}

function mergeLatestCv(items, latest) {
  const source = Array.isArray(items) ? items : []

  if (!latest) {
    return source
  }

  const key = getCvKey(latest)
  return [latest, ...source.filter((item) => getCvKey(item) !== key)]
}

function handleDeleteSavedCv(item, onDeleteCv, localAnalysis, setAnalysis, copy) {
  const fileName = item?.fileName || 'this CV'

  if (!window.confirm(copy.deleteConfirm(fileName))) {
    return
  }

  onDeleteCv(item)

  if (getCvKey(localAnalysis) === getCvKey(item)) {
    setAnalysis(null)
  }
}

function handleSelectSavedCv(item, setSelectedFile, setAnalysis, setStatus, setProgress, setError) {
  setSelectedFile(null)
  setAnalysis(item)
  setStatus('done')
  setProgress(100)
  setError('')
}

function getCvKey(item) {
  if (!item) {
    return ''
  }

  return item.cvId || `${item.fileName || 'cv'}-${getCvDate(item)}`
}

function getCvDate(item) {
  return item?.uploadedAt || item?.analyzedAt || item?.updatedAt || item?.createdAt || ''
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
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
    cloud: <path d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.3 8.8 4.6 4.6 0 0 0 7 18z" />,
    database: <path d="M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />,
    shield: <path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6zM9 12l2 2 4-4" />,
    upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
    edit: <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 7.5l3 3" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
