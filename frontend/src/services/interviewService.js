import { normalizeLanguage } from './language.js'

const fallbackQuestions = {
  en: [
    'Tell me about one technical project from your CV and your main responsibility in it.',
    'How would you design a React dashboard that consumes data from multiple APIs?',
    'Explain how an API layer, file storage, and a database can work together in a modern application.',
    'Describe a difficult bug you solved and how you approached debugging it.',
  ],
  vi: [
    'Hãy giới thiệu một dự án kỹ thuật trong CV và trách nhiệm chính của bạn trong dự án đó.',
    'Bạn sẽ thiết kế dashboard React lấy dữ liệu từ nhiều API như thế nào?',
    'Hãy giải thích cách API, lưu trữ file và database phối hợp trong một ứng dụng hiện đại.',
    'Hãy mô tả một lỗi khó bạn từng xử lý và cách bạn debug.',
  ],
}

const DEFAULT_QUESTION_COUNT = 5
const MIN_QUESTION_COUNT = 2
const MAX_QUESTION_COUNT = 8

export function createInterviewSession(cvAnalysis, options = {}) {
  const language = normalizeLanguage(options.language)
  const roleProfile = options.roleProfile || null
  const questionCount = normalizeQuestionCount(options.questionCount)
  const skills = getSkills(cvAnalysis, roleProfile)
  const suggestedRole = roleProfile?.label || options.role || cvAnalysis?.suggestedPosition || 'Frontend Developer Intern'
  const questionBank = createQuestionBank({ skills, suggestedRole, cvAnalysis, roleProfile, language })
  const questions = pickQuestionSet(questionBank, questionCount)

  return {
    interviewId: createId(),
    role: suggestedRole,
    focus: roleProfile?.focus || createSessionFocus(skills),
    roleKey: roleProfile?.id || 'cv-role',
    roleCategory: roleProfile?.category || 'cv',
    language,
    skills,
    questions: questions.length ? questions : fallbackQuestions[language],
    questionCount,
    createdAt: new Date().toISOString(),
  }
}

function getSkills(cvAnalysis, roleProfile) {
  const roleSkills = roleProfile?.skills?.filter(Boolean) ?? []
  const cvSkills = cvAnalysis?.skills?.filter(Boolean) ?? []
  const skills = mergeUnique(roleSkills, cvSkills)

  return skills.length ? skills.slice(0, 8) : ['React', 'Python', 'API', 'Database']
}

function createQuestionBank({ skills, suggestedRole, cvAnalysis, roleProfile, language }) {
  const primarySkill = skills[0] ?? 'React'
  const secondSkill = skills[1] ?? 'Python'
  const thirdSkill = skills[2] ?? 'API'
  const project = cvAnalysis?.projects?.[0] ?? 'your most important project'

  if (language === 'vi') {
    return [
      ...createRoleQuestionGroups({ skills, suggestedRole, roleProfile, language }),
      [
        `Bạn đang ứng tuyển vị trí ${suggestedRole}. Hãy giới thiệu bản thân và nêu kỹ năng kỹ thuật mạnh nhất trong CV.`,
        `Hãy giới thiệu ngắn gọn cho vị trí ${suggestedRole} và liên hệ với một dự án trong CV của bạn.`,
        `Dựa trên CV, vì sao bạn phù hợp với vị trí ${suggestedRole}?`,
      ],
      createSkillQuestionGroup(primarySkill, language),
      createSkillQuestionGroup(secondSkill, language),
      [
        `Hãy nói về dự án ${project}. Dự án giải quyết vấn đề gì và bạn đã xây phần nào?`,
        'Chọn một dự án trong CV. Kiến trúc của dự án là gì và vì sao bạn chọn cách đó?',
        'Nếu có thêm thời gian, bạn muốn cải thiện tính năng nào trong dự án CV của mình?',
      ],
      [
        'Bạn sẽ thiết kế dashboard lấy dữ liệu từ nhiều API nhưng vẫn dễ bảo trì như thế nào?',
        'Bạn sẽ xử lý trạng thái loading, lỗi API và dữ liệu rỗng trong dashboard cho người dùng như thế nào?',
        'Bạn sẽ tổ chức component React cho dashboard có upload, profile và interview pages như thế nào?',
      ],
      [
        `Hãy giải thích cách ${thirdSkill}, backend service và database phối hợp trong ứng dụng hiện đại.`,
        'Nếu API trả về Internal Server Error, bạn sẽ kiểm tra log và cấu hình nào trước?',
        'Bạn sẽ thiết kế permission thế nào để backend đọc dữ liệu CV an toàn?',
      ],
      [
        'Hãy kể về một bug khó bạn từng xử lý và cách bạn debug.',
        'Hãy mô tả một lần bạn học nhanh công nghệ mới và áp dụng vào dự án.',
        'Hãy kể về một lần bạn nhận feedback về code. Sau đó bạn đã thay đổi gì?',
      ],
      [
        'Nếu tính năng upload CV chạy local nhưng lỗi production, bạn sẽ điều tra như thế nào?',
        'Bạn sẽ giải thích dự án của mình cho recruiter không chuyên kỹ thuật trong một phút như thế nào?',
        'Phần nào trong project hiện tại thể hiện sự tiến bộ lớn nhất của bạn?',
      ],
    ]
  }

  return [
    ...createRoleQuestionGroups({ skills, suggestedRole, roleProfile, language }),
    [
      `You are applying for ${suggestedRole}. Please introduce yourself and highlight the strongest technical skill from your CV.`,
      `Give me a short self-introduction for the ${suggestedRole} role and connect it to one project in your CV.`,
      `Why do you think you are a good fit for the ${suggestedRole} position based on your CV?`,
    ],
    createSkillQuestionGroup(primarySkill, language),
    createSkillQuestionGroup(secondSkill, language),
    [
      `Tell me about ${project}. What problem did it solve and what part did you build?`,
      `Pick one project from your CV. What was the architecture, and why did you choose that approach?`,
      `Describe one feature in your CV project that you would improve if you had more time.`,
    ],
    [
      `How would you design a dashboard that consumes data from multiple APIs and remains easy to maintain?`,
      `How would you handle loading states, API errors, and empty data in a user-facing dashboard?`,
      `How would you organize React components for a dashboard with upload, profile, and interview pages?`,
    ],
    [
      `Explain how ${thirdSkill}, a backend service, and a database can work together in a modern application.`,
      `If an API returns Internal Server Error, what logs and configuration would you check first?`,
      `How would you design permissions so a backend service can read CV data securely?`,
    ],
    [
      `Tell me about a difficult bug you solved and how you approached debugging it.`,
      `Describe a time you learned a new technology quickly and applied it in a project.`,
      `Tell me about a time you received feedback on your code. What did you change after that?`,
    ],
    [
      `If your CV upload feature works locally but fails in production, how would you investigate it?`,
      `How would you explain your project to a non-technical recruiter in one minute?`,
      `What part of your current project shows your strongest growth as a developer?`,
    ],
  ]
}

