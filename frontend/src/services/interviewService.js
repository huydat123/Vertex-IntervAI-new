const fallbackQuestions = [
  'Tell me about one technical project from your CV and your main responsibility in it.',
  'How would you design a React dashboard that consumes data from multiple APIs?',
  'Explain how AWS Lambda, S3, and DynamoDB can work together in a serverless application.',
  'Describe a difficult bug you solved and how you approached debugging it.',
]

export function createInterviewSession(cvAnalysis) {
  const skills = cvAnalysis?.skills?.slice(0, 4) ?? ['React', 'Python', 'AWS', 'Database']
  const suggestedRole = cvAnalysis?.suggestedPosition ?? 'Frontend Developer Intern'
  const questions = [
    `You are applying for ${suggestedRole}. Please introduce yourself and highlight your strongest technical skill.`,
    `Your CV mentions ${skills[0]}. Can you explain a project where you used it?`,
    `How would you improve the reliability of an API built with ${skills[1] ?? 'Python'}?`,
    `What would you review before deploying a feature that uses ${skills[2] ?? 'AWS'}?`,
    `Tell me about a time you learned a new technology quickly and applied it in a project.`,
  ]

  return {
    interviewId: createId(),
    role: suggestedRole,
    questions: questions.length ? questions : fallbackQuestions,
    createdAt: new Date().toISOString(),
  }
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

  const nextQuestion = questionIndex < 4
    ? fallbackQuestions[(questionIndex + 1) % fallbackQuestions.length]
    : 'That is enough for this round. Please summarize what you would improve next.'

  return {
    feedback:
      `Good answer. You addressed the question about "${question}" and gave a relevant example. Try to add one measurable result or technical tradeoff next time.`,
    nextQuestion,
    score: Math.min(90, 74 + Math.round(answer.length / 18)),
  }
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
