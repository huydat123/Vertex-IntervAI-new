import { useEffect, useRef, useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import {
  askMockAi,
  createInterviewSession,
  enhanceInterviewFeedback,
  getBrowserSpeechVoices,
  playOnlineVietnameseSpeech,
  speakText,
  stopSpeaking,
} from '../../services/interviewService.js'
import { createInterviewOnAws, submitAnswerToAws } from '../../services/interviewApi.js'
import { createInterviewResult, saveInterviewResult } from '../../services/interviewStorage.js'
import { getAppCopy } from '../../services/i18n.js'
import { getLanguageConfig, normalizeLanguage } from '../../services/language.js'
import { loadSettings, saveSettings } from '../../services/settingsStorage.js'
import {
  getPreferredRecordingMimeType,
  synthesizeQuestionAudio,
  transcribeAnswerAudio,
} from '../../services/voiceApi.js'
import './Interview.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
]

const interviewCopy = {
  en: {
    noCvEyebrow: 'No CV for this account',
    noCvTitle: 'Upload a CV before starting AI Interview',
    noCvText: 'This account does not have a saved CV analysis yet. Upload and analyze a CV first so the interview questions, score, and feedback belong to this user.',
    uploadCv: 'Upload CV',
    backDashboard: 'Back to Dashboard',
    pageTitle: 'AI Interview',
    setupRequired: 'Interview setup required',
    interviewRole: 'Interview Role',
    roleTitle: 'Choose the role focus for this AI interview',
    roleText: 'Pick an AI, data, cloud, frontend, or backend role. The question set will reset and follow the selected role while still using skills from your uploaded CV. Choose at least two questions for each interview round.',
    selectedRole: 'Selected role',
    searchRole: 'Search role...',
    questions: 'Questions',
    backToCvRole: 'Back to CV Role',
    noRole: 'No role matched your search.',
    cameraOnline: 'Camera online',
    cameraStandby: 'Camera standby',
    interviewRoom: 'Interview Room',
    cameraOff: 'Camera is off',
    cameraHidden: 'Camera preview is hidden for this session.',
    aiInterviewer: 'AI Interviewer',
    userLabel: 'You',
    conversation: 'Conversation',
    transcribeProcessing: ' - Turning audio into text',
    answered: 'answered',
    compact: 'Compact',
    expand: 'Expand',
    aiPreparing: 'AI is preparing feedback...',
    completedPlaceholder: 'Interview completed.',
    answerPlaceholder: 'Type your answer here...',
    send: 'Send',
    currentQuestion: 'Current Question',
    question: 'Question',
    newInterview: 'New Interview',
    newSet: 'New Set',
    voiceAnswer: 'Voice Answer',
    voiceAnswerText: 'Microphone capture with transcript review.',
    chatAnswer: 'Chat Answer',
    chatAnswerText: 'Written response with AI review.',
    awsVoice: 'Voice and Feedback Tools',
    awsVoiceText: 'Question voice, speech transcript, and AI feedback for this interview session.',
    browserVoiceLabel: 'Question voice',
    autoVoice: 'Auto voice',
    onlineVietnameseVoice: 'Online Vietnamese voice',
    noVoiceAvailable: 'No browser voices available',
    missingVietnameseVoice: 'No Vietnamese browser voice was found. Choose another voice manually or install a Vietnamese speech voice in Windows/Chrome.',
    finalScore: 'Final interview score',
    score: 'Score',
    strengths: 'Strengths',
    improvements: 'Needs Improvement',
    recommendation: 'AI Recommendation',
    fullResult: 'View Full Result',
    recording: 'Recording',
    statusReviewing: 'Reviewing your answer...',
    statusListening: 'Listening to your voice answer...',
    statusTranscribing: 'Transcribing your answer...',
    statusSpeaking: 'Preparing question voice...',
    statusReady: 'Ready for your response',
    stateCompleted: 'Completed',
    stateAiReviewing: 'AI reviewing',
    stateRecording: 'Recording',
    stateTranscribing: 'Transcribing',
    stateSpeaking: 'Speaking',
    stateProgress: 'In progress',
    pollyCreating: 'Preparing question audio...',
    pollyPlaying: 'Playing question audio',
    browserVoice: 'Using browser voice',
    transcribeSending: 'Processing your voice answer...',
    transcribeDone: 'Transcript ready. Review the text, then press Send.',
    recordingVoice: 'Recording your voice answer...',
    micUnsupported: 'Microphone recording is not supported in this browser.',
    micBlocked: 'Microphone permission was blocked or no microphone was found.',
    noAudio: 'No audio was recorded. Please try again.',
    cameraUnsupported: 'Camera access is not supported in this browser.',
    cameraBlocked: 'Camera permission was blocked or no camera was found.',
  },
  vi: {
    noCvEyebrow: 'Chưa có CV cho tài khoản này',
    noCvTitle: 'Hãy upload CV trước khi bắt đầu AI Interview',
    noCvText: 'Tài khoản này chưa có bản phân tích CV đã lưu. Hãy upload và phân tích CV trước để câu hỏi, điểm và feedback thuộc đúng người dùng.',
    uploadCv: 'Upload CV',
    backDashboard: 'Về Dashboard',
    pageTitle: 'Phỏng vấn AI',
    setupRequired: 'Cần chuẩn bị phỏng vấn',
    interviewRole: 'Vai trò phỏng vấn',
    roleTitle: 'Chọn trọng tâm role cho buổi phỏng vấn AI',
    roleText: 'Chọn role AI, data, cloud, frontend hoặc backend. Bộ câu hỏi sẽ reset theo role đã chọn nhưng vẫn dùng kỹ năng từ CV của bạn. Mỗi vòng cần ít nhất hai câu hỏi.',
    selectedRole: 'Role đã chọn',
    searchRole: 'Tìm role...',
    questions: 'Câu hỏi',
    backToCvRole: 'Về role từ CV',
    noRole: 'Không có role phù hợp.',
    cameraOnline: 'Camera đang bật',
    cameraStandby: 'Camera chờ',
    interviewRoom: 'Phòng phỏng vấn',
    cameraOff: 'Camera đang tắt',
    cameraHidden: 'Phần xem trước camera đang ẩn trong phiên này.',
    aiInterviewer: 'AI Interviewer',
    userLabel: 'Bạn',
    conversation: 'Hội thoại',
    transcribeProcessing: ' - Đang chuyển audio thành văn bản',
    answered: 'đã trả lời',
    compact: 'Thu gọn',
    expand: 'Phóng to',
    aiPreparing: 'AI đang chuẩn bị feedback...',
    completedPlaceholder: 'Phỏng vấn đã hoàn tất.',
    answerPlaceholder: 'Nhập câu trả lời tại đây...',
    send: 'Gửi',
    currentQuestion: 'Câu hỏi hiện tại',
    question: 'Câu hỏi',
    newInterview: 'Phỏng vấn mới',
    newSet: 'Bộ câu hỏi mới',
    voiceAnswer: 'Trả lời bằng giọng nói',
    voiceAnswerText: 'Ghi âm mic và xem lại transcript.',
    chatAnswer: 'Trả lời bằng chat',
    chatAnswerText: 'Nhập câu trả lời và nhận AI review.',
    awsVoice: 'Tích hợp voice',
    awsVoiceText: 'Dịch vụ voice, transcript và đánh giá cho phiên phỏng vấn.',
    browserVoiceLabel: 'Giọng đọc câu hỏi',
    autoVoice: 'Tự động chọn giọng',
    onlineVietnameseVoice: 'Giọng tiếng Việt online',
    noVoiceAvailable: 'Không có voice trong trình duyệt',
    missingVietnameseVoice: 'Không tìm thấy giọng tiếng Việt trong trình duyệt. Hãy chọn voice khác thủ công hoặc cài giọng tiếng Việt trong Windows/Chrome.',
    finalScore: 'Điểm phỏng vấn cuối',
    score: 'Điểm',
    strengths: 'Điểm mạnh',
    improvements: 'Cần cải thiện',
    recommendation: 'Gợi ý của AI',
    fullResult: 'Xem kết quả đầy đủ',
    recording: 'Đang ghi âm',
    statusReviewing: 'Đang chấm câu trả lời...',
    statusListening: 'Đang nghe câu trả lời bằng giọng nói...',
    statusTranscribing: 'Đang chuyển giọng nói thành văn bản...',
    statusSpeaking: 'Đang chuẩn bị giọng đọc câu hỏi...',
    statusReady: 'Sẵn sàng nhận câu trả lời',
    stateCompleted: 'Hoàn tất',
    stateAiReviewing: 'AI đang chấm',
    stateRecording: 'Đang ghi âm',
    stateTranscribing: 'Đang chuyển giọng',
    stateSpeaking: 'Đang đọc',
    stateProgress: 'Đang phỏng vấn',
    pollyCreating: 'Đang tạo audio câu hỏi...',
    pollyPlaying: 'Đang đọc câu hỏi',
    browserVoice: 'Đang đọc bằng giọng trình duyệt',
    transcribeSending: 'Đang xử lý câu trả lời bằng giọng nói...',
    transcribeDone: 'Transcript đã sẵn sàng. Hãy kiểm tra văn bản rồi bấm Gửi.',
    recordingVoice: 'Đang ghi âm câu trả lời...',
    micUnsupported: 'Trình duyệt này không hỗ trợ ghi âm microphone.',
    micBlocked: 'Bạn chưa cấp quyền microphone hoặc không tìm thấy microphone.',
    noAudio: 'Không ghi được audio. Hãy thử lại.',
    cameraUnsupported: 'Trình duyệt này không hỗ trợ camera.',
    cameraBlocked: 'Bạn chưa cấp quyền camera hoặc không tìm thấy camera.',
  },
}