function createRoleQuestionGroups({ skills, suggestedRole, roleProfile, language }) {
  if (!roleProfile || roleProfile.id === 'cv-role') {
    return []
  }

  if (language !== 'vi' && Array.isArray(roleProfile.questionGroups) && roleProfile.questionGroups.length) {
    return roleProfile.questionGroups
  }

  const primarySkill = skills[0] ?? 'Python'
  const secondSkill = skills[1] ?? 'Machine Learning'

  if (language === 'vi') {
    return [
      [
        `Với vai trò ${suggestedRole}, bạn sẽ thiết kế một tính năng AI từ lúc xác định vấn đề đến khi release production như thế nào?`,
        `Bạn sẽ xây hệ thống AI nào cho sản phẩm này? Hãy giải thích model, API và luồng dữ liệu.`,
      ],
      [
        `Bạn sẽ đánh giá chất lượng và độ tin cậy của giải pháp ${suggestedRole} dùng ${primarySkill} như thế nào?`,
        'Nếu câu trả lời AI không ổn định, bạn sẽ debug prompt, dữ liệu, model setting và log như thế nào?',
      ],
      [
        `Hãy thiết kế workflow production nhỏ dùng ${primarySkill}, ${secondSkill} và một API. Bạn sẽ monitor những gì?`,
        'Bạn sẽ theo dõi chất lượng, độ trễ và chi phí của một tính năng AI trong production như thế nào?',
      ],
    ]
  }

  return [
    [
      `For a ${suggestedRole} role, describe one AI system you would build and the problem it solves.`,
      `What technical responsibilities would you expect in a ${suggestedRole} role, and which one matches your CV best?`,
    ],
    [
      `How would you evaluate the quality and reliability of a ${suggestedRole} solution built with ${primarySkill}?`,
      `How would you explain model performance, limitations, and tradeoffs to a non-technical stakeholder?`,
    ],
    [
      `Design a small production workflow using ${primarySkill}, ${secondSkill}, and an API. What would you monitor?`,
      `If an AI feature gives inconsistent answers in production, how would you debug data, prompts, model settings, and logs?`,
    ],
  ]
}

function createSkillQuestionGroup(skill, language = 'en') {
  const category = getSkillCategory(skill)

  if (category === 'frontend') {
    if (language === 'vi') {
      return [
        `CV của bạn có nhắc đến ${skill}. Hãy giải thích một page hoặc component bạn đã dùng công nghệ này và trách nhiệm của bạn là gì?`,
        `Bạn sẽ làm một tính năng dùng ${skill} responsive, accessible và dễ bảo trì như thế nào?`,
        `Nếu một page dùng ${skill} bị lỗi trên mobile, bạn sẽ debug và sửa như thế nào?`,
      ]
    }

    return [
      `Your CV mentions ${skill}. Can you explain a page or component where you used it and what your responsibility was?`,
      `How would you make a feature built with ${skill} responsive, accessible, and easy to maintain?`,
      `If a page using ${skill} looks broken on mobile, how would you debug and fix it?`,
    ]
  }

  if (category === 'database') {
    if (language === 'vi') {
      return [
        `CV của bạn có nhắc đến ${skill}. Hãy giải thích một tính năng bạn đã dùng nó và dữ liệu bạn lưu là gì?`,
        `Trước khi deploy một tính năng dùng ${skill}, bạn sẽ kiểm tra những gì?`,
        `Bạn sẽ debug một query chậm hoặc sai liên quan đến ${skill} như thế nào?`,
      ]
    }

    return [
      `Your CV mentions ${skill}. Can you explain a feature where you used it and what data you stored?`,
      `What would you check before deploying a feature that uses ${skill}?`,
      `How would you debug a slow or incorrect query related to ${skill}?`,
    ]
  }

  if (category === 'cloud') {
    if (language === 'vi') {
      return [
        `CV của bạn có nhắc đến ${skill}. Hãy giải thích bạn đã dùng nó trong một dự án như thế nào?`,
        `Nếu một tính năng dùng ${skill} lỗi trên production, bạn sẽ kiểm tra log và cấu hình nào trước?`,
        `Bạn sẽ thiết kế permission và environment variables cho service dùng ${skill} như thế nào?`,
      ]
    }

    return [
      `Your CV mentions ${skill}. Can you explain how you used it in one project?`,
      `If a ${skill} feature fails in production, what logs and configuration would you check first?`,
      `How would you design permissions and environment variables for a service using ${skill}?`,
    ]
  }

  if (language === 'vi') {
    return [
      `CV của bạn có nhắc đến ${skill}. Hãy giải thích một dự án bạn đã dùng nó và trách nhiệm của bạn là gì?`,
      `Bạn sẽ cải thiện độ tin cậy của một API hoặc tính năng xây bằng ${skill} như thế nào?`,
      `Một thử thách kỹ thuật khi làm với ${skill} là gì và bạn đã giải quyết như thế nào?`,
    ]
  }

  return [
    `Your CV mentions ${skill}. Can you explain a project where you used it and what your responsibility was?`,
    `How would you improve the reliability of an API or feature built with ${skill}?`,
    `What is one technical challenge you faced when working with ${skill}, and how did you solve it?`,
  ]
}

function getSkillCategory(skill) {
  const normalizedSkill = String(skill).toLowerCase()

  if (/(html|css|bootstrap|tailwind|sass|react|vue|angular|javascript|typescript|ui|frontend)/.test(normalizedSkill)) {
    return 'frontend'
  }

  if (/(sql|mysql|postgres|postgresql|database|dynamodb|mongodb|redis)/.test(normalizedSkill)) {
    return 'database'
  }

  if (/(aws|s3|lambda|api gateway|bedrock|cloud|serverless|ec2|iam)/.test(normalizedSkill)) {
    return 'cloud'
  }

  return 'backend'
}

function pickQuestionSet(questionGroups, count) {
  const shuffledGroups = shuffle(questionGroups)
  const selectedQuestions = shuffledGroups
    .map((group) => shuffle(group)[0])
    .filter(Boolean)

  if (selectedQuestions.length >= count) {
    return selectedQuestions.slice(0, count)
  }

  const selected = new Set(selectedQuestions)
  const remainingQuestions = shuffle(questionGroups.flat())
    .filter((question) => question && !selected.has(question))

  return [...selectedQuestions, ...remainingQuestions].slice(0, count)
}

function createSessionFocus(skills) {
  return shuffle(skills).slice(0, 3).join(', ')
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

function mergeUnique(...groups) {
  const seen = new Set()
  const merged = []

  groups.flat().forEach((item) => {
    const value = String(item || '').trim()
    const key = value.toLowerCase()

    if (!value || seen.has(key)) {
      return
    }

    seen.add(key)
    merged.push(value)
  })

  return merged
}

function normalizeQuestionCount(value) {
  const number = Number(value || DEFAULT_QUESTION_COUNT)

  if (!Number.isFinite(number)) {
    return DEFAULT_QUESTION_COUNT
  }

  return Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, Math.round(number)))
}

