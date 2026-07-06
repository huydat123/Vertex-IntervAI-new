import { useEffect, useMemo, useRef, useState } from 'react'
import {
  askMockAi,
  createInitialMessages,
  createInterviewSession,
  createMockTranscript,
  speakText,
  stopSpeaking,
} from '../../services/interviewService.js'
import './Interview.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
]

const awsSteps = [
  { label: 'Amazon Polly', value: 'Question voice' },
  { label: 'Amazon Transcribe', value: 'Speech to text' },
  { label: 'Amazon Bedrock', value: 'AI feedback' },
  { label: 'Amazon S3', value: 'Audio storage' },
]

const fallbackUser = {
  userId: 'user_demo_001',
  fullName: 'Nguyen Huy Dat',
  initials: 'HD',
  role: 'user',
}

export default function Interview({
  cvAnalysis,
  currentUser = fallbackUser,
  onNavigate = () => {},
  onLogout = () => {},
}) {
  const videoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const recorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  const chunksRef = useRef([])

  const session = useMemo(() => createInterviewSession(cvAnalysis), [cvAnalysis])
  const [messages, setMessages] = useState(() => createInitialMessages(session, currentUser))
  const [questionIndex, setQuestionIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [voiceError, setVoiceError] = useState('')

  const currentQuestion = session.questions[questionIndex] ?? session.questions[0]
  const progress = Math.round(((questionIndex + 1) / session.questions.length) * 100)

  useEffect(() => {
    return () => {
      stopCamera()
      stopRecording()
      stopSpeaking()
    }
  }, [])

  async function toggleCamera() {
    if (cameraEnabled) {
      stopCamera()
      setCameraEnabled(false)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      cameraStreamRef.current = stream
      setCameraEnabled(true)
      setCameraError('')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play?.()
      }
    } catch {
      setCameraError('Camera permission was blocked or no camera was found.')
      setCameraEnabled(false)
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      stopRecording()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError('Microphone recording is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const transcript = createMockTranscript(questionIndex)
        setVoiceError('')
        setDraft(transcript)
        stopAudioStream()
      }

      recorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setVoiceError('')
    } catch {
      setVoiceError('Microphone permission was blocked or no microphone was found.')
      setIsRecording(false)
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }

    setIsRecording(false)
    stopAudioStream()
  }

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  function stopAudioStream() {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioStreamRef.current = null
  }

  function handleSpeakQuestion() {
    const didSpeak = speakText(currentQuestion)

    if (!didSpeak) {
      setVoiceError('Text-to-speech is not supported in this browser.')
    }
  }

  async function sendAnswer(answerText = draft) {
    const answer = answerText.trim()

    if (!answer || isAiThinking) {
      return
    }

    const userMessage = {
      id: createId(),
      sender: 'user',
      text: answer,
      createdAt: new Date().toISOString(),
    }

    setMessages((current) => [...current, userMessage])
    setDraft('')
    setIsAiThinking(true)

    const aiResult = await askMockAi({ answer, question: currentQuestion, questionIndex })
    const nextQuestionIndex = Math.min(questionIndex + 1, session.questions.length - 1)
    const nextQuestion = session.questions[nextQuestionIndex] ?? aiResult.nextQuestion
    const aiMessage = {
      id: createId(),
      sender: 'ai',
      text: `${aiResult.feedback} Next question: ${nextQuestion}`,
      score: aiResult.score,
      createdAt: new Date().toISOString(),
    }

    setMessages((current) => [...current, aiMessage])
    setQuestionIndex(nextQuestionIndex)
    setIsAiThinking(false)
  }

  return (
    <div className="dashboard-page interview-page">
      <div className="dashboard-frame">
        <InterviewSidebar currentPage="interview" onNavigate={onNavigate} onLogout={onLogout} />

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
                <p>AI Interview</p>
                <h2>{session.role}</h2>
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

          <div className="dashboard-content interview-content">
            <section className="interview-stage">
              <div className="video-card panel">
                <div className="video-header">
                  <div>
                    <span className="live-dot">Live mock interview</span>
                    <h1>Interview for {session.role}</h1>
                  </div>
                  <div className="question-progress" aria-label="Question progress">
                    <span>{questionIndex + 1}/{session.questions.length}</span>
                    <div className="mini-progress"><i style={{ width: `${progress}%` }} /></div>
                  </div>
                </div>

                <div className={`video-surface ${cameraEnabled ? 'camera-on' : ''}`}>
                  <video ref={videoRef} autoPlay playsInline muted />
                  {!cameraEnabled ? (
                    <div className="camera-placeholder">
                      <Icon name="videoOff" />
                      <strong>Camera is off</strong>
                      <span>Turn it on when you want a realistic interview room.</span>
                    </div>
                  ) : null}
                  <div className="ai-card">
                    <div className="ai-avatar"><Icon name="brain" /></div>
                    <div>
                      <strong>AI Interviewer</strong>
                      <span>{isAiThinking ? 'Reviewing your answer...' : 'Ready for your response'}</span>
                    </div>
                  </div>
                </div>

                <div className="interview-controls" aria-label="Interview controls">
                  <button className={`round-control ${cameraEnabled ? 'active' : ''}`} type="button" onClick={toggleCamera} title="Toggle camera">
                    <Icon name={cameraEnabled ? 'video' : 'videoOff'} />
                  </button>
                  <button className={`round-control ${isRecording ? 'danger active' : ''}`} type="button" onClick={toggleRecording} title="Toggle microphone recording">
                    <Icon name={isRecording ? 'stop' : 'mic'} />
                  </button>
                  <button className="round-control" type="button" onClick={handleSpeakQuestion} title="Read question aloud">
                    <Icon name="volume" />
                  </button>
                  <button className="round-control" type="button" onClick={() => onNavigate('dashboard')} title="Leave interview">
                    <Icon name="logout" />
                  </button>
                </div>

                {cameraError ? <p className="interview-error">{cameraError}</p> : null}
                {voiceError ? <p className="interview-error">{voiceError}</p> : null}
              </div>

              <aside className="panel question-card">
                <div className="panel-header">
                  <div>
                    <h3>Current Question</h3>
                    <p>Use voice recording or chat to answer.</p>
                  </div>
                </div>
                <p className="question-text">{currentQuestion}</p>
                <div className="answer-mode-grid">
                  <ModeCard icon="mic" title="Voice Answer" text="Record now, mock transcript fills the chat box." active={isRecording} />
                  <ModeCard icon="message" title="Chat Answer" text="Type your answer and send it to the AI interviewer." />
                </div>
              </aside>
            </section>

            <section className="interview-lower-grid">
              <div className="panel chat-panel">
                <div className="panel-header">
                  <div>
                    <h3>Conversation</h3>
                    <p>Mock AI feedback now, AWS services later.</p>
                  </div>
                </div>

                <div className="message-list" aria-label="Interview messages">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isAiThinking ? (
                    <div className="message-bubble ai thinking">
                      <span>AI is preparing feedback...</span>
                    </div>
                  ) : null}
                </div>

                <form
                  className="chat-composer"
                  onSubmit={(event) => {
                    event.preventDefault()
                    sendAnswer()
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Type your answer here, or record voice to create a mock transcript..."
                    rows="3"
                  />
                  <button className="send-button" type="submit" disabled={!draft.trim() || isAiThinking}>
                    <Icon name="send" />
                    Send
                  </button>
                </form>
              </div>

              <aside className="panel aws-panel">
                <div className="panel-header">
                  <div>
                    <h3>AWS Integration Later</h3>
                    <p>Prepared service boundaries for the real backend.</p>
                  </div>
                </div>
                <div className="aws-step-list">
                  {awsSteps.map((step) => (
                    <div className="aws-step" key={step.label}>
                      <span><Icon name="check" /></span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

function InterviewSidebar({ currentPage, onNavigate, onLogout }) {
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

function ModeCard({ icon, title, text, active = false }) {
  return (
    <div className={`mode-card ${active ? 'active' : ''}`}>
      <Icon name={icon} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  )
}

function MessageBubble({ message }) {
  return (
    <div className={`message-bubble ${message.sender}`}>
      <div className="message-meta">
        <strong>{message.sender === 'ai' ? 'AI Interviewer' : 'You'}</strong>
        {message.score ? <span>Score {message.score}/100</span> : null}
      </div>
      <p>{message.text}</p>
    </div>
  )
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `message-${Date.now()}-${Math.random().toString(16).slice(2)}`
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
    message: <path d="M4 5h16v11H8l-4 4z" />,
    chart: <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8" />,
    history: <path d="M4 12a8 8 0 1 0 3-6.25M4 5v5h5M12 8v5l3 2" />,
    user: <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />,
    settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />,
    bell: <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0" />,
    brain: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 5 2.2M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-5 2.2M12 5v14M8 10h3M13 10h3M8 15h3M13 15h3" />,
    check: <path d="M20 6 9 17l-5-5" />,
    video: <path d="M4 7h11v10H4zM15 11l5-3v8l-5-3" />,
    videoOff: <path d="M4 7h9v8M15 11l5-3v8l-3-1.8M3 3l18 18M4 17h11v-2" />,
    volume: <path d="M4 10v4h4l5 4V6l-5 4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />,
    stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
    send: <path d="M4 12 20 4l-5 16-3-7zM20 4l-8 9" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
