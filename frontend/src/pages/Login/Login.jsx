import { useEffect, useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import {
  isCognitoConfigured,
  prepareCognitoLogin,
} from '../../services/authService.js'
import { getAppCopy } from '../../services/i18n.js'
import { normalizeLanguage } from '../../services/language.js'
import neonBackground from '../../assets/cognito-branding/cognito-background-dark-neon.png'
import neonLogo from '../../assets/cognito-branding/cognito-logo-dark-neon.png'
import heroStack from '../../assets/cognito-branding/cognito-mark-dark-neon.png'
import './Login.css'

const floatingNodes = [
  { name: 'brain', style: 'node-a' },
  { name: 'file', style: 'node-b' },
  { name: 'mic', style: 'node-c' },
  { name: 'graph', style: 'node-d' },
  { name: 'shield', style: 'node-e' },
  { name: 'database', style: 'node-f' },
]

const loginCopy = {
  en: {
    eyebrow: 'AI Interview Intelligence',
    heroText: 'Upload CVs, generate technical interview rounds, evaluate answers, and review candidate talent signals through one secure AI workspace.',
    secure: 'Secure AI Interview Workspace',
    opening: 'Opening secure sign in...',
    signIn: 'Continue to Sign In',
    preparing: 'Preparing secure sign in...',
    viewWorkflow: 'View workflow',
    notConfigured: 'Secure sign-in is not configured yet.',
    overviewEyebrow: 'Project Overview',
    overviewTitle: 'A guided AI interview platform for CV-based practice',
    workflowEyebrow: 'Interview Flow',
    workflowTitle: 'Steps to complete an AI interview round',
    finalEyebrow: 'Final Output',
    finalTitle: 'Results include CV score, interview score, and actionable feedback',
    overallScore: 'Overall Interview Score',
    ready: 'Ready for next round',
    cvLabel: 'CV',
    aiMatch: 'AI Match',
    nodeLabels: {
      brain: 'AI',
      file: 'CV',
      mic: 'Voice',
      graph: 'Graph',
      shield: 'Auth',
      database: 'Data',
    },
    overviewText: 'Vertex-IntervAI / Talent Graph AI helps candidates practice interviews from a real CV: upload a resume, analyze it with AI, generate personalized interview rounds, score answers, and save history to track progress.',
    projectHighlights: [
      {
        value: 'Secure',
        label: 'Private candidate workspace',
        text: 'Candidates sign in safely, upload CVs, and keep progress connected to their own account.',
      },
      {
        value: 'AI',
        label: 'CV and interview intelligence',
        text: 'Analyze CVs, generate interview questions, evaluate answers, and return actionable feedback.',
      },
      {
        value: 'Role',
        label: 'User/Admin workflow',
        text: 'Candidates complete interviews while admins monitor users, CVs, interviews, and review queues.',
      },
    ],
    workflowText: 'The main flow guides candidates from the first CV upload to the final evaluation without requiring complex technical setup.',
    workflowSteps: [
      {
        icon: 'upload',
        step: '01',
        title: 'Upload CV',
        text: 'Candidates sign in securely and upload a CV. The workspace keeps the file and profile details ready for analysis.',
      },
      {
        icon: 'sparkles',
        step: '02',
        title: 'AI analyzes the CV',
        text: 'The AI reads the CV to extract skills, projects, CV score, experience signals, and suggested roles.',
      },
      {
        icon: 'mic',
        step: '03',
        title: 'Interview with AI',
        text: 'The system generates role-based interview questions and can read each question aloud for a more realistic flow.',
      },
      {
        icon: 'message',
        step: '04',
        title: 'Answer questions',
        text: 'Candidates answer by typing or recording audio. Voice answers become editable text before evaluation.',
      },
      {
        icon: 'chart',
        step: '05',
        title: 'Review results',
        text: 'The evaluator scores answers, stores attempts, updates the overall score, and shows interview history.',
      },
    ],
    resultText: 'After completing the interview, users can review the total score, answered questions, feedback, strengths, improvement areas, and saved progress history.',
  },
  vi: {
    eyebrow: 'Trí tuệ phỏng vấn AI',
    heroText: 'Tải CV lên, tạo vòng phỏng vấn kỹ thuật, chấm câu trả lời và xem lại tín hiệu năng lực ứng viên trong một không gian AI bảo mật.',
    secure: 'Không gian phỏng vấn AI bảo mật',
    opening: 'Đang mở đăng nhập bảo mật...',
    signIn: 'Tiếp tục đăng nhập',
    preparing: 'Đang chuẩn bị đăng nhập...',
    viewWorkflow: 'Xem workflow',
    notConfigured: 'Đăng nhập bảo mật chưa được cấu hình.',
    overviewEyebrow: 'Tổng quan đồ án',
    overviewTitle: 'Nền tảng luyện phỏng vấn AI dựa trên CV',
    workflowEyebrow: 'Luồng phỏng vấn',
    workflowTitle: 'Các bước hoàn thành một vòng phỏng vấn AI',
    finalEyebrow: 'Kết quả cuối',
    finalTitle: 'Kết quả gồm điểm CV, điểm phỏng vấn và nhận xét có thể hành động',
    overallScore: 'Điểm phỏng vấn tổng',
    ready: 'Sẵn sàng cho vòng tiếp theo',
    cvLabel: 'CV',
    aiMatch: 'Độ khớp AI',
    nodeLabels: {
      brain: 'AI',
      file: 'CV',
      mic: 'Giọng nói',
      graph: 'Biểu đồ',
      shield: 'Xác thực',
      database: 'Dữ liệu',
    },
    overviewText: 'Vertex-IntervAI / Talent Graph AI giúp ứng viên luyện phỏng vấn từ CV thật: tải hồ sơ lên, phân tích bằng AI, tạo vòng phỏng vấn cá nhân hóa, chấm câu trả lời và lưu lịch sử để theo dõi tiến bộ.',
    projectHighlights: [
      {
        value: 'Bảo mật',
        label: 'Không gian ứng viên riêng',
        text: 'Ứng viên đăng nhập an toàn, upload CV và lưu tiến độ theo đúng tài khoản của mình.',
      },
      {
        value: 'AI',
        label: 'Phân tích CV và phỏng vấn',
        text: 'Phân tích CV, tạo câu hỏi phỏng vấn, đánh giá câu trả lời và trả về nhận xét có thể áp dụng.',
      },
      {
        value: 'Vai trò',
        label: 'Luồng người dùng/admin',
        text: 'Ứng viên hoàn thành phỏng vấn, quản trị viên theo dõi người dùng, CV, cuộc phỏng vấn và hàng đợi đánh giá.',
      },
    ],
    workflowText: 'Luồng chính dẫn ứng viên từ bước upload CV đầu tiên đến kết quả đánh giá cuối cùng mà không cần thao tác kỹ thuật phức tạp.',
    workflowSteps: [
      {
        icon: 'upload',
        step: '01',
        title: 'Tải CV lên',
        text: 'Ứng viên đăng nhập an toàn và tải CV lên. Không gian làm việc giữ file và thông tin hồ sơ sẵn sàng để phân tích.',
      },
      {
        icon: 'sparkles',
        step: '02',
        title: 'AI phân tích CV',
        text: 'AI đọc CV để trích xuất kỹ năng, dự án, điểm CV, tín hiệu kinh nghiệm và role gợi ý.',
      },
      {
        icon: 'mic',
        step: '03',
        title: 'Phỏng vấn với AI',
        text: 'Hệ thống tạo câu hỏi theo vai trò và có thể đọc từng câu hỏi để tạo cảm giác phỏng vấn thực tế.',
      },
      {
        icon: 'message',
        step: '04',
        title: 'Trả lời câu hỏi',
        text: 'Ứng viên trả lời bằng cách gõ hoặc ghi âm. Câu trả lời giọng nói được chuyển thành văn bản có thể chỉnh sửa trước khi đánh giá.',
      },
      {
        icon: 'chart',
        step: '05',
        title: 'Xem kết quả',
        text: 'Bộ đánh giá sẽ chấm điểm, lưu lượt trả lời, cập nhật điểm tổng và hiển thị lịch sử.',
      },
    ],
    resultText: 'Sau khi hoàn thành phỏng vấn, người dùng có thể xem điểm tổng, câu đã trả lời, nhận xét, điểm mạnh, phần cần cải thiện và lịch sử tiến độ đã lưu.',
  },
}

export default function Login({
  authError = '',
  language = 'en',
  colorTheme = 'black',
  onLanguageChange = () => {},
  onThemeChange = () => {},
}) {
  const activeLanguage = normalizeLanguage(language)
  const copy = loginCopy[activeLanguage]
  const appCopy = getAppCopy(activeLanguage)
  const [error, setError] = useState(authError)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [preparedLoginUrl, setPreparedLoginUrl] = useState('')
  const canUseCognito = isCognitoConfigured()

  useEffect(() => {
    if (authError) {
      setError(authError)
    }
  }, [authError])

  useEffect(() => {
    let isMounted = true

    async function loadPreparedLoginUrl() {
      if (!canUseCognito) {
        return
      }

      try {
        const loginUrl = await prepareCognitoLogin()

        if (isMounted) {
          setPreparedLoginUrl(loginUrl)
        }
      } catch (loginError) {
        if (isMounted) {
          setError(loginError.message)
        }
      }
    }

    loadPreparedLoginUrl()

    return () => {
      isMounted = false
    }
  }, [canUseCognito])

  return (
    <main className="login-page">
      <div className="login-grid-bg" aria-hidden="true" />
      <div className="login-orbit login-orbit-one" aria-hidden="true" />
      <div className="login-orbit login-orbit-two" aria-hidden="true" />

      <div className="login-landing">
        <section className="login-hero" aria-label="Vertex-IntervAI sign in">
          <div className="login-brand">
            <div className="login-mark"><Icon name="brain" /></div>
            <div>
              <strong>Vertex-IntervAI</strong>
              <span>Talent Graph AI</span>
            </div>
          </div>

          <div className="login-preference-row">
            <PreferenceControls
              colorTheme={colorTheme}
              language={activeLanguage}
              onLanguageChange={onLanguageChange}
              onThemeChange={onThemeChange}
            />
          </div>

          <div className="login-copy">
            <p className="login-eyebrow">{copy.eyebrow}</p>
            <h1>Vertex-IntervAI</h1>
            <p>{copy.heroText}</p>
          </div>

          <div className="login-actions">
            {error ? <p className="login-error">{error}</p> : null}
            {!canUseCognito ? (
              <p className="login-error">{copy.notConfigured}</p>
            ) : null}
            <div className="login-action-row">
              <a
                className={`login-submit ${!preparedLoginUrl || isRedirecting ? 'disabled' : ''}`}
                href={preparedLoginUrl || undefined}
                onClick={(event) => {
                  if (!preparedLoginUrl || isRedirecting) {
                    event.preventDefault()
                    return
                  }

                  setIsRedirecting(true)
                }}
              >
                <Icon name="login" />
                {isRedirecting
                  ? copy.opening
                  : preparedLoginUrl
                    ? copy.signIn
                    : copy.preparing}
              </a>
              <a className="login-scroll-link" href="#project-overview">
                <Icon name="arrowDown" />
                {copy.viewWorkflow}
              </a>
            </div>
          </div>
        </section>

        <section className="login-visual" aria-hidden="true">
          <div className="login-core">
            <img src={heroStack} alt="" />
            <div className="core-pulse" />
          </div>

          <div className="signal-panel signal-panel-top">
            <span>{copy.cvLabel}</span>
            <strong>84</strong>
          </div>
          <div className="signal-panel signal-panel-bottom">
            <span>{copy.aiMatch}</span>
            <strong>92%</strong>
          </div>

          {floatingNodes.map((node) => (
            <div className={`floating-node ${node.style}`} key={node.name}>
              <Icon name={node.name} />
              <span>{copy.nodeLabels[node.name]}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="project-section project-intro-section" id="project-overview">
        <div className="project-section-header">
          <p className="login-eyebrow">{copy.overviewEyebrow}</p>
          <h2>{copy.overviewTitle}</h2>
          <p>{copy.overviewText}</p>
        </div>

        <div className="project-overview-grid">
          <div className="project-media-frame">
            <img src={neonBackground} alt="Talent Graph AI network interface" />
            <div className="project-media-overlay">
              <img src={neonLogo} alt="Vertex-IntervAI neon logo" />
              <span>{copy.secure}</span>
            </div>
          </div>

          <div className="project-highlight-grid">
            {copy.projectHighlights.map((item) => (
              <article className="project-highlight-card" key={item.label}>
                <strong>{item.value}</strong>
                <h3>{item.label}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="project-section workflow-section" aria-labelledby="workflow-title">
        <div className="project-section-header workflow-header">
          <p className="login-eyebrow">{copy.workflowEyebrow}</p>
          <h2 id="workflow-title">{copy.workflowTitle}</h2>
          <p>{copy.workflowText}</p>
        </div>

        <div className="workflow-rail">
          {copy.workflowSteps.map((item) => (
            <article className="workflow-card" key={item.step}>
              <span className="workflow-number">{item.step}</span>
              <div className="workflow-icon"><Icon name={item.icon} /></div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="project-section result-section" aria-label="Interview result preview">
        <div className="result-copy">
          <p className="login-eyebrow">{copy.finalEyebrow}</p>
          <h2>{copy.finalTitle}</h2>
          <p>{copy.resultText}</p>
        </div>

        <div className="result-preview-panel">
          <div className="result-score-card">
            <span>{copy.overallScore}</span>
            <strong>86<small>/100</small></strong>
            <em>{copy.ready}</em>
          </div>
          <div className="result-bars" aria-hidden="true">
            <span style={{ '--bar-width': '92%' }} />
            <span style={{ '--bar-width': '78%' }} />
            <span style={{ '--bar-width': '86%' }} />
          </div>
          <div className="result-mini-flow">
            <span><Icon name="file" /> CV</span>
            <span><Icon name="brain" /> AI</span>
            <span><Icon name="mic" /> {appCopy.nav.interview}</span>
            <span><Icon name="chart" /> {appCopy.nav.result}</span>
          </div>
        </div>
      </section>
    </main>
  )
}

function Icon({ name }) {
  const paths = {
    brain: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 5 2.2M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-5 2.2M12 5v14M8 10h3M13 10h3M8 15h3M13 15h3" />,
    file: <path d="M7 3h7l4 4v14H7zM14 3v5h5M9 13h6M9 17h4" />,
    mic: <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />,
    graph: <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16V7" />,
    shield: <path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6zM9 12l2 2 4-4" />,
    database: <path d="M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />,
    login: <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />,
    upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
    sparkles: <path d="M12 3l1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z" />,
    message: <path d="M5 5h14v10H8l-4 4V5zM8 9h8M8 12h5" />,
    chart: <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16V7" />,
    arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  }

  return (
    <svg className="login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