export function createInitialMessages(session, currentUser, language = 'en') {
  const activeLanguage = normalizeLanguage(language || session?.language)
  const candidateName = currentUser?.fullName ?? 'Candidate'

  return [
    {
      id: createId(),
      sender: 'ai',
      text: activeLanguage === 'vi'
        ? `Xin chào ${candidateName}. Tôi sẽ phỏng vấn bạn cho vị trí ${session.role}. ${session.questions[0]}`
        : `Hello ${candidateName}. I will interview you for the ${session.role} position. ${session.questions[0]}`,
      createdAt: new Date().toISOString(),
    },
  ]
}

export function createMockTranscript(questionIndex, language = 'en') {
  const transcripts = normalizeLanguage(language) === 'vi'
    ? [
      'Tôi là sinh viên lập trình tập trung vào React, Python và backend API. Kỹ năng mạnh nhất của tôi là xây dựng giao diện rõ ràng và kết nối dữ liệu ổn định.',
      'Trong dự án Talent Graph, tôi dùng React để xây dashboard, màn hình upload CV và luồng phỏng vấn. Tôi tập trung vào cấu trúc component và trải nghiệm người dùng.',
      'Để API đáng tin cậy hơn, tôi sẽ validate input, xử lý lỗi rõ ràng, ghi log lỗi và thiết kế retry cho service bên ngoài.',
      'Trước khi deploy tính năng mới, tôi sẽ kiểm tra quyền truy cập, environment variables, logs và cách truy vấn database.',
    ]
    : [
      'I am a student developer focusing on React, Python, and backend APIs. My strongest skill is building clear frontend interfaces and connecting them with reliable data flows.',
      'In my Talent Graph project, I used React to build the dashboard, upload CV screen, and interview workflow. I focused on component structure and user experience.',
      'For API reliability, I would validate input, handle errors consistently, log failures, and design retries for external services.',
      'Before deploying new features, I would check access permissions, environment variables, logs, and database access patterns.',
    ]

  return transcripts[questionIndex % transcripts.length]
}

export async function askMockAi({ answer, question, questionIndex, language = 'en' }) {
  const activeLanguage = normalizeLanguage(language)
  await wait(650)

  const evaluation = evaluateAnswer(answer, activeLanguage)
  const fallbackSet = fallbackQuestions[activeLanguage]
  const nextQuestion = questionIndex < 4
    ? fallbackSet[(questionIndex + 1) % fallbackSet.length]
    : activeLanguage === 'vi'
      ? 'Vòng này như vậy là đủ. Hãy tóm tắt điều bạn muốn cải thiện tiếp theo.'
      : 'That is enough for this round. Please summarize what you would improve next.'

  return {
    feedback: createFeedback({ evaluation, question, language: activeLanguage }),
    nextQuestion,
    score: evaluation.score,
    level: evaluation.level,
    shouldAdvance: evaluation.shouldAdvance,
  }
}

export function enhanceInterviewFeedback({
  aiResult,
  question,
  answer,
  currentUser,
  session,
  cvAnalysis,
  language = 'en',
}) {
  const activeLanguage = normalizeLanguage(language || session?.language)
  const apiScore = Number(aiResult.score ?? 0)
  const localEvaluation = evaluateAnswer(answer, activeLanguage)
  const relevanceIssue = evaluateQuestionRelevance({ question, answer })
  const shouldOverrideWeakAnswer = localEvaluation.score < 60 && apiScore > localEvaluation.score
  const shouldOverrideRelevance = relevanceIssue && apiScore > relevanceIssue.score
  const score = shouldOverrideRelevance
    ? relevanceIssue.score
    : shouldOverrideWeakAnswer
      ? localEvaluation.score
      : apiScore
  const shouldAdvance = shouldOverrideRelevance || shouldOverrideWeakAnswer ? false : aiResult.shouldAdvance
  const needsCoaching = score < 85 || shouldAdvance === false
  const coaching = createQuestionCoaching({
    question,
    answer,
    currentUser,
    session,
    cvAnalysis,
    language: activeLanguage,
  })
  const baseFeedback = shouldOverrideRelevance
    ? createRelevanceFeedback({ relevanceIssue, question, score, language: activeLanguage })
    : shouldOverrideWeakAnswer
    ? createFeedback({ evaluation: localEvaluation, question, language: activeLanguage })
    : normalizeFeedback(aiResult.feedback, score)
  const feedbackParts = [baseFeedback || `Score: ${score}/100.`]

  if (coaching.questionNote) {
    feedbackParts.push(activeLanguage === 'vi'
      ? `Trọng tâm câu hỏi: ${coaching.questionNote}`
      : `Question focus: ${coaching.questionNote}`)
  }

  if (needsCoaching) {
    feedbackParts.push(activeLanguage === 'vi'
      ? `Cần cải thiện: ${coaching.improvement}`
      : `What to improve: ${coaching.improvement}`)
    feedbackParts.push(activeLanguage === 'vi'
      ? `Cấu trúc tốt hơn: ${coaching.structure}`
      : `Better structure: ${coaching.structure}`)
    feedbackParts.push(activeLanguage === 'vi'
      ? `Câu trả lời gợi ý: ${coaching.sampleAnswer}`
      : `Suggested answer: ${coaching.sampleAnswer}`)
  } else {
    feedbackParts.push(activeLanguage === 'vi'
      ? `Để mạnh hơn nữa: ${coaching.upgrade}`
      : `To make it even stronger: ${coaching.upgrade}`)
  }

  return {
    ...aiResult,
    score,
    shouldAdvance,
    level: shouldOverrideRelevance
      ? 'off-topic'
      : shouldOverrideWeakAnswer
        ? localEvaluation.level
        : aiResult.level,
    feedback: feedbackParts.filter(Boolean).join('\n\n'),
  }
}

