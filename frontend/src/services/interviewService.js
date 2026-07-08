const fallbackQuestions = [
  'Tell me about one technical project from your CV and your main responsibility in it.',
  'How would you design a React dashboard that consumes data from multiple APIs?',
  'Explain how AWS Lambda, S3, and DynamoDB can work together in a serverless application.',
  'Describe a difficult bug you solved and how you approached debugging it.',
]

export function createInterviewSession(cvAnalysis) {
  const skills = getSkills(cvAnalysis)
  const suggestedRole = cvAnalysis?.suggestedPosition ?? 'Frontend Developer Intern'
  const questionBank = createQuestionBank({ skills, suggestedRole, cvAnalysis })
  const questions = pickQuestionSet(questionBank, 6)

  return {
    interviewId: createId(),
    role: suggestedRole,
    focus: createSessionFocus(skills),
    questions: questions.length ? questions : fallbackQuestions,
    createdAt: new Date().toISOString(),
  }
}

function getSkills(cvAnalysis) {
  const skills = cvAnalysis?.skills?.filter(Boolean) ?? []

  return skills.length ? skills.slice(0, 8) : ['React', 'Python', 'AWS', 'Database']
}

function createQuestionBank({ skills, suggestedRole, cvAnalysis }) {
  const primarySkill = skills[0] ?? 'React'
  const secondSkill = skills[1] ?? 'Python'
  const thirdSkill = skills[2] ?? 'AWS'
  const project = cvAnalysis?.projects?.[0] ?? 'your most important project'

  return [
    [
      `You are applying for ${suggestedRole}. Please introduce yourself and highlight the strongest technical skill from your CV.`,
      `Give me a short self-introduction for the ${suggestedRole} role and connect it to one project in your CV.`,
      `Why do you think you are a good fit for the ${suggestedRole} position based on your CV?`,
    ],
    createSkillQuestionGroup(primarySkill),
    createSkillQuestionGroup(secondSkill),
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
      `Explain how ${thirdSkill}, API Gateway, and a database can work together in a serverless application.`,
      `If a Lambda API returns Internal Server Error, what logs and configuration would you check first?`,
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

function createSkillQuestionGroup(skill) {
  const category = getSkillCategory(skill)

  if (category === 'frontend') {
    return [
      `Your CV mentions ${skill}. Can you explain a page or component where you used it and what your responsibility was?`,
      `How would you make a feature built with ${skill} responsive, accessible, and easy to maintain?`,
      `If a page using ${skill} looks broken on mobile, how would you debug and fix it?`,
    ]
  }

  if (category === 'database') {
    return [
      `Your CV mentions ${skill}. Can you explain a feature where you used it and what data you stored?`,
      `What would you check before deploying a feature that uses ${skill}?`,
      `How would you debug a slow or incorrect query related to ${skill}?`,
    ]
  }

  if (category === 'cloud') {
    return [
      `Your CV mentions ${skill}. Can you explain how you used it in one project?`,
      `If a ${skill} feature fails in production, what logs and configuration would you check first?`,
      `How would you design permissions and environment variables for a service using ${skill}?`,
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
  const questions = shuffledGroups
    .map((group) => shuffle(group)[0])
    .filter(Boolean)

  return questions.slice(0, count)
}

function createSessionFocus(skills) {
  return shuffle(skills).slice(0, 3).join(', ')
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

export function createInitialMessages(session, currentUser) {
  const candidateName = currentUser?.fullName ?? 'Candidate'

  return [
    {
      id: createId(),
      sender: 'ai',
      text: `Hello ${candidateName}. I will interview you for the ${session.role} position. ${session.questions[0]}`,
      createdAt: new Date().toISOString(),
    },
  ]
}

export function createMockTranscript(questionIndex) {
  const transcripts = [
    'I am a student developer focusing on React, Python, and AWS. My strongest skill is building clear frontend interfaces and connecting them with backend APIs.',
    'In my Talent Graph project, I used React to build the dashboard, upload CV screen, and interview workflow. I focused on component structure and user experience.',
    'For API reliability, I would validate input, handle errors consistently, log failures, and design retries for external services.',
    'Before deploying AWS features, I would check IAM permissions, environment variables, logs, and DynamoDB access patterns.',
  ]

  return transcripts[questionIndex % transcripts.length]
}

export async function askMockAi({ answer, question, questionIndex }) {
  await wait(650)

  const evaluation = evaluateAnswer(answer)
  const nextQuestion = questionIndex < 4
    ? fallbackQuestions[(questionIndex + 1) % fallbackQuestions.length]
    : 'That is enough for this round. Please summarize what you would improve next.'

  return {
    feedback: createFeedback({ evaluation, question }),
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
}) {
  const apiScore = Number(aiResult.score ?? 0)
  const localEvaluation = evaluateAnswer(answer)
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
  })
  const baseFeedback = shouldOverrideRelevance
    ? createRelevanceFeedback({ relevanceIssue, question, score })
    : shouldOverrideWeakAnswer
    ? createFeedback({ evaluation: localEvaluation, question })
    : normalizeFeedback(aiResult.feedback, score)
  const feedbackParts = [baseFeedback || `Score: ${score}/100.`]

  if (coaching.questionNote) {
    feedbackParts.push(`Question focus: ${coaching.questionNote}`)
  }

  if (needsCoaching) {
    feedbackParts.push(`What to improve: ${coaching.improvement}`)
    feedbackParts.push(`Better structure: ${coaching.structure}`)
    feedbackParts.push(`Suggested answer: ${coaching.sampleAnswer}`)
  } else {
    feedbackParts.push(`To make it even stronger: ${coaching.upgrade}`)
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

function evaluateAnswer(answer) {
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
  const hasExample = /\b(project|built|created|developed|implemented|used|designed|debugged|improved|connected|deployed|handled|managed|worked on)\b/.test(normalizedAnswer)
  const hasTechnicalDetail = /\b(react|javascript|python|java|html|css|api|database|sql|dynamodb|lambda|s3|aws|bedrock|frontend|backend|component|state|hook|serverless|authentication)\b/.test(normalizedAnswer)
  const hasResult = /\b(result|improve|reduced|faster|score|user|performance|reliable|error|bug|learned|because|therefore|so that|\d+)\b/.test(normalizedAnswer)

  if (saysUnknown) {
    return {
      level: 'weak',
      score: 25,
      shouldAdvance: false,
      strengths: [],
      issues: ['You said you do not know the answer.', 'The answer does not show a project, skill, or reasoning.'],
      advice: 'Try to say honestly what you know, then connect it to one project or one technology you have used.',
    }
  }

  if (isTooShort) {
    return {
      level: 'incomplete',
      score: 42,
      shouldAdvance: false,
      strengths: [],
      issues: ['Your answer is too short for an interview response.', 'It needs at least one concrete example.'],
      advice: 'Use this structure: who you are, one technical skill, one project example, and what result you achieved.',
    }
  }

  const strengths = []
  const issues = []
  let score = 58

  if (hasTechnicalDetail) {
    strengths.push('You included relevant technical keywords.')
    score += 14
  } else {
    issues.push('Add specific technologies, tools, or concepts instead of staying general.')
  }

  if (hasExample) {
    strengths.push('You gave an example of practical work.')
    score += 14
  } else {
    issues.push('Add a project example to make the answer more convincing.')
  }

  if (hasResult) {
    strengths.push('You explained impact, reasoning, or a result.')
    score += 10
  } else {
    issues.push('Mention one result, tradeoff, bug, or lesson learned.')
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
    advice: 'For a stronger answer, use the STAR style: Situation, Task, Action, Result.',
  }
}

function createFeedback({ evaluation, question }) {
  if (evaluation.level === 'weak' || evaluation.level === 'incomplete') {
    return [
      `This answer is not strong enough for the question: "${question}".`,
      `Score: ${evaluation.score}/100.`,
      `Issue: ${evaluation.issues.join(' ')}`,
      `Suggestion: ${evaluation.advice}`,
    ].join(' ')
  }

  const opening = evaluation.level === 'strong'
    ? 'Strong answer.'
    : 'Acceptable answer, but it needs more detail.'
  const strengths = evaluation.strengths.length
    ? `Strengths: ${evaluation.strengths.join(' ')}`
    : ''
  const improvements = evaluation.issues.length
    ? `Improve: ${evaluation.issues.join(' ')}`
    : 'Improve: Add one measurable result to make the answer sharper.'

  return [
    `${opening} You addressed the question: "${question}".`,
    `Score: ${evaluation.score}/100.`,
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

function createRelevanceFeedback({ relevanceIssue, question, score }) {
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

function createQuestionCoaching({ question, answer, currentUser, session, cvAnalysis }) {
  const normalizedQuestion = question.toLowerCase()
  const skill = extractSkill(question) || cvAnalysis?.skills?.[0] || 'Java and Spring Boot'
  const project = extractProjectName(question) || cvAnalysis?.projects?.[0] || 'Talent Graph AI'
  const role = session?.role || cvAnalysis?.suggestedPosition || 'Software Developer Intern'
  const candidateName = currentUser?.fullName || 'Nguyen Huy Dat'
  const frontendSkill = getSkillCategory(skill) === 'frontend'
  const veryShortAnswer = normalizeAnswer(answer).split(' ').filter(Boolean).length < 12

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
      sampleAnswer: `To improve the reliability of an API built with ${skill}, I would validate all input data, return clear error messages, add logging for failures, and write unit or integration tests for important cases. I would also check environment variables, database permissions, timeout settings, and API Gateway configuration before deployment. This helps the API fail safely and makes production bugs easier to debug.`,
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
}

function isProjectQuestion(question) {
  return question.includes('tell me about')
    || question.includes('project where you used')
    || question.includes('one project')
    || question.includes('what problem did it solve')
    || question.includes('what part did you build')
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

  if (/score\s*\d+\/100/i.test(trimmedFeedback)) {
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

export function speakText(text) {
  if (!('speechSynthesis' in window)) {
    return false
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.95
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
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