const voiceWorkflowSteps = [
  { label: 'Question Voice', value: 'Read interview questions aloud' },
  { label: 'Speech Transcript', value: 'Turn voice answers into editable text' },
  { label: 'AI Feedback', value: 'Score answers and suggest improvements' },
  { label: 'Saved Session', value: 'Keep answers, notes, and progress history' },
]

const ONLINE_VIETNAMESE_VOICE_URI = 'online-vietnamese-voice'

const defaultInterviewQuestionCount = 5
const interviewQuestionOptions = [2, 3, 4, 5, 6, 7, 8]

function getStoredInterviewQuestionCount() {
  const savedCount = Number(loadSettings().questionCount)

  return interviewQuestionOptions.includes(savedCount)
    ? savedCount
    : defaultInterviewQuestionCount
}

const roleCategories = [
  { id: 'all', label: 'All' },
  { id: 'ai', label: 'AI & ML' },
  { id: 'data', label: 'Data' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
]

const interviewRoles = [
  {
    id: 'ai-engineer',
    label: 'AI Engineer',
    category: 'ai',
    mark: 'AI',
    count: 82,
    focus: 'Python, LLMs, RAG',
    skills: ['Python', 'Machine Learning', 'LLM', 'RAG', 'Model Integration', 'Vector Database'],
    description: 'Build AI features, integrate models, and evaluate production behavior.',
    questionGroups: [
      [
        'For an AI Engineer role, how would you design an AI feature from problem definition to production release?',
        'Describe an AI system you would build for this product and explain the model, API, and data flow.',
      ],
      [
        'How would you evaluate an LLM or ML feature before allowing real users to depend on it?',
        'If an AI answer is inconsistent, how would you debug prompts, data, model settings, and logs?',
      ],
      [
        'Explain how you would build a RAG workflow with embeddings, retrieval, generation, and answer evaluation.',
        'How would you monitor quality, latency, and cost for an AI feature in production?',
      ],
    ],
  },
  {
    id: 'genai-engineer',
    label: 'Generative AI Engineer',
    category: 'ai',
    mark: 'GA',
    count: 74,
    focus: 'Prompting, RAG, evaluation',
    skills: ['Prompt Engineering', 'RAG', 'Model Integration', 'Vector Search', 'Guardrails', 'Evaluation'],
    description: 'Create LLM workflows with prompts, retrieval, safety, and evaluation.',
    questionGroups: [
      [
        'How would you design a prompt and retrieval flow for a CV-based interview assistant?',
        'What would you include in a prompt template to make an AI interviewer consistent and safe?',
      ],
      [
        'How would you evaluate hallucination risk and answer quality in a generative AI feature?',
        'How would you compare two prompt versions before releasing one to users?',
      ],
      [
        'Design a scalable GenAI workflow with an API layer, processing functions, model integration, and persistent storage.',
        'How would you add guardrails, logging, and fallback behavior to a GenAI application?',
      ],
    ],
  },
  {
    id: 'ml-engineer',
    label: 'Machine Learning Engineer',
    category: 'ai',
    mark: 'ML',
    count: 69,
    focus: 'Training, deployment, monitoring',
    skills: ['Python', 'Model Training', 'Feature Engineering', 'Model Serving', 'MLOps', 'Monitoring'],
    description: 'Train, deploy, and monitor models for reliable product use.',
    questionGroups: [
      [
        'How would you turn raw data into features for a machine learning model?',
        'Explain your approach to training, validating, and testing an ML model.',
      ],
      [
        'How would you deploy a model behind an API and keep latency acceptable?',
        'If a model performs well offline but poorly in production, what would you investigate?',
      ],
      [
        'How would you monitor model drift, data quality, and prediction confidence over time?',
        'What metrics would you use to decide whether an ML model is ready for release?',
      ],
    ],
  },
  {
    id: 'data-scientist',
    label: 'Data Scientist',
    category: 'data',
    mark: 'DS',
    count: 66,
    focus: 'Statistics, SQL, insights',
    skills: ['Python', 'SQL', 'Statistics', 'EDA', 'Experimentation', 'Visualization'],
    description: 'Analyze data, explain patterns, and turn experiments into decisions.',
    questionGroups: [
      [
        'How would you explore a new dataset before building a model or dashboard?',
        'Describe how you would turn messy interview history data into useful product insights.',
      ],
      [
        'How would you explain precision, recall, and false positives to a non-technical stakeholder?',
        'What statistical checks would you use before trusting a trend in user performance data?',
      ],
      [
        'How would you design an A/B test for improving the AI interview flow?',
        'What dashboard would you build to help candidates understand their learning progress?',
      ],
    ],
  },
  {
    id: 'mlops-engineer',
    label: 'MLOps Engineer',
    category: 'cloud',
    mark: 'MO',
    count: 58,
    focus: 'CI/CD, model ops, observability',
    skills: ['Docker', 'CI/CD', 'Model Registry', 'Monitoring', 'Service Runtime', 'Observability'],
    description: 'Automate model delivery, monitoring, rollback, and operational controls.',
    questionGroups: [
      [
        'How would you design a CI/CD pipeline for an ML or AI service?',
        'What checks should happen before promoting a model or prompt change to production?',
      ],
      [
        'How would you monitor model latency, failures, cost, and quality from logs and dashboards?',
        'If a deployed AI service starts failing, what rollback and debugging steps would you take?',
      ],
      [
        'How would you manage environment variables, permissions, and secrets for an AI backend?',
        'How would you version prompts, model artifacts, and evaluation reports?',
      ],
    ],
  },
  {
    id: 'data-engineer',
    label: 'Data Engineer',
    category: 'data',
    mark: 'DE',
    count: 61,
    focus: 'Pipelines, storage, quality',
    skills: ['Python', 'SQL', 'ETL', 'NoSQL', 'File Storage', 'Data Quality'],
    description: 'Build reliable pipelines and storage models for AI-ready data.',
    questionGroups: [
      [
        'How would you design a data pipeline that stores CV, transcript, and interview results reliably?',
        'What data quality checks would you add before AI evaluation uses candidate data?',
      ],
      [
        'How would you model interview history for fast reads across users and devices?',
        'How would you choose between NoSQL, file storage, and relational storage for interview data?',
      ],
      [
        'If a data pipeline creates duplicate or missing records, how would you debug it?',
        'How would you make a data pipeline observable and easy to replay after failure?',
      ],
    ],
  },
  {
    id: 'computer-vision-engineer',
    label: 'Computer Vision Engineer',
    category: 'ai',
    mark: 'CV',
    count: 44,
    focus: 'Images, models, evaluation',
    skills: ['Python', 'Computer Vision', 'CNN', 'Image Processing', 'Model Evaluation', 'Deployment'],
    description: 'Process visual data, train vision models, and evaluate accuracy.',
    questionGroups: [
      [
        'How would you prepare and augment image data before training a computer vision model?',
        'What would you check if a vision model works on test images but fails on real camera input?',
      ],
      [
        'How would you evaluate a classification or detection model beyond simple accuracy?',
        'Explain a computer vision pipeline from image capture to model prediction and API response.',
      ],
      [
        'How would you handle lighting, camera quality, and privacy issues in a vision feature?',
        'How would you deploy a lightweight vision model for a user-facing app?',
      ],
    ],
  },
  {
    id: 'nlp-engineer',
    label: 'NLP Engineer',
    category: 'ai',
    mark: 'NLP',
    count: 52,
    focus: 'Text, embeddings, transformers',
    skills: ['NLP', 'Transformers', 'Embeddings', 'Text Classification', 'RAG', 'Evaluation'],
    description: 'Build text understanding, retrieval, and language workflows.',
    questionGroups: [
      [
        'How would you process CV text before using it for question generation or scoring?',
        'How would you design an NLP pipeline for extracting skills, projects, and experience from a CV?',
      ],
      [
        'How would you evaluate text classification or semantic search quality?',
        'What are embeddings, and how would you use them in a candidate interview platform?',
      ],
      [
        'How would you handle noisy transcripts before sending them to an AI evaluator?',
        'How would you reduce bias and unclear feedback in an NLP-based scoring system?',
      ],
    ],
  },
  {
    id: 'frontend-ai-engineer',
    label: 'Frontend AI Engineer',
    category: 'frontend',
    mark: 'FE',
    count: 49,
    focus: 'React, AI UX, streaming',
    skills: ['React', 'TypeScript', 'AI UX', 'Streaming UI', 'Accessibility', 'API Integration'],
    description: 'Build polished AI product interfaces with reliable API states.',
    questionGroups: [
      [
        'How would you design a React interface for an AI interview chat with loading, retry, and error states?',
        'How would you make an AI feature feel trustworthy and easy to understand in the UI?',
      ],
      [
        'How would you handle streaming AI responses, partial results, and cancellation in React?',
        'How would you test a frontend that depends on slow or unreliable AI APIs?',
      ],
      [
        'How would you design accessible camera, voice, and chat controls for an interview page?',
        'What state management approach would you use for an AI interview session and why?',
      ],
    ],
  },
  {
    id: 'backend-ai-engineer',
    label: 'Backend AI Engineer',
    category: 'backend',
    mark: 'BE',
    count: 57,
    focus: 'APIs, queues, AI services',
    skills: ['Python', 'REST APIs', 'Serverless Functions', 'NoSQL Database', 'AI Integration', 'Error Handling'],
    description: 'Build APIs that connect AI services, storage, and secure workflows.',
    questionGroups: [
      [
        'How would you design a backend API that creates AI interview questions from a CV?',
        'How would you structure backend functions for upload, analysis, interview, scoring, and history?',
      ],
      [
        'How would you handle retries, timeouts, and fallback behavior when an AI provider fails?',
        'How would you design access permissions for a backend service that reads CV data and writes interview results?',
      ],
      [
        'How would you store answers, attempts, scores, and audit logs in a database?',
        'How would you debug an API route that returns Internal Server Error during an AI call?',
      ],
    ],
  },
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
  language,
  colorTheme = 'black',
  onLanguageChange = () => {},
  onThemeChange = () => {},
  onNavigate = () => {},
  onLogout = () => {},
  onInterviewComplete = () => {},
}) {
  const videoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const recorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  const questionAudioRef = useRef(null)
  const browserSpeechRecognitionRef = useRef(null)
  const browserTranscriptRef = useRef('')
  const shouldProcessRecordingRef = useRef(false)
  const chunksRef = useRef([])
  const cvIdRef = useRef(cvAnalysis?.cvId)
  const sessionLanguageRef = useRef(normalizeLanguage(language || loadSettings().language))
  const activeLanguageRef = useRef(sessionLanguageRef.current)
  const currentUserRef = useRef(currentUser)
  const initialQuestionCountRef = useRef(getStoredInterviewQuestionCount())
  const activeLanguage = normalizeLanguage(language || loadSettings().language)
  const appCopy = getAppCopy(activeLanguage)
  const languageConfig = getLanguageConfig(activeLanguage)
  const copy = interviewCopy[activeLanguage]
  const noCvTitleRef = useRef(copy.noCvTitle)
  const voiceSteps = activeLanguage === 'vi'
    ? [
      { label: 'Giọng đọc câu hỏi', value: 'Đọc câu hỏi phỏng vấn thành tiếng' },
      { label: 'Transcript giọng nói', value: 'Chuyển câu trả lời thành văn bản có thể sửa' },
      { label: 'Feedback AI', value: 'Chấm điểm và gợi ý cải thiện' },
      { label: 'Phiên đã lưu', value: 'Giữ câu trả lời, ghi chú và lịch sử tiến độ' },
    ]
    : voiceWorkflowSteps
  const hasInterviewCv = Boolean(cvAnalysis?.cvId)
  const initialRoleProfile = createCvRoleProfile(cvAnalysis)

  const [selectedRole, setSelectedRole] = useState(initialRoleProfile)
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(initialQuestionCountRef.current)
  const [roleCategory, setRoleCategory] = useState('all')
  const [roleQuery, setRoleQuery] = useState('')
  const [session, setSession] = useState(() => createInterviewSession(cvAnalysis, {
    roleProfile: initialRoleProfile,
    questionCount: initialQuestionCountRef.current,
    language: activeLanguage,
  }))
  const [messages, setMessages] = useState(() => (
    hasInterviewCv ? createInitialInterviewMessages(session, currentUser) : []
  ))
  const [questionIndex, setQuestionIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isQuestionAudioLoading, setIsQuestionAudioLoading] = useState(false)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [answerReviews, setAnswerReviews] = useState([])
  const [interviewResult, setInterviewResult] = useState(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [interviewSource, setInterviewSource] = useState('Mock AI')
  const [apiStatus, setApiStatus] = useState('Preparing interview session...')
  const [isChatExpanded, setIsChatExpanded] = useState(false)
  const [speechVoices, setSpeechVoices] = useState([])
  const [selectedSpeechVoiceURI, setSelectedSpeechVoiceURI] = useState(() => {
    const savedVoiceURI = loadSettings().speechVoiceURI

    if (activeLanguage === 'vi' && savedVoiceURI === ONLINE_VIETNAMESE_VOICE_URI) {
      return 'auto'
    }

    return savedVoiceURI || 'auto'
  })

  const questionCount = hasInterviewCv ? session.questions.length : 0
  const currentQuestion = hasInterviewCv ? (session.questions[questionIndex] ?? session.questions[0]) : ''
  const progress = questionCount ? Math.round(((questionIndex + 1) / questionCount) * 100) : 0
  const answeredCount = answerReviews.length
  const interviewSourceLabel = interviewSource === 'AWS'
    ? activeLanguage === 'vi' ? 'AI trực tuyến' : 'Live AI'
    : activeLanguage === 'vi' ? 'Luyện tập offline' : 'Offline practice'
  const cvRoleProfile = createCvRoleProfile(cvAnalysis)
  const visibleRoles = filterInterviewRoles({ category: roleCategory, query: roleQuery })
  const isUsingCvRole = selectedRole.id === 'cv-role'
  const interviewState = getInterviewState({
    isCompleted,
    isAiThinking,
    isRecording,
    isTranscribing,
    isQuestionAudioLoading,
    copy,
  })
  const speechVoiceOptions = getSpeechVoiceOptions(speechVoices, activeLanguage)
  const selectedSpeechVoice = speechVoices.find((voice) => voice.voiceURI === selectedSpeechVoiceURI)

  useEffect(() => {
    return () => {
      stopCamera()
      stopRecording({ process: false })
      stopQuestionAudio()
      stopBrowserSpeechRecognition()
      stopSpeaking()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadVoices = () => getBrowserSpeechVoices().then((voices) => {
      if (isMounted) {
        setSpeechVoices(voices)
      }
    })

    loadVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices)

    return () => {
      isMounted = false
      window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices)
    }
  }, [])

  useEffect(() => {
    if (activeLanguage !== 'vi' && selectedSpeechVoiceURI === ONLINE_VIETNAMESE_VOICE_URI) {
      setSelectedSpeechVoiceURI('auto')
    }
  }, [activeLanguage, selectedSpeechVoiceURI])

  useEffect(() => {
    activeLanguageRef.current = activeLanguage
    currentUserRef.current = currentUser
    noCvTitleRef.current = copy.noCvTitle
  }, [activeLanguage, currentUser, copy.noCvTitle])

  useEffect(() => {
    if (cvIdRef.current === cvAnalysis?.cvId) {
      return
    }

    cvIdRef.current = cvAnalysis?.cvId
    setSelectedRole(createCvRoleProfile(cvAnalysis))
  }, [cvAnalysis])

  useEffect(() => {
    let isMounted = true

    async function loadAwsInterview() {
      const sessionLanguage = activeLanguageRef.current
      const interviewUser = currentUserRef.current
      sessionLanguageRef.current = sessionLanguage
      const localSession = createInterviewSession(cvAnalysis, {
        roleProfile: selectedRole,
        questionCount: selectedQuestionCount,
        language: sessionLanguage,
      })

      if (!hasInterviewCv) {
        setSession(localSession)
        setMessages([])
        setQuestionIndex(0)
        setDraft('')
        setAnswerReviews([])
        setInterviewResult(null)
        setIsCompleted(false)
        setInterviewSource('Waiting for CV')
        setApiStatus(noCvTitleRef.current)
        return
      }

      setApiStatus(sessionLanguage === 'vi'
        ? `Đang tạo câu hỏi phỏng vấn cho ${selectedRole.label}...`
        : `Creating ${selectedRole.label} interview questions...`)

      try {
        const awsSession = await createInterviewOnAws({
          cvAnalysis,
          currentUser: interviewUser,
          roleProfile: selectedRole,
          questionCount: selectedQuestionCount,
          language: sessionLanguage,
        })

        if (!isMounted || !awsSession.questions.length) {
          return
        }

        setSession(awsSession)
        setMessages(createInitialInterviewMessages(awsSession, interviewUser))
        setQuestionIndex(0)
        setAnswerReviews([])
        setInterviewResult(null)
        setIsCompleted(false)
        setInterviewSource('AWS')
        setApiStatus(sessionLanguage === 'vi'
          ? `Phiên phỏng vấn đã sẵn sàng cho ${awsSession.role}`
          : `Interview session ready for ${awsSession.role}`)
      } catch (error) {
        if (isMounted) {
          setSession(localSession)
          setMessages(createInitialInterviewMessages(localSession, interviewUser))
          setQuestionIndex(0)
          setDraft('')
          setAnswerReviews([])
          setInterviewResult(null)
          setIsCompleted(false)
          setInterviewSource('Mock AI')
          setApiStatus(sessionLanguage === 'vi'
            ? `Đang dùng chế độ luyện tập offline cho ${localSession.role}`
            : `Using offline practice mode for ${localSession.role}`)
        }
      }
    }

    loadAwsInterview()

    return () => {
      isMounted = false
    }
  }, [cvAnalysis, currentUser?.userId, hasInterviewCv, selectedRole, selectedQuestionCount])

  async function resetInterview(
    nextSession = createInterviewSession(cvAnalysis, {
      roleProfile: selectedRole,
      questionCount: selectedQuestionCount,
      language: activeLanguage,
    }),
    roleProfile = selectedRole,
    questionCountValue = selectedQuestionCount,
  ) {
    if (!hasInterviewCv) {
      setApiStatus(copy.noCvTitle)
      return
    }

    const sessionLanguage = activeLanguage
    sessionLanguageRef.current = sessionLanguage
    stopSpeaking()
    stopQuestionAudio()
    stopBrowserSpeechRecognition()
    stopRecording({ process: false })
    setApiStatus(sessionLanguage === 'vi'
      ? `Đang tạo phiên phỏng vấn mới cho ${roleProfile.label}...`
      : `Creating a new ${roleProfile.label} interview session...`)

    try {
      const awsSession = await createInterviewOnAws({
        cvAnalysis,
        currentUser,
        roleProfile,
        questionCount: questionCountValue,
        language: sessionLanguage,
      })
      setSession(awsSession)
      setMessages(createInitialInterviewMessages(awsSession, currentUser))
      setInterviewSource('AWS')
      setApiStatus(sessionLanguage === 'vi'
        ? `Phiên phỏng vấn đã sẵn sàng cho ${awsSession.role}`
        : `Interview session ready for ${awsSession.role}`)
    } catch (error) {
      setSession(nextSession)
      setMessages(createInitialInterviewMessages(nextSession, currentUser))
      setInterviewSource('Mock AI')
      setApiStatus(sessionLanguage === 'vi'
        ? `Đang dùng chế độ luyện tập offline cho ${nextSession.role}`
        : `Using offline practice mode for ${nextSession.role}`)
    }

    setQuestionIndex(0)
    setDraft('')
    setIsAiThinking(false)
    setAnswerReviews([])
    setInterviewResult(null)
    setIsCompleted(false)
  }

  function handleSelectRole(role) {
    if (role.id === selectedRole.id) {
      return
    }

    setSelectedRole(role)
  }

  function handleUseCvRole() {
    if (selectedRole.id === 'cv-role') {
      return
    }

    setSelectedRole(createCvRoleProfile(cvAnalysis))
  }

  function handleQuestionCountChange(value) {
    setSelectedQuestionCount(Number(value))
  }

  function handleSpeechVoiceChange(value) {
    setSelectedSpeechVoiceURI(value)
    saveSettings({
      ...loadSettings(),
      speechVoiceURI: value,
    })
  }

  async function toggleCamera() {
    if (cameraEnabled) {
      stopCamera()
      setCameraEnabled(false)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(copy.cameraUnsupported)
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
      setCameraError(copy.cameraBlocked)
      setCameraEnabled(false)
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      stopRecording()
      return
    }

    if (isTranscribing) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError(copy.micUnsupported)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      chunksRef.current = []
      browserTranscriptRef.current = ''
      const mimeType = getPreferredRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stopBrowserSpeechRecognition()
        const shouldProcess = shouldProcessRecordingRef.current
        const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm'
        const audioBlob = new Blob(chunksRef.current, { type: recordedMimeType })
        chunksRef.current = []
        stopAudioStream()

        if (!shouldProcess) {
          return
        }

        if (!audioBlob.size) {
          setVoiceError(copy.noAudio)
          return
        }

        setIsTranscribing(true)
        setVoiceError(copy.transcribeSending)

        try {
          const result = await transcribeAnswerAudio({
            audioBlob,
            userId: currentUser.userId,
            interviewId: session.interviewId,
            questionIndex,
            languageCode: languageConfig.transcribeLanguageCode,
          })

          setDraft(result.transcript)
          setVoiceError(copy.transcribeDone)
        } catch (error) {
          const browserTranscript = browserTranscriptRef.current.trim()

          if (browserTranscript) {
            setDraft(browserTranscript)
            setVoiceError(activeLanguage === 'vi'
              ? 'Transcript online chưa dùng được, đang dùng nhận diện giọng nói của trình duyệt.'
              : 'Online transcript is unavailable, using browser speech recognition.')
          } else {
            setVoiceError(activeLanguage === 'vi'
              ? 'Chưa tạo được transcript. Hãy nhập câu trả lời thủ công hoặc thử ghi âm lại.'
              : 'No transcript was generated. Please type your answer manually or try recording again.')
          }
        } finally {
          setIsTranscribing(false)
        }
      }

      recorderRef.current = recorder
      shouldProcessRecordingRef.current = true
      startBrowserSpeechRecognition()
      recorder.start(1000)
      setIsRecording(true)
      setVoiceError(copy.recordingVoice)
    } catch {
      setVoiceError(copy.micBlocked)
      setIsRecording(false)
    }
  }

  function stopRecording({ process = true } = {}) {
    shouldProcessRecordingRef.current = process
    stopBrowserSpeechRecognition()

    if (recorderRef.current?.state === 'recording') {
      try {
        recorderRef.current.requestData()
      } catch {
        // Some browsers do not support forcing the last recording chunk.
      }

      recorderRef.current.stop()
    } else {
      stopAudioStream()
    }

    setIsRecording(false)
  }

  function startBrowserSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      return false
    }

    stopBrowserSpeechRecognition()

    const recognition = new SpeechRecognition()
    recognition.lang = languageConfig.speechRecognitionLanguage
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || ''

        if (event.results[index].isFinal) {
          finalText += `${transcript} `
        } else {
          interimText += `${transcript} `
        }
      }

      if (finalText.trim()) {
        browserTranscriptRef.current = `${browserTranscriptRef.current} ${finalText}`.trim()
        setDraft(browserTranscriptRef.current)
        return
      }

      if (interimText.trim()) {
        setDraft(`${browserTranscriptRef.current} ${interimText}`.trim())
      }
    }

    recognition.onerror = () => {}
    recognition.onend = () => {
      if (browserSpeechRecognitionRef.current === recognition) {
        browserSpeechRecognitionRef.current = null

        if (recorderRef.current?.state === 'recording') {
          window.setTimeout(() => {
            if (recorderRef.current?.state === 'recording' && !browserSpeechRecognitionRef.current) {
              startBrowserSpeechRecognition()
            }
          }, 250)
        }
      }
    }

    try {
      recognition.start()
      browserSpeechRecognitionRef.current = recognition
      return true
    } catch {
      browserSpeechRecognitionRef.current = null
      return false
    }
  }

  function stopBrowserSpeechRecognition() {
    if (!browserSpeechRecognitionRef.current) {
      return
    }

    try {
      browserSpeechRecognitionRef.current.stop()
    } catch {
      browserSpeechRecognitionRef.current = null
    }
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

  async function handleSpeakQuestion() {
    stopQuestionAudio()
    stopSpeaking()
    setIsQuestionAudioLoading(true)
    setVoiceError(languageConfig.usePolly ? copy.pollyCreating : copy.browserVoice)

    try {
      if (!languageConfig.usePolly) {
        if (selectedSpeechVoiceURI === ONLINE_VIETNAMESE_VOICE_URI) {
          const controller = await playOnlineVietnameseSpeech(currentQuestion)

          if (!controller) {
            throw new Error(copy.missingVietnameseVoice)
          }

          questionAudioRef.current = controller
          controller.done
            .then(() => {
              if (questionAudioRef.current === controller) {
                setVoiceError('')
                questionAudioRef.current = null
              }
            })
            .catch((error) => {
              if (questionAudioRef.current === controller) {
                speakText(currentQuestion, languageConfig.speechSynthesisLanguage, {
                  rate: languageConfig.speechSynthesisRate,
                  voiceNames: languageConfig.speechVoiceNames,
                  requireLanguageMatch: false,
                }).then((speechResult) => {
                  if (speechResult.spoken) {
                    setVoiceError(`${copy.browserVoice} (${speechResult.voiceName}): ${error.message}`)
                    return
                  }

                  setVoiceError(error.message)
                })
                questionAudioRef.current = null
              }
            })
          setVoiceError(`${copy.browserVoice} (${copy.onlineVietnameseVoice}).`)
          return
        }

        const browserVoiceURI = selectedSpeechVoiceURI === 'auto'
          || selectedSpeechVoiceURI === ONLINE_VIETNAMESE_VOICE_URI
          ? ''
          : selectedSpeechVoiceURI
        const speechResult = await speakText(currentQuestion, languageConfig.speechSynthesisLanguage, {
          rate: languageConfig.speechSynthesisRate,
          voiceURI: browserVoiceURI,
          voiceNames: languageConfig.speechVoiceNames,
          requireLanguageMatch: false,
        })

        if (!speechResult.spoken) {
          throw new Error(speechResult.reason === 'missing-language-voice'
            ? copy.missingVietnameseVoice
            : activeLanguage === 'vi'
            ? 'Trình duyệt chưa hỗ trợ text-to-speech.'
            : 'Browser text-to-speech is not supported.')
        }

        setVoiceError(`${copy.browserVoice} (${speechResult.voiceName}).`)
        return
      }

      const result = await synthesizeQuestionAudio({
        text: currentQuestion,
        userId: currentUser.userId,
        interviewId: session.interviewId,
        questionIndex,
        voiceId: languageConfig.pollyVoiceId,
        engine: languageConfig.pollyEngine,
      })
      const audio = new Audio(result.audioUrl)
      questionAudioRef.current = audio
      audio.onended = () => {
        setVoiceError('')
      }
      await audio.play()
      setVoiceError(`${copy.pollyPlaying} (${result.voiceId}).`)
    } catch (error) {
      const browserVoiceURI = selectedSpeechVoiceURI === 'auto'
        || selectedSpeechVoiceURI === ONLINE_VIETNAMESE_VOICE_URI
        ? ''
        : selectedSpeechVoiceURI
      const speechResult = await speakText(currentQuestion, languageConfig.speechSynthesisLanguage, {
        rate: languageConfig.speechSynthesisRate,
        voiceURI: browserVoiceURI,
        voiceNames: languageConfig.speechVoiceNames,
        requireLanguageMatch: false,
      })

      if (speechResult.spoken) {
        setVoiceError(activeLanguage === 'vi'
          ? `${copy.browserVoice} (${speechResult.voiceName}): ${error.message}`
          : `Online question voice unavailable, using browser voice (${speechResult.voiceName}).`)
      } else {
        setVoiceError(activeLanguage === 'vi'
          ? `Không đọc được câu hỏi bằng giọng nói: ${error.message}`
          : 'Question voice is unavailable and browser text-to-speech is not supported.')
      }
    } finally {
      setIsQuestionAudioLoading(false)
    }
  }

  function stopQuestionAudio() {
    if (questionAudioRef.current) {
      if (typeof questionAudioRef.current.stop === 'function') {
        questionAudioRef.current.stop()
      } else {
        questionAudioRef.current.pause()
        questionAudioRef.current.currentTime = 0
      }
      questionAudioRef.current = null
    }
  }

  async function sendAnswer(answerText = draft) {
    const answer = answerText.trim()

    if (!hasInterviewCv || !answer || isAiThinking || isCompleted) {
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

    let aiResult

    try {
      aiResult = interviewSource === 'AWS'
        ? await submitAnswerToAws({
          userId: currentUser.userId,
          interviewId: session.interviewId,
          questionIndex,
          question: currentQuestion,
          answer,
          language: activeLanguage,
        })
        : await askMockAi({ answer, question: currentQuestion, questionIndex, language: activeLanguage })
    } catch (error) {
      setApiStatus(activeLanguage === 'vi'
        ? 'Chấm điểm online chưa dùng được, đang dùng feedback offline.'
        : 'Online scoring is unavailable, using offline feedback.')
      setInterviewSource('Mock AI')
      aiResult = await askMockAi({ answer, question: currentQuestion, questionIndex, language: activeLanguage })
    }

    aiResult = enhanceInterviewFeedback({
      aiResult,
      question: currentQuestion,
      answer,
      currentUser,
      session,
      cvAnalysis,
      language: activeLanguage,
    })

    const shouldAdvance = aiResult.shouldAdvance ?? true
    const isLastQuestion = questionIndex >= session.questions.length - 1
    const nextQuestionIndex = shouldAdvance
      ? Math.min(questionIndex + 1, session.questions.length - 1)
      : questionIndex
    const nextQuestion = session.questions[nextQuestionIndex] ?? aiResult.nextQuestion
    const review = {
      question: currentQuestion,
      answer,
      score: aiResult.score,
      level: aiResult.level,
      feedback: aiResult.feedback,
      answeredAt: new Date().toISOString(),
    }
    const acceptedReviews = shouldAdvance ? [...answerReviews, review] : answerReviews
    const completedResult = shouldAdvance && isLastQuestion
      ? createInterviewResult({
        session,
        currentUser,
        cvAnalysis,
        answers: acceptedReviews,
      })
      : null
    const aiMessage = {
      id: createId(),
      sender: 'ai',
      kind: 'review',
      feedback: aiResult.feedback,
      shouldAdvance,
      isLastQuestion,
      nextQuestion,
      text: getLocalizedAiResponseText({ aiResult, shouldAdvance, isLastQuestion, nextQuestion, language: activeLanguage }),
      score: aiResult.score,
      createdAt: new Date().toISOString(),
    }

    setMessages((current) => [...current, aiMessage])
    setAnswerReviews(acceptedReviews)

    if (completedResult) {
      saveInterviewResult(completedResult, currentUser.userId)
      setInterviewResult(completedResult)
      setIsCompleted(true)
      onInterviewComplete(completedResult)
    } else {
      setQuestionIndex(nextQuestionIndex)
    }

    setIsAiThinking(false)
  }

  function handleComposerKeyDown(event) {
    if (event.nativeEvent.isComposing) {
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendAnswer()
    }
  }

  if (!hasInterviewCv) {
    return (
      <div className="dashboard-page interview-page">
        <div className="dashboard-frame">
          <InterviewSidebar appCopy={appCopy} currentPage="interview" onNavigate={onNavigate} onLogout={onLogout} />

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
                  <p>{copy.pageTitle}</p>
                  <h2>{copy.setupRequired}</h2>
                </div>
              </div>

              <div className="topbar-actions">
                <PreferenceControls
                  colorTheme={colorTheme}
                  language={activeLanguage}
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

            <div className="dashboard-content interview-content">
              <section className="panel interview-empty-state">
                <div className="interview-empty-icon"><Icon name="file" /></div>
                <div>
                  <p className="eyebrow">{copy.noCvEyebrow}</p>
                  <h1>{copy.noCvTitle}</h1>
                  <p>{copy.noCvText}</p>
                </div>
                <div className="interview-empty-actions">
                  <button className="primary-result-action" type="button" onClick={() => onNavigate('upload-cv')}>
                    <Icon name="upload" />
                    {copy.uploadCv}
                  </button>
                  <button className="secondary-result-action" type="button" onClick={() => onNavigate('dashboard')}>
                    <Icon name="dashboard" />
                    {copy.backDashboard}
                  </button>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page interview-page">
      <div className="dashboard-frame">
        <InterviewSidebar appCopy={appCopy} currentPage="interview" onNavigate={onNavigate} onLogout={onLogout} />

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
                <p>{copy.pageTitle}</p>
                <h2>{session.role}</h2>
              </div>
            </div>

            <div className="topbar-actions">
              <PreferenceControls
                colorTheme={colorTheme}
                language={activeLanguage}
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

          <div className="dashboard-content interview-content">
            <RolePickerPanel
              categories={roleCategories}
              roles={visibleRoles}
              selectedRole={selectedRole}
              cvRole={cvRoleProfile}
              activeCategory={roleCategory}
              query={roleQuery}
              questionCount={selectedQuestionCount}
              questionOptions={interviewQuestionOptions}
              isUsingCvRole={isUsingCvRole}
              onCategoryChange={setRoleCategory}
              onQueryChange={setRoleQuery}
              onQuestionCountChange={handleQuestionCountChange}
              onSelectRole={handleSelectRole}
              onUseCvRole={handleUseCvRole}
              copy={copy}
            />

            <section className={`interview-stage ${isChatExpanded ? 'chat-expanded' : ''}`}>
              <div className="video-card panel">
                <div className="video-header">
                  <div>
                    <span className={`live-dot ${cameraEnabled ? 'online' : ''}`}>
                      {cameraEnabled ? copy.cameraOnline : copy.cameraStandby}
                    </span>
                    <h2>{copy.interviewRoom}</h2>
                    <p>{currentUser.fullName} - {session.focus}</p>
                  </div>
                  <div className="question-progress" aria-label="Question progress">
                    <span>{questionIndex + 1}/{session.questions.length}</span>
                    <div className="mini-progress"><i style={{ width: `${progress}%` }} /></div>
                    <small>{interviewSourceLabel}</small>
                  </div>
                </div>

                <div className={`video-surface ${cameraEnabled ? 'camera-on' : ''}`}>
                  <video ref={videoRef} autoPlay playsInline muted />
                  <div className="video-topbar">
                    <span>{currentUser.fullName}</span>
                    <strong className={isRecording ? 'recording-pill active' : 'recording-pill'}>
                      {isRecording ? copy.recording : interviewState}
                    </strong>
                  </div>
                  {!cameraEnabled ? (
                    <div className="camera-placeholder">
                      <Icon name="videoOff" />
                      <strong>{copy.cameraOff}</strong>
                      <span>{copy.cameraHidden}</span>
                    </div>
                  ) : null}
                </div>

                <div className="interview-room-footer">
                  <div className="interviewer-status-card">
                    <div className="ai-avatar"><Icon name="brain" /></div>
                    <div>
                      <strong>{copy.aiInterviewer}</strong>
                      <span>{getInterviewerStatus({ isAiThinking, isRecording, isTranscribing, isQuestionAudioLoading, copy })}</span>
                    </div>
                  </div>

                  <div className="interview-controls" aria-label="Interview controls">
                    <button className={`round-control ${cameraEnabled ? 'active' : ''}`} type="button" onClick={toggleCamera} aria-label="Toggle camera" title="Toggle camera">
                      <Icon name={cameraEnabled ? 'video' : 'videoOff'} />
                    </button>
                    <button
                      className={`round-control ${isRecording ? 'danger active' : ''} ${isTranscribing ? 'processing' : ''}`}
                      type="button"
                      onClick={toggleRecording}
                      aria-label="Toggle microphone recording"
                      title="Toggle microphone recording"
                      disabled={isTranscribing}
                    >
                      <Icon name={isRecording ? 'stop' : 'mic'} />
                    </button>
                    <button
                      className={`round-control ${isQuestionAudioLoading ? 'processing' : ''}`}
                      type="button"
                      onClick={handleSpeakQuestion}
                      aria-label="Read question aloud"
                      title="Read question aloud"
                      disabled={isQuestionAudioLoading}
                    >
                      <Icon name="volume" />
                    </button>
                    <button className="round-control" type="button" onClick={() => onNavigate('dashboard')} aria-label="Leave interview" title="Leave interview">
                      <Icon name="logout" />
                    </button>
                  </div>
                </div>

                {cameraError ? <p className="interview-error">{cameraError}</p> : null}
                {voiceError ? <p className="interview-voice-status">{voiceError}</p> : null}
              </div>

              <div className="panel chat-panel">
                <div className="panel-header">
                  <div>
                    <h3>{copy.conversation}</h3>
                    <p>{apiStatus}{isTranscribing ? copy.transcribeProcessing : ''}</p>
                  </div>
                  <div className="chat-header-actions" aria-label="Conversation status">
                    <span>{interviewState}</span>
                    <span>{answeredCount}/{session.questions.length} {copy.answered}</span>
                    <button
                      className="chat-size-button"
                      type="button"
                      onClick={() => setIsChatExpanded((current) => !current)}
                      aria-pressed={isChatExpanded}
                    >
                      <Icon name={isChatExpanded ? 'minimize' : 'maximize'} />
                      {isChatExpanded ? copy.compact : copy.expand}
                    </button>
                  </div>
                </div>

                <div className="message-list" aria-label="Interview messages">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} copy={copy} language={activeLanguage} />
                  ))}
                  {isAiThinking ? (
                    <div className="message-bubble ai thinking">
                      <span>{copy.aiPreparing}</span>
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
                    onKeyDown={handleComposerKeyDown}
                    placeholder={isCompleted ? copy.completedPlaceholder : copy.answerPlaceholder}
                    rows="3"
                    disabled={isCompleted}
                  />
                  <button className="send-button" type="submit" disabled={!draft.trim() || isAiThinking || isCompleted || isTranscribing}>
                    <Icon name="send" />
                    {copy.send}
                  </button>
                </form>
              </div>
            </section>

            {interviewResult ? (
              <InterviewResultPanel
                result={interviewResult}
                onNavigate={onNavigate}
                onRestart={() => resetInterview()}
                copy={copy}
              />
            ) : null}

            <section className="interview-lower-grid">
              <aside className="panel question-card">
                <div className="panel-header">
                  <div>
                    <h3>{copy.currentQuestion}</h3>
                    <p>{copy.question} {questionIndex + 1}/{session.questions.length} - {session.focus}</p>
                  </div>
                  <button className="new-question-set-button" type="button" onClick={() => resetInterview()}>
                    <Icon name="shuffle" />
                    {isCompleted ? copy.newInterview : copy.newSet}
                  </button>
                </div>
                {isCompleted ? (
                  <CompletionSummary result={interviewResult} copy={copy} />
                ) : (
                  <>
                    <p className="question-text">{currentQuestion}</p>
                    <div className="answer-mode-grid">
                      <ModeCard
                        icon="mic"
                        title={copy.voiceAnswer}
                        text={copy.voiceAnswerText}
                        active={isRecording || isTranscribing}
                      />
                      <ModeCard icon="message" title={copy.chatAnswer} text={copy.chatAnswerText} />
                    </div>
                  </>
                )}
              </aside>

              <aside className="panel aws-panel">
                <div className="panel-header">
                  <div>
                    <h3>{copy.awsVoice}</h3>
                    <p>{copy.awsVoiceText}</p>
                  </div>
                </div>
                <BrowserVoicePicker
                  copy={copy}
                  activeLanguage={activeLanguage}
                  voices={speechVoiceOptions}
                  selectedVoice={selectedSpeechVoice}
                  selectedVoiceURI={selectedSpeechVoiceURI}
                  onChange={handleSpeechVoiceChange}
                />
                <div className="aws-step-list">
                  {voiceSteps.map((step) => (
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

function RolePickerPanel({
  categories,
  roles,
  selectedRole,
  cvRole,
  activeCategory,
  query,
  questionCount,
  questionOptions,
  isUsingCvRole,
  onCategoryChange,
  onQueryChange,
  onQuestionCountChange,
  onSelectRole,
  onUseCvRole,
  copy,
}) {
  return (
    <section className="panel role-picker-panel" aria-label="Interview role picker">
      <div className="role-picker-hero">
        <div>
          <p className="eyebrow">{copy.interviewRole}</p>
          <h3>{copy.roleTitle}</h3>
          <p>{copy.roleText}</p>
        </div>

        <div className="selected-role-card">
          <span className="role-mark">{selectedRole.mark || 'AI'}</span>
          <div>
            <small>{copy.selectedRole}</small>
            <strong>{selectedRole.label}</strong>
            <p>{selectedRole.description}</p>
          </div>
          <div className="selected-role-tags">
            <span>{getRoleCategoryLabel(selectedRole.category)}</span>
            <span>{selectedRole.focus}</span>
          </div>
        </div>
      </div>

      <div className="role-picker-toolbar">
        <div className="role-category-tabs" aria-label="Role categories">
          {categories.map((category) => (
            <button
              className={`role-filter-button ${activeCategory === category.id ? 'active' : ''}`}
              type="button"
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>

        <label className="role-search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={copy.searchRole}
          />
        </label>

        <label className="question-count-select">
          <span>{copy.questions}</span>
          <select
            value={questionCount}
            onChange={(event) => onQuestionCountChange(event.target.value)}
          >
            {questionOptions.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="role-chip-grid">
        <RoleOptionButton
          role={cvRole}
          selected={isUsingCvRole}
          onSelect={onUseCvRole}
        />
        {roles.map((role) => (
          <RoleOptionButton
            role={role}
            selected={selectedRole.id === role.id}
            key={role.id}
            onSelect={() => onSelectRole(role)}
          />
        ))}
        {!roles.length ? <p className="role-empty-state">{copy.noRole}</p> : null}
      </div>

      {!isUsingCvRole ? (
        <button className="back-to-cv-role-button" type="button" onClick={onUseCvRole}>
          <Icon name="arrowLeft" />
          {copy.backToCvRole}
        </button>
      ) : null}
    </section>
  )
}

function RoleOptionButton({ role, selected, onSelect }) {
  return (
    <button
      className={`role-option-button ${selected ? 'active' : ''}`}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="role-option-mark">{role.mark}</span>
      <span className="role-option-copy">
        <strong>{role.label}</strong>
        <small>{role.focus}</small>
      </span>
      <span className="role-option-count">{role.count}</span>
    </button>
  )
}

function createCvRoleProfile(cvAnalysis) {
  const skills = cvAnalysis?.skills?.filter(Boolean) || []
  const label = cvAnalysis?.suggestedPosition || 'CV Suggested Role'

  return {
    id: 'cv-role',
    label,
    category: 'cv',
    mark: 'CV',
    count: skills.length,
    focus: skills.slice(0, 3).join(', ') || 'CV skills',
    skills,
    description: 'Use the role and skill focus detected from your uploaded CV.',
  }
}

function filterInterviewRoles({ category, query }) {
  const normalizedQuery = query.trim().toLowerCase()

  return interviewRoles.filter((role) => {
    const matchesCategory = category === 'all' || role.category === category
    const searchableText = [
      role.label,
      role.focus,
      role.description,
      ...role.skills,
    ].join(' ').toLowerCase()

    return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery))
  })
}

function getRoleCategoryLabel(category) {
  if (category === 'cv') {
    return 'CV Role'
  }

  return roleCategories.find((item) => item.id === category)?.label || 'Custom Role'
}

function createInitialInterviewMessages(session, currentUser) {
  const candidateName = currentUser?.fullName ?? 'Candidate'
  const role = session?.role || 'AI Interview'
  const question = session?.questions?.[0] || ''

  return [
    {
      id: createId(),
      sender: 'ai',
      kind: 'intro',
      candidateName,
      role,
      question,
      text: getIntroMessage({ candidateName, role, question, language: session?.language }),
      createdAt: new Date().toISOString(),
    },
  ]
}

function getMessageText(message, language = 'en') {
  if (message.kind === 'intro') {
    return getIntroMessage({
      candidateName: message.candidateName,
      role: message.role,
      question: message.question,
      language,
    })
  }

  if (message.kind === 'review') {
    return getLocalizedAiResponseText({
      aiResult: { feedback: message.feedback || '' },
      shouldAdvance: message.shouldAdvance ?? true,
      isLastQuestion: Boolean(message.isLastQuestion),
      nextQuestion: message.nextQuestion || '',
      language,
    })
  }

  return message.text
}

function getIntroMessage({ candidateName = 'Candidate', role = 'AI Interview', question = '', language = 'en' }) {
  const isVietnamese = normalizeLanguage(language) === 'vi'

  return isVietnamese
    ? `Xin ch\u00e0o ${candidateName}. T\u00f4i s\u1ebd ph\u1ecfng v\u1ea5n b\u1ea1n cho v\u1ecb tr\u00ed ${role}. ${question}`
    : `Hello ${candidateName}. I will interview you for the ${role} position. ${question}`
}

function getLocalizedAiResponseText({ aiResult, shouldAdvance, isLastQuestion, nextQuestion, language = 'en' }) {
  const isVietnamese = normalizeLanguage(language) === 'vi'

  if (!shouldAdvance) {
    return `${aiResult.feedback}\n\n${isVietnamese ? 'Th\u1eed l\u1ea1i' : 'Try again'}: ${nextQuestion}`
  }

  if (isLastQuestion) {
    return isVietnamese
      ? `${aiResult.feedback}\n\nPh\u1ecfng v\u1ea5n \u0111\u00e3 ho\u00e0n t\u1ea5t. K\u1ebft qu\u1ea3 cu\u1ed1i c\u00f9ng \u0111\u00e3 s\u1eb5n s\u00e0ng b\u00ean d\u01b0\u1edbi.`
      : `${aiResult.feedback}\n\nInterview completed. Your final result is ready below.`
  }

  return `${aiResult.feedback}\n\n${isVietnamese ? 'C\u00e2u h\u1ecfi ti\u1ebfp theo' : 'Next question'}: ${nextQuestion}`
}

function getInterviewerStatus({
  isAiThinking,
  isRecording,
  isTranscribing,
  isQuestionAudioLoading,
  copy,
}) {
  if (isAiThinking) return copy.statusReviewing
  if (isRecording) return copy.statusListening
  if (isTranscribing) return copy.statusTranscribing
  if (isQuestionAudioLoading) return copy.statusSpeaking
  return copy.statusReady
}

function getInterviewState({
  isCompleted,
  isAiThinking,
  isRecording,
  isTranscribing,
  isQuestionAudioLoading,
  copy,
}) {
  if (isCompleted) return copy.stateCompleted
  if (isAiThinking) return copy.stateAiReviewing
  if (isRecording) return copy.stateRecording
  if (isTranscribing) return copy.stateTranscribing
  if (isQuestionAudioLoading) return copy.stateSpeaking
  return copy.stateProgress
}

function CompletionSummary({ result, copy }) {
  return (
    <div className="completion-summary">
      <strong>{result?.overallScore ?? 0}/100</strong>
      <span>{copy.finalScore}</span>
      <p>{result?.recommendation}</p>
    </div>
  )
}

function InterviewResultPanel({ result, onNavigate, onRestart, copy }) {
  return (
    <section className="panel interview-result-panel" aria-label="Interview result">
      <div className="result-score-card">
        <span>{copy.finalScore}</span>
        <strong>{result.overallScore}<small>/100</small></strong>
        <p>{result.role}</p>
      </div>

      <div className="result-detail-grid">
        <ResultList title={copy.strengths} items={result.strengths} />
        <ResultList title={copy.improvements} items={result.improvements} />
      </div>

      <div className="result-recommendation">
        <h3>{copy.recommendation}</h3>
        <p>{result.recommendation}</p>
        <div className="result-actions">
          <button className="secondary-result-action" type="button" onClick={onRestart}>
            <Icon name="shuffle" />
            {copy.newInterview}
          </button>
          <button className="primary-result-action" type="button" onClick={() => onNavigate('result')}>
            <Icon name="chart" />
            {copy.fullResult}
          </button>
        </div>
      </div>
    </section>
  )
}

function ResultList({ title, items }) {
  return (
    <div className="result-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function InterviewSidebar({ appCopy, currentPage, onNavigate, onLogout }) {
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

function ModeCard({ icon, title, text, active = false }) {
  return (
    <div className={`mode-card ${active ? 'active' : ''}`}>
      <Icon name={icon} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  )
}

function BrowserVoicePicker({
  copy,
  activeLanguage,
  voices,
  selectedVoice,
  selectedVoiceURI,
  onChange,
}) {
  const hasVoices = voices.length > 0
  const selectedValue = selectedVoiceURI || 'auto'

  return (
    <label className="browser-voice-picker">
      <span>{copy.browserVoiceLabel}</span>
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        disabled={!hasVoices && activeLanguage !== 'vi'}
      >
        <option value="auto">{copy.autoVoice}</option>
        {activeLanguage === 'vi' ? (
          <option value={ONLINE_VIETNAMESE_VOICE_URI}>{copy.onlineVietnameseVoice}</option>
        ) : null}
        {voices.map((voice) => (
          <option value={voice.voiceURI} key={`${voice.voiceURI}-${voice.name}-${voice.lang}`}>
            {voice.name} ({voice.lang})
          </option>
        ))}
      </select>
      <small>
        {selectedValue === ONLINE_VIETNAMESE_VOICE_URI
          ? copy.onlineVietnameseVoice
          : selectedVoice
          ? `${selectedVoice.name} - ${selectedVoice.lang}`
          : hasVoices || activeLanguage === 'vi'
            ? copy.autoVoice
            : copy.noVoiceAvailable}
      </small>
    </label>
  )
}

function MessageBubble({ message, copy, language }) {
  const text = getMessageText(message, language)

  return (
    <div className={`message-bubble ${message.sender}`}>
      <div className="message-meta">
        <strong>{message.sender === 'ai' ? copy.aiInterviewer : copy.userLabel}</strong>
        {message.score ? <span>{copy.score} {message.score}/100</span> : null}
      </div>
      <p>{text}</p>
    </div>
  )
}

function getSpeechVoiceOptions(voices, activeLanguage) {
  const languagePrefix = activeLanguage === 'vi' ? 'vi' : 'en'

  return [...voices].sort((first, second) => {
    const firstMatches = voiceMatchesLanguage(first, languagePrefix)
    const secondMatches = voiceMatchesLanguage(second, languagePrefix)

    if (firstMatches !== secondMatches) {
      return firstMatches ? -1 : 1
    }

    return first.name.localeCompare(second.name)
  })
}

function voiceMatchesLanguage(voice, languagePrefix) {
  return String(voice?.lang || '').toLowerCase().startsWith(languagePrefix)
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
    maximize: <path d="M8 3H3v5M21 8V3h-5M16 21h5v-5M3 16v5h5" />,
    minimize: <path d="M8 3v5H3M16 3v5h5M21 16h-5v5M3 16h5v5" />,
    shuffle: <path d="M16 3h5v5M4 17h3.5c2.2 0 3.2-1.3 4.3-3.8l.4-.9C13.3 8.8 14.5 7 17 7h4M16 21h5v-5M4 7h3.5c1.8 0 2.9.9 3.8 2.7M14 15.3c.8 1.1 1.8 1.7 3 1.7h4" />,
    search: <path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4z" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