function evaluateAnswer(answer, language = 'en') {
  const activeLanguage = normalizeLanguage(language)
  const normalizedAnswer = normalizeAnswer(answer)
  const words = normalizedAnswer.split(' ').filter(Boolean)
  const wordCount = words.length
  const saysUnknown = [
    /\bi\s*(do not|dont|don't)\s*(know|no)\b/,
    /\bidk\b/,
    /\bno idea\b/,
    /\bnot sure\b/,
    /\bkhong biet\b/,
    /\bkhông biết\b/,
    /\bko biet\b/,
    /\bkhong ro\b/,
  ].some((pattern) => pattern.test(normalizedAnswer))
  const isTooShort = wordCount < 12
  const hasExample = /\b(project|built|created|developed|implemented|used|designed|debugged|improved|connected|deployed|handled|managed|worked on|dự án|du an|xây dựng|xay dung|phát triển|phat trien|triển khai|trien khai|sử dụng|su dung|thiết kế|thiet ke|debug|kết nối|ket noi|cải thiện|cai thien|xử lý|xu ly)\b/.test(normalizedAnswer)
  const hasTechnicalDetail = /\b(react|javascript|python|java|html|css|api|database|sql|dynamodb|lambda|s3|aws|bedrock|frontend|backend|component|state|hook|serverless|authentication)\b/.test(normalizedAnswer)
  const hasResult = /\b(result|improve|reduced|faster|score|user|performance|reliable|error|bug|learned|because|therefore|so that|kết quả|ket qua|cải thiện|cai thien|nhanh hơn|nhanh hon|người dùng|nguoi dung|hiệu năng|hieu nang|ổn định|on dinh|lỗi|loi|học được|hoc duoc|vì vậy|vi vay|\d+)\b/.test(normalizedAnswer)

  if (saysUnknown) {
    return {
      level: 'weak',
      score: 25,
      shouldAdvance: false,
      strengths: [],
      issues: activeLanguage === 'vi'
        ? ['Bạn nói rằng mình chưa biết câu trả lời.', 'Câu trả lời chưa thể hiện dự án, kỹ năng hoặc cách suy nghĩ.']
        : ['You said you do not know the answer.', 'The answer does not show a project, skill, or reasoning.'],
      advice: activeLanguage === 'vi'
        ? 'Hãy nói trung thực điều bạn biết, rồi liên hệ với một dự án hoặc công nghệ bạn từng dùng.'
        : 'Try to say honestly what you know, then connect it to one project or one technology you have used.',
    }
  }

  if (isTooShort) {
    return {
      level: 'incomplete',
      score: 42,
      shouldAdvance: false,
      strengths: [],
      issues: activeLanguage === 'vi'
        ? ['Câu trả lời còn quá ngắn cho một buổi phỏng vấn.', 'Bạn cần thêm ít nhất một ví dụ cụ thể.']
        : ['Your answer is too short for an interview response.', 'It needs at least one concrete example.'],
      advice: activeLanguage === 'vi'
        ? 'Hãy dùng cấu trúc: bạn là ai, một kỹ năng kỹ thuật, một ví dụ dự án và kết quả đạt được.'
        : 'Use this structure: who you are, one technical skill, one project example, and what result you achieved.',
    }
  }

  const strengths = []
  const issues = []
  let score = 58

  if (hasTechnicalDetail) {
    strengths.push(activeLanguage === 'vi'
      ? 'Bạn đã đưa vào các chi tiết kỹ thuật liên quan.'
      : 'You included relevant technical keywords.')
    score += 14
  } else {
    issues.push(activeLanguage === 'vi'
      ? 'Hãy thêm công nghệ, công cụ hoặc khái niệm cụ thể thay vì trả lời chung chung.'
      : 'Add specific technologies, tools, or concepts instead of staying general.')
  }

  if (hasExample) {
    strengths.push(activeLanguage === 'vi'
      ? 'Bạn đã đưa ra ví dụ về công việc thực tế.'
      : 'You gave an example of practical work.')
    score += 14
  } else {
    issues.push(activeLanguage === 'vi'
      ? 'Hãy thêm ví dụ dự án để câu trả lời thuyết phục hơn.'
      : 'Add a project example to make the answer more convincing.')
  }

  if (hasResult) {
    strengths.push(activeLanguage === 'vi'
      ? 'Bạn đã giải thích tác động, lý do hoặc kết quả.'
      : 'You explained impact, reasoning, or a result.')
    score += 10
  } else {
    issues.push(activeLanguage === 'vi'
      ? 'Hãy nhắc đến một kết quả, tradeoff, bug hoặc bài học rút ra.'
      : 'Mention one result, tradeoff, bug, or lesson learned.')
  }

  if (wordCount >= 45) {
    score += 6
  }

  const finalScore = Math.min(94, score)

  return {
    level: finalScore >= 80 ? 'strong' : 'needs-detail',
    score: finalScore,
    shouldAdvance: finalScore >= 60,
    strengths,
    issues,
    advice: activeLanguage === 'vi'
      ? 'Để câu trả lời mạnh hơn, hãy dùng cấu trúc STAR: Situation, Task, Action, Result.'
      : 'For a stronger answer, use the STAR style: Situation, Task, Action, Result.',
  }
}

function createFeedback({ evaluation, question, language = 'en' }) {
  const activeLanguage = normalizeLanguage(language)

  if (evaluation.level === 'weak' || evaluation.level === 'incomplete') {
    if (activeLanguage === 'vi') {
      return [
        `Câu trả lời chưa đủ mạnh cho câu hỏi: "${question}".`,
        `Điểm: ${evaluation.score}/100.`,
        `Vấn đề: ${evaluation.issues.join(' ')}`,
        `Gợi ý: ${evaluation.advice}`,
      ].join(' ')
    }

    return [
      `This answer is not strong enough for the question: "${question}".`,
      `Score: ${evaluation.score}/100.`,
      `Issue: ${evaluation.issues.join(' ')}`,
      `Suggestion: ${evaluation.advice}`,
    ].join(' ')
  }

  const opening = activeLanguage === 'vi'
    ? evaluation.level === 'strong'
      ? 'Câu trả lời tốt.'
      : 'Câu trả lời chấp nhận được nhưng cần thêm chi tiết.'
    : evaluation.level === 'strong'
      ? 'Strong answer.'
      : 'Acceptable answer, but it needs more detail.'
  const strengths = evaluation.strengths.length
    ? `${activeLanguage === 'vi' ? 'Điểm mạnh' : 'Strengths'}: ${evaluation.strengths.join(' ')}`
    : ''
  const improvements = evaluation.issues.length
    ? `${activeLanguage === 'vi' ? 'Cần cải thiện' : 'Improve'}: ${evaluation.issues.join(' ')}`
    : activeLanguage === 'vi'
      ? 'Cần cải thiện: Thêm một kết quả đo được để câu trả lời sắc hơn.'
      : 'Improve: Add one measurable result to make the answer sharper.'

  return [
    activeLanguage === 'vi'
      ? `${opening} Bạn đã trả lời câu hỏi: "${question}".`
      : `${opening} You addressed the question: "${question}".`,
    activeLanguage === 'vi' ? `Điểm: ${evaluation.score}/100.` : `Score: ${evaluation.score}/100.`,
    strengths,
    improvements,
    evaluation.advice,
  ].filter(Boolean).join(' ')
}

function evaluateQuestionRelevance({ question, answer }) {
  const normalizedQuestion = normalizeAnswer(question)
  const normalizedAnswer = normalizeAnswer(answer)
  const wordCount = normalizedAnswer.split(' ').filter(Boolean).length

  if (isCopiedAiFeedback(normalizedAnswer)) {
    return {
      score: 28,
      reason: 'Your answer looks like copied AI feedback, not your own answer to the current interview question.',
    }
  }

  if (wordCount < 12) {
    return null
  }

  if (isProjectQuestion(normalizedQuestion)) {
    const project = extractProjectName(question)
    const mentionsProject = project
      ? normalizedAnswer.includes(normalizeAnswer(project))
      : false
    const hasProjectContext = includesAny(normalizedAnswer, [
      'project',
      'website',
      'application',
      'app',
      'system',
      'page',
      'feature',
    ])
    const hasResponsibility = includesAny(normalizedAnswer, [
      'my responsibility',
      'i built',
      'i created',
      'i developed',
      'i implemented',
      'i worked',
      'i designed',
      'i used',
      'i connected',
      'i tested',
      'i improved',
      'i handled',
    ])

    if (!mentionsProject && (!hasProjectContext || !hasResponsibility)) {
      return {
        score: 38,
        reason: 'Your answer is not focused on the project question. It should explain the project, your responsibility, what you built, and the result.',
      }
    }
  }

  if (normalizedQuestion.includes('reliability') || normalizedQuestion.includes('responsive')) {
    const hasReliabilityTopic = includesAny(normalizedAnswer, [
      'responsive',
      'reliability',
      'reliable',
      'accessibility',
      'browser',
      'loading',
      'error',
      'empty',
      'state',
      'validation',
      'test',
      'layout',
      'component',
    ])

    if (!hasReliabilityTopic) {
      return {
        score: 42,
        reason: 'Your answer does not address reliability, responsiveness, user experience, testing, or error handling.',
      }
    }
  }

  if (normalizedQuestion.includes('debug') || normalizedQuestion.includes('bug')) {
    const hasDebugTopic = includesAny(normalizedAnswer, [
      'reproduce',
      'log',
      'console',
      'debug',
      'root cause',
      'fix',
      'test',
      'verify',
      'error',
    ])

    if (!hasDebugTopic) {
      return {
        score: 42,
        reason: 'Your answer does not describe a debugging process or how you found and verified the fix.',
      }
    }
  }

  const skill = extractSkill(question)

  if (skill) {
    const normalizedSkill = normalizeAnswer(skill)
    const mentionsSkill = normalizedAnswer.includes(normalizedSkill)
    const hasWorkExample = includesAny(normalizedAnswer, [
      'project',
      'feature',
      'built',
      'developed',
      'implemented',
      'used',
      'designed',
      'connected',
      'tested',
      'improved',
    ])

    if (!mentionsSkill && !hasWorkExample) {
      return {
        score: 44,
        reason: `Your answer does not connect back to ${skill} or to a concrete project example.`,
      }
    }
  }

  return null
}

function createRelevanceFeedback({ relevanceIssue, question, score, language = 'en' }) {
  if (normalizeLanguage(language) === 'vi') {
    return [
      `Câu trả lời chưa tập trung đúng vào câu hỏi: "${question}".`,
      `Điểm: ${score}/100.`,
      `Vấn đề: ${relevanceIssue.reason}`,
      'Hãy trả lời trực tiếp câu hỏi hiện tại thay vì dùng lại feedback của câu trước.',
    ].join(' ')
  }

  return [
    `This answer is not focused enough for the question: "${question}".`,
    `Score: ${score}/100.`,
    `Issue: ${relevanceIssue.reason}`,
    'Please answer the current question directly instead of reusing feedback from the previous answer.',
  ].join(' ')
}

function isCopiedAiFeedback(normalizedAnswer) {
  return [
    /\bto make it even stronger\b/,
    /\bwhat to improve\b/,
    /\bbetter structure\b/,
    /\bsuggested answer\b/,
    /\bnext question\b/,
    /\banswer reviewed for question\b/,
    /\bmention one hard part\b/,
    /\bscore\s+\d+\s+100\b/,
  ].some((pattern) => pattern.test(normalizedAnswer))
}

function includesAny(value, terms) {
  return terms.some((term) => value.includes(term))
}

function createQuestionCoaching({ question, answer, currentUser, session, cvAnalysis, language = 'en' }) {
  const activeLanguage = normalizeLanguage(language)
  const normalizedQuestion = question.toLowerCase()
  const skill = extractSkill(question) || cvAnalysis?.skills?.[0] || 'Java and Spring Boot'
  const project = extractProjectName(question) || cvAnalysis?.projects?.[0] || 'Talent Graph AI'
  const role = session?.role || cvAnalysis?.suggestedPosition || 'Software Developer Intern'
  const candidateName = currentUser?.fullName || 'Nguyen Huy Dat'
  const frontendSkill = getSkillCategory(skill) === 'frontend'
  const veryShortAnswer = normalizeAnswer(answer).split(' ').filter(Boolean).length < 12

  if (activeLanguage === 'vi') {
    if (isIntroQuestion(normalizedQuestion)) {
      return {
        improvement: 'Hãy giới thiệu bản thân, nêu một kỹ năng chính, liên hệ với một dự án và kết thúc bằng lý do bạn muốn vị trí này.',
        structure: 'Tên + vị trí mục tiêu + kỹ năng mạnh nhất + bằng chứng từ dự án + thái độ học hỏi.',
        sampleAnswer: `Em là ${candidateName}, đang ứng tuyển vị trí ${role}. Kỹ năng mạnh nhất của em là ${skill}. Trong dự án ${project}, em dùng ${skill} để xây dựng tính năng thực tế, kết nối với backend service và xử lý các vấn đề triển khai. Em muốn vị trí này để tiếp tục phát triển qua dự án thật và đóng góp cho đội ngũ.`,
        upgrade: 'Thêm một kết quả đo được, ví dụ số màn hình, API hoặc tính năng bạn đã xây.',
      }
    }

    if (isProjectQuestion(normalizedQuestion)) {
      return {
        improvement: 'Đừng chỉ nói dự án đơn giản. Hãy giải thích vấn đề, trách nhiệm của bạn, công nghệ đã dùng và kết quả.',
        structure: 'Vấn đề + vai trò của bạn + hành động kỹ thuật + kết quả hoặc bài học.',
        sampleAnswer: `Trong dự án ${project}, mục tiêu là tạo một ứng dụng thực tế giải quyết nhu cầu người dùng. Trách nhiệm của em là xây dựng và cải thiện tính năng bằng ${skill}. Em làm UI, kết nối backend API, xử lý thao tác người dùng và kiểm thử luồng chính. Qua đó em hiểu rõ hơn cách frontend, backend và dữ liệu phối hợp trong một ứng dụng hoàn chỉnh.`,
        upgrade: 'Nêu một phần khó, ví dụ API integration, validation, responsive layout hoặc database design.',
      }
    }

    if (normalizedQuestion.includes('dashboard')) {
      return {
        improvement: 'Hãy giải thích cấu trúc dashboard, cách load dữ liệu API và cách xử lý loading, error, empty state.',
        structure: 'Layout + luồng API + state handling + reusable components + kết quả.',
        sampleAnswer: 'Với dashboard, em sẽ tách UI thành các component như summary card, chart, table và filter. Dữ liệu sẽ được gọi qua service layer. Khi đang tải sẽ có loading state, khi API lỗi sẽ hiển thị thông báo rõ ràng, và khi không có dữ liệu sẽ có empty state dễ hiểu. Cách này giúp dashboard dễ bảo trì và người dùng thao tác mượt hơn.',
        upgrade: 'Nhắc đến một feature dashboard thật trong project như CV score, interview score hoặc profile status.',
      }
    }

    if (normalizedQuestion.includes('reliability') || normalizedQuestion.includes('api') || normalizedQuestion.includes('tin cậy')) {
      if (frontendSkill) {
        return {
          questionNote: `${skill} chủ yếu là công nghệ frontend/UI, nên câu trả lời tốt nên tập trung vào UI ổn định, responsive, accessibility và trạng thái API.`,
          improvement: 'Hãy giải thích cách làm giao diện ổn định và xử lý loading, error, empty state từ API.',
          structure: 'Kiểm tra frontend + trạng thái API + testing + kết quả.',
          sampleAnswer: `Vì ${skill} dùng ở frontend, em sẽ cải thiện độ tin cậy bằng cách kiểm tra responsive layout, browser compatibility, accessibility và tái sử dụng component/style. Nếu page kết nối API, em cũng xử lý loading state, error message, empty data và form validation. Sau đó em test trên nhiều kích thước màn hình để đảm bảo người dùng hoàn thành flow dễ dàng.`,
          upgrade: 'Thêm ví dụ thật như sửa form, table hoặc layout dashboard bị lỗi.',
        }
      }

      return {
        improvement: veryShortAnswer
          ? 'Đừng chỉ trả lời “không biết”. Hãy nói bạn sẽ kiểm tra bước nào trước, kể cả khi chưa chắc hoàn toàn.'
          : 'Thêm hành động cụ thể để tăng độ tin cậy backend thay vì nói chung chung.',
        structure: 'Validate input + error handling + logs + tests + deployment checks.',
        sampleAnswer: `Để cải thiện độ tin cậy của API xây bằng ${skill}, em sẽ validate input, trả lỗi rõ ràng, thêm logging cho failure và viết unit/integration test cho các case quan trọng. Em cũng kiểm tra environment variables, database permissions, timeout và cấu hình routing trước khi deploy. Việc này giúp API fail an toàn và debug production dễ hơn.`,
        upgrade: 'Nhắc một status code, log example hoặc test case cụ thể.',
      }
    }

    if (normalizedQuestion.includes('bug') || normalizedQuestion.includes('debug') || normalizedQuestion.includes('lỗi')) {
      return {
        improvement: 'Hãy mô tả quy trình debug từng bước thay vì chỉ nói đã sửa lỗi.',
        structure: 'Tái hiện lỗi + xem log + tách nguyên nhân + sửa + xác minh.',
        sampleAnswer: 'Khi gặp bug khó, em sẽ tái hiện lỗi và ghi lại các bước gây lỗi. Sau đó em kiểm tra browser console, backend logs, API response và thay đổi code gần nhất. Khi xác định nguyên nhân, em sửa nhỏ và test lại flow liên quan. Ví dụ trong web project, em sẽ kiểm tra form input, API request, database response và UI update trước khi coi bug đã được xử lý.',
        upgrade: 'Dùng một bug thật trong project và nêu rõ root cause.',
      }
    }

    return {
      improvement: 'Hãy làm câu trả lời cụ thể hơn bằng một ví dụ dự án, một chi tiết kỹ thuật và một kết quả.',
      structure: 'Trả lời trực tiếp + ví dụ dự án + chi tiết kỹ thuật + kết quả.',
      sampleAnswer: `Trong một dự án, em dùng ${skill} để xây tính năng liên quan đến ${project}. Trách nhiệm của em là triển khai logic chính, kết nối với các phần khác của ứng dụng và kiểm thử flow người dùng. Kết quả là em hiểu công nghệ tốt hơn và cải thiện chất lượng tính năng cho người dùng.`,
      upgrade: 'Thêm một tradeoff hoặc bài học rút ra để thể hiện tư duy sâu hơn.',
    }
  }

  if (isIntroQuestion(normalizedQuestion)) {
    return {
      improvement: 'Introduce yourself, name one main technical skill, connect it to one project, and finish with why you want the intern role.',
      structure: 'Name + role target + strongest skill + project evidence + learning attitude.',
      sampleAnswer: `My name is ${candidateName}. I am an Information Technology student applying for the ${role} position. My strongest skill is ${skill}. In my ${project} project, I used ${skill} to build practical features, connect the application with backend services, and solve real implementation problems. I want this internship so I can keep improving through real projects and contribute to the team.`,
      upgrade: 'Add one measurable result, such as how many screens, APIs, or features you built.',
    }
  }

  if (isProjectQuestion(normalizedQuestion)) {
    return {
      improvement: 'Do not only say the project was simple. Explain the problem, your responsibility, the technology you used, and the result.',
      structure: 'Problem + your role + technical actions + result or lesson learned.',
      sampleAnswer: `In the ${project} project, the goal was to create a practical application that solves a real user need. My responsibility was to build and improve the feature using ${skill}. I worked on the UI structure, connected it with the backend API, handled user actions, and tested the main flow. This helped me understand how frontend, backend, and data work together in a complete application.`,
      upgrade: 'Mention one hard part, for example API integration, validation, responsive layout, or database design.',
    }
  }

  if (normalizedQuestion.includes('dashboard')) {
    return {
      improvement: 'Explain the dashboard structure, how it loads API data, and how you handle loading, error, and empty states.',
      structure: 'Layout + API data flow + state handling + reusable components + result.',
      sampleAnswer: `For a dashboard, I would separate the UI into reusable components such as summary cards, charts, tables, and filters. I would fetch data from APIs through a service layer, show loading states while data is being loaded, display useful error messages when an API fails, and handle empty data clearly. This makes the dashboard easier to maintain and gives users a smoother experience.`,
      upgrade: 'Mention one dashboard feature from your project, such as CV score, interview score, or profile status.',
    }
  }

  if (normalizedQuestion.includes('reliability') || normalizedQuestion.includes('api')) {
    if (frontendSkill) {
      return {
        questionNote: `${skill} is mainly a frontend/UI technology, so the best answer should focus on UI reliability, responsiveness, accessibility, and API states instead of saying you build the API with ${skill}.`,
        improvement: 'Explain how you make the user interface stable and how you handle API loading, error, and empty states.',
        structure: 'Frontend checks + API states + testing + result.',
        sampleAnswer: `Because ${skill} is used on the frontend, I would improve reliability by checking responsive layout, browser compatibility, accessibility, and reusable styles or components. If the page connects to an API, I would also handle loading states, error messages, empty data, and form validation. Then I would test the feature on different screen sizes to make sure users can complete the flow without confusion.`,
        upgrade: 'Add one real example from your project, such as fixing a broken form, table, or dashboard layout.',
      }
    }

    return {
      improvement: veryShortAnswer
        ? 'Avoid answering with only "no" or "I do not know". Say what you would check first, even if you are not fully sure.'
        : 'Add concrete backend reliability actions instead of staying general.',
      structure: 'Input validation + error handling + logs + tests + deployment checks.',
      sampleAnswer: `To improve the reliability of an API built with ${skill}, I would validate all input data, return clear error messages, add logging for failures, and write unit or integration tests for important cases. I would also check environment variables, database permissions, timeout settings, and routing configuration before deployment. This helps the API fail safely and makes production bugs easier to debug.`,
      upgrade: 'Mention one specific status code, log example, or test case.',
    }
  }

  if (normalizedQuestion.includes('deploy') || normalizedQuestion.includes('sql') || normalizedQuestion.includes('database')) {
    return {
      improvement: 'Explain the checks you perform before deployment, especially data safety and query correctness.',
      structure: 'Schema + query safety + permissions + testing + rollback plan.',
      sampleAnswer: `Before deploying a feature that uses ${skill}, I would check the database schema, required indexes, constraints, and sample data. I would make sure queries are safe from injection, permissions are correct, and errors are handled properly. I would test create, read, update, and delete flows with realistic data, then prepare a rollback plan in case the deployment has a problem.`,
      upgrade: 'Add one example of a query, table, or validation rule from your project.',
    }
  }

  if (normalizedQuestion.includes('bug') || normalizedQuestion.includes('debug')) {
    return {
      improvement: 'Describe your debugging process step by step instead of only saying you fixed it.',
      structure: 'Reproduce the bug + inspect logs + isolate cause + fix + verify.',
      sampleAnswer: `When I face a difficult bug, I first reproduce it and identify the exact steps that cause the problem. Then I check browser console logs, backend logs, API responses, and recent code changes. After isolating the root cause, I make a small fix and test the related flow again. For example, in a web project I would verify the form input, API request, database response, and UI update before considering the bug solved.`,
      upgrade: 'Use a real bug from your project and explain the root cause.',
    }
  }

  return {
    improvement: 'Make the answer more concrete by adding one project example, one technical detail, and one result.',
    structure: 'Direct answer + project example + technical detail + result.',
    sampleAnswer: `In one of my projects, I used ${skill} to build a feature related to ${project}. My responsibility was to implement the main logic, connect it with other parts of the application, and test the user flow. The result was that I understood the technology better and improved the quality of the feature for users.`,
    upgrade: 'Add one tradeoff or lesson learned to show deeper thinking.',
  }
}

function isIntroQuestion(question) {
  return question.includes('introduce yourself')
    || question.includes('self-introduction')
    || question.includes('good fit')
    || question.includes('strongest technical skill')
    || question.includes('giới thiệu')
    || question.includes('gioi thieu')
    || question.includes('phù hợp')
    || question.includes('phu hop')
    || question.includes('kỹ năng')
    || question.includes('ky nang')
}

function isProjectQuestion(question) {
  return question.includes('tell me about')
    || question.includes('project where you used')
    || question.includes('one project')
    || question.includes('what problem did it solve')
    || question.includes('what part did you build')
    || question.includes('dự án')
    || question.includes('du an')
    || question.includes('giải quyết vấn đề')
    || question.includes('giai quyet van de')
    || question.includes('bạn đã xây')
    || question.includes('ban da xay')
}

function extractSkill(question) {
  const patterns = [
    /mentions\s+(.+?)\./i,
    /mentions\s+(.+?)\?/i,
    /with\s+(.+?)\?/i,
    /uses\s+(.+?)\?/i,
    /built with\s+(.+?)\?/i,
    /related to\s+(.+?)\?/i,
  ]

  for (const pattern of patterns) {
    const match = question.match(pattern)

    if (match?.[1]) {
      return cleanExtractedText(match[1])
    }
  }

  return ''
}

function extractProjectName(question) {
  const githubMatch = question.match(/github\.com\/[^/\s]+\/([^.\s/?#]+)/i)

  if (githubMatch?.[1]) {
    return formatProjectName(githubMatch[1])
  }

  const aboutMatch = question.match(/tell me about\s+(.+?)\./i)

  if (aboutMatch?.[1]) {
    return cleanExtractedText(aboutMatch[1])
  }

  return ''
}

function cleanExtractedText(value) {
  return String(value)
    .replace(/^the\s+/i, '')
    .replace(/\s+project$/i, '')
    .replace(/[?.]+$/g, '')
    .trim()
}

function formatProjectName(value) {
  return cleanExtractedText(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeFeedback(feedback, score) {
  if (!feedback) {
    return ''
  }

  const trimmedFeedback = String(feedback).trim()

  if (/(score|điểm|diem)\s*:?\s*\d+\/100/i.test(trimmedFeedback)) {
    return trimmedFeedback
  }

  return `Score: ${score}/100. ${trimmedFeedback}`
}

function normalizeAnswer(answer) {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/gi, ' ')
    .replace(/\s+/g, ' ')
}

export async function speakText(text, language = 'en-US', options = {}) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return { spoken: false, voiceName: '', reason: 'unsupported' }
  }

  const voices = await loadSpeechVoices()
  const preferredVoice = findPreferredVoice(voices, language, options.voiceNames)
  const requestedVoice = findVoiceByURI(voices, options.voiceURI)
  const selectedVoice = options.requireLanguageMatch
    && requestedVoice
    && !voiceMatchesRequestedLanguage(requestedVoice, language)
    ? preferredVoice
    : requestedVoice || preferredVoice

  if (options.requireLanguageMatch && !selectedVoice) {
    return { spoken: false, voiceName: '', reason: 'missing-language-voice' }
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = selectedVoice?.lang || language
  utterance.rate = options.rate || 0.95

  if (selectedVoice) {
    utterance.voice = selectedVoice
  }

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)

  return {
    spoken: true,
    voiceName: selectedVoice?.name || utterance.lang,
    voiceURI: selectedVoice?.voiceURI || '',
  }
}

export async function getBrowserSpeechVoices() {
  if (!('speechSynthesis' in window)) {
    return []
  }

  const voices = await loadSpeechVoices()

  return voices.map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    voiceURI: voice.voiceURI,
    localService: voice.localService,
    default: voice.default,
  }))
}

