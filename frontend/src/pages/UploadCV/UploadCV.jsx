import { useRef, useState } from 'react'
import {
  createMockCvAnalysis,
  formatFileSize,
  formatUploadDate,
  saveCvAnalysis,
  validateCvFile,
} from '../../services/cvStorage.js'
import { analyzeCvOnAws, uploadCvToAws } from '../../services/cvApi.js'
import './UploadCV.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
]

const uploadSteps = [
  { label: 'Validate CV', description: 'Check file type and size' },
  { label: 'Upload file', description: 'Send CV to API Gateway, Lambda, and S3' },
  { label: 'Analyze CV', description: 'Read CV text and score it with AWS AI' },
  { label: 'Save result', description: 'Store analysis in localStorage' },
]

const fallbackUser = {
  userId: 'user_demo_001',
  fullName: 'Nguyen Huy Dat',
  initials: 'HD',
  role: 'user',
}

export default function UploadCV({
  cvAnalysis,
  currentUser = fallbackUser,
  onNavigate = () => {},
  onLogout = () => {},
  onUploadComplete = () => {},
}) {
  const inputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('idle')
  const [analysis, setAnalysis] = useState(null)

  const isWorking = status === 'uploading' || status === 'analyzing'
  const latestAnalysis = analysis ?? cvAnalysis

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
      saveCvAnalysis(result)
      setAnalysis(result)
      setProgress(100)
      setStatus('done')
      onUploadComplete(result)
    } catch (uploadError) {
      setError(uploadError.message || 'Upload or analyze CV failed. Please check your API Gateway and Lambda logs.')
      setProgress(0)
      setStatus('ready')
    }
  }

  return (
    <div className="dashboard-page upload-page">
      <div className="dashboard-frame">
        <UploadSidebar currentPage="upload-cv" onNavigate={onNavigate} onLogout={onLogout} />

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
                <p>Upload CV</p>
                <h2>CV Analysis Intake</h2>
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

          <div className="dashboard-content upload-content">
            <section className="upload-hero panel">
              <div>
                <p className="eyebrow">CV Upload</p>
                <h1>Upload your CV for AI skill analysis</h1>
                <p>
                  This screen uploads your CV to the AWS Lambda endpoint, stores the file in
                  S3, and keeps a demo AI analysis result until Bedrock is connected.
                </p>
              </div>
              <button className="primary-action upload-hero-action" type="button" onClick={() => inputRef.current?.click()}>
                <Icon name="upload" />
                Choose CV
              </button>
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

                  <div className="dropzone-icon"><Icon name="upload" /></div>
                  <h3>{selectedFile ? selectedFile.name : 'Drop your CV here'}</h3>
                  <p>
                    {selectedFile
                      ? `${formatFileSize(selectedFile.size)} selected and ready to upload.`
                      : 'Supported formats: PDF, DOC, DOCX. Maximum file size: 10 MB.'}
                  </p>

                  <div className="dropzone-actions">
                    <button className="secondary-upload-action" type="button" onClick={() => inputRef.current?.click()} disabled={isWorking}>
                      Browse File
                    </button>
                    <button className="primary-upload-action" type="button" onClick={handleUpload} disabled={!selectedFile || isWorking}>
                      {isWorking ? 'Processing...' : 'Upload & Analyze'}
                    </button>
                  </div>
                </div>

                {error ? <p className="upload-error">{error}</p> : null}

                <div className="upload-progress" aria-label="Upload progress">
                  <div className="progress-meta">
                    <span>{getStatusLabel(status)}</span>
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
                    <h3>Upload Flow</h3>
                    <p>Matches the planned AWS serverless pipeline.</p>
                  </div>
                </div>

                <div className="upload-step-list">
                  {uploadSteps.map((step, index) => (
                    <div className={`upload-step ${getStepState(status, index)}`} key={step.label}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>

            {latestAnalysis ? (
              <section className="panel analysis-preview">
                <div className="panel-header">
                  <div>
                    <h3>CV Analysis Result</h3>
                    <p>Latest parsed profile from the upload flow.</p>
                  </div>
                  <button className="secondary-upload-action" type="button" onClick={() => onNavigate('dashboard')}>
                    View Dashboard
                  </button>
                </div>

                <div className="analysis-grid">
                  <AnalysisMetric label="CV Score" value={`${latestAnalysis.cvScore}/100`} />
                  <AnalysisMetric label="Suggested Role" value={latestAnalysis.suggestedPosition} />
                  <AnalysisMetric label="Uploaded" value={formatUploadDate(latestAnalysis.uploadedAt)} />
                  <AnalysisMetric label="File Size" value={formatFileSize(latestAnalysis.fileSize)} />
                </div>

                <div className="analysis-sections">
                  <ResultBlock title="Extracted Skills" items={latestAnalysis.skills} />
                  <ResultBlock title="Projects" items={latestAnalysis.projects} />
                  <ResultBlock title="Experience" items={latestAnalysis.experience} />
                  <ResultBlock title="Certificates" items={latestAnalysis.certificates} />
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function UploadSidebar({ currentPage, onNavigate, onLogout }) {
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
        <button
          className={`nav-item ${currentPage === 'profile' ? 'active' : ''}`}
          type="button"
          onClick={() => onNavigate('profile')}
        >
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

function getStatusLabel(status) {
  const labels = {
    idle: 'Waiting for file',
    ready: 'Ready to upload',
    uploading: 'Uploading CV to AWS',
    analyzing: 'Analyzing CV with AWS AI',
    done: 'Analysis complete',
  }

  return labels[status] ?? labels.idle
}

function getStepState(status, index) {
  if (status === 'done') return 'complete'
  if (status === 'analyzing') return index <= 2 ? 'active' : ''
  if (status === 'uploading') return index <= 1 ? 'active' : ''
  if (status === 'ready') return index === 0 ? 'active' : ''
  return ''
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
    upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
    edit: <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 7.5l3 3" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