export async function playOnlineVietnameseSpeech(text) {
  if (!text) {
    return null
  }

  const chunks = splitSpeechText(text)
  let currentAudio = null
  let stopped = false

  const controller = {
    voiceName: 'Online Vietnamese voice',
    stop() {
      stopped = true

      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }
    },
  }

  controller.done = chunks.reduce(
    (chain, chunk) => chain.then(async () => {
      if (stopped) {
        return null
      }

      const urls = createOnlineVietnameseSpeechUrls(chunk)
      let lastError = null

      for (const voiceName of ['vi-VN-NamMinhNeural', 'vi-VN-HoaiMyNeural']) {
        try {
          const edgeSpeechBlob = await createEdgeVietnameseSpeechBlob(chunk, voiceName)
          await playAudioBlob(edgeSpeechBlob, (audio) => {
            currentAudio = audio
          })
          controller.voiceName = voiceName
          return null
        } catch (error) {
          lastError = error
        }
      }

      for (const url of urls) {
        if (stopped) {
          return null
        }

        try {
          await playAudioUrl(url, (audio) => {
            currentAudio = audio
          })
          return null
        } catch (error) {
          lastError = error
        }
      }

      throw lastError || new Error('Online Vietnamese voice could not play this question.')
    }),
    Promise.resolve(),
  )

  return controller
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

function loadSpeechVoices() {
  const voices = window.speechSynthesis.getVoices?.() || []

  if (voices.length) {
    return Promise.resolve(voices)
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.speechSynthesis.onvoiceschanged = null
      resolve(window.speechSynthesis.getVoices?.() || [])
    }, 800)

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout)
      window.speechSynthesis.onvoiceschanged = null
      resolve(window.speechSynthesis.getVoices?.() || [])
    }
  })
}

function findPreferredVoice(voices, language, voiceNames = []) {
  const normalizedLanguage = String(language || '').toLowerCase()
  const languagePrefix = normalizedLanguage.slice(0, 2)
  const normalizedVoiceNames = voiceNames.map((name) => normalizeVoiceName(name))

  return voices.find((voice) => normalizedVoiceNames.some((name) => normalizeVoiceName(voice.name).includes(name)))
    || voices.find((voice) => voice.lang?.toLowerCase() === normalizedLanguage)
    || voices.find((voice) => voice.lang?.toLowerCase().startsWith(languagePrefix))
    || null
}

function findVoiceByURI(voices, voiceURI) {
  if (!voiceURI) {
    return null
  }

  return voices.find((voice) => voice.voiceURI === voiceURI) || null
}

function voiceMatchesRequestedLanguage(voice, language) {
  const normalizedLanguage = String(language || '').toLowerCase()
  const languagePrefix = normalizedLanguage.slice(0, 2)
  const voiceLanguage = String(voice?.lang || '').toLowerCase()

  return voiceLanguage === normalizedLanguage || voiceLanguage.startsWith(languagePrefix)
}

function normalizeVoiceName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function splitSpeechText(text) {
  const maxLength = 180
  const parts = String(text)
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]?/g) || [String(text)]
  const chunks = []

  parts.forEach((part) => {
    const trimmed = part.trim()

    if (!trimmed) {
      return
    }

    if (trimmed.length <= maxLength) {
      chunks.push(trimmed)
      return
    }

    for (let index = 0; index < trimmed.length; index += maxLength) {
      chunks.push(trimmed.slice(index, index + maxLength))
    }
  })

  return chunks
}

function playAudioUrl(url, onAudio) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)
    audio.preload = 'auto'
    audio.referrerPolicy = 'no-referrer'
    audio.onended = resolve
    audio.onerror = () => reject(new Error('Online Vietnamese voice could not play this question.'))
    onAudio(audio)
    audio.play().catch(reject)
  })
}

function playAudioBlob(blob, onAudio) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.preload = 'auto'
    audio.onended = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Microsoft Vietnamese voice could not play this question.'))
    }
    onAudio(audio)
    audio.play().catch((error) => {
      URL.revokeObjectURL(url)
      reject(error)
    })
  })
}

function createEdgeVietnameseSpeechBlob(text, voiceName = 'vi-VN-NamMinhNeural') {
  if (!window.WebSocket) {
    return Promise.reject(new Error('WebSocket is not supported for Microsoft Vietnamese voice.'))
  }

  return new Promise((resolve, reject) => {
    const connectionId = createSpeechId()
    const requestId = createSpeechId()
    const audioChunks = []
    const websocket = new WebSocket(
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}`,
    )
    let isSettled = false

    websocket.binaryType = 'arraybuffer'

    const timeout = window.setTimeout(() => {
      finishWithError(new Error('Microsoft Vietnamese voice timed out.'))
    }, 14000)

    websocket.onopen = () => {
      websocket.send(createEdgeSpeechConfigMessage())
      websocket.send(createEdgeSsmlMessage({ requestId, text, voiceName }))
    }

    websocket.onerror = () => {
      finishWithError(new Error('Microsoft Vietnamese voice connection failed.'))
    }

    websocket.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          finishWithAudio()
        }
        return
      }

      const buffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data
      const audioBytes = extractEdgeAudioBytes(buffer)

      if (audioBytes?.byteLength) {
        audioChunks.push(audioBytes)
      }
    }

    websocket.onclose = () => {
      if (!isSettled && audioChunks.length) {
        finishWithAudio()
      } else if (!isSettled) {
        finishWithError(new Error('Microsoft Vietnamese voice returned no audio.'))
      }
    }

    function finishWithAudio() {
      if (isSettled) {
        return
      }

      isSettled = true
      window.clearTimeout(timeout)
      websocket.close()
      resolve(new Blob(audioChunks, { type: 'audio/mpeg' }))
    }

    function finishWithError(error) {
      if (isSettled) {
        return
      }

      isSettled = true
      window.clearTimeout(timeout)
      websocket.close()
      reject(error)
    }
  })
}

function createEdgeSpeechConfigMessage() {
  return [
    `X-Timestamp:${new Date().toISOString()}`,
    'Content-Type:application/json; charset=utf-8',
    'Path:speech.config',
    '',
    JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: false,
              wordBoundaryEnabled: false,
            },
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          },
        },
      },
    }),
  ].join('\r\n')
}

function createEdgeSsmlMessage({ requestId, text, voiceName }) {
  return [
    `X-RequestId:${requestId}`,
    'Content-Type:application/ssml+xml',
    `X-Timestamp:${new Date().toISOString()}`,
    'Path:ssml',
    '',
    `<speak version="1.0" xml:lang="vi-VN"><voice name="${escapeXml(voiceName)}"><prosody rate="-4%">${escapeXml(text)}</prosody></voice></speak>`,
  ].join('\r\n')
}

function extractEdgeAudioBytes(buffer) {
  const bytes = new Uint8Array(buffer)

  if (bytes.length < 3) {
    return null
  }

  const headerLength = (bytes[0] << 8) + bytes[1]
  const audioStart = headerLength + 2

  if (audioStart < bytes.length) {
    return bytes.slice(audioStart)
  }

  const separatorIndex = findHeaderSeparator(bytes)

  return separatorIndex >= 0 ? bytes.slice(separatorIndex + 4) : null
}

function findHeaderSeparator(bytes) {
  for (let index = 0; index < bytes.length - 3; index += 1) {
    if (bytes[index] === 13 && bytes[index + 1] === 10 && bytes[index + 2] === 13 && bytes[index + 3] === 10) {
      return index
    }
  }

  return -1
}

function createSpeechId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, '')
  }

  return `${Date.now()}${Math.random().toString(16).slice(2)}`.slice(0, 32)
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function createOnlineVietnameseSpeechUrls(text) {
  const sharedParams = {
    ie: 'UTF-8',
    tl: 'vi',
    q: text,
    total: '1',
    idx: '0',
    textlen: String(text.length),
    prev: 'input',
    ttsspeed: '1',
  }

  return [
    createGoogleSpeechUrl('https://translate.google.com/translate_tts', { ...sharedParams, client: 'tw-ob' }),
    createGoogleSpeechUrl('https://translate.google.com.vn/translate_tts', { ...sharedParams, client: 'tw-ob' }),
    createGoogleSpeechUrl('https://translate.googleapis.com/translate_tts', { ...sharedParams, client: 'gtx' }),
  ]
}

function createGoogleSpeechUrl(baseUrl, params) {
  return `${baseUrl}?${new URLSearchParams(params).toString()}`
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `interview-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
