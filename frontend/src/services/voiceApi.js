import { authFetch } from './apiClient.js'

const DEFAULT_VOICE_API_BASE_URL =
  'https://j3zljogo3j.execute-api.ap-southeast-1.amazonaws.com/default'

const VOICE_API_BASE_URL = import.meta.env.VITE_VOICE_API_BASE_URL || DEFAULT_VOICE_API_BASE_URL

const POLL_INTERVAL_MS = 2000
const MAX_TRANSCRIBE_POLLS = 45

export async function synthesizeQuestionAudio({
  text,
  userId,
  interviewId,
  questionIndex,
  voiceId,
  engine,
}) {
  const response = await callVoiceApi('/voice/question-audio', {
    text,
    userId,
    interviewId,
    questionIndex,
    voiceId,
    engine,
  })

  if (!response.audioUrl) {
    throw new Error('Question voice did not return an audio URL.')
  }

  return response
}

export async function transcribeAnswerAudio({
  audioBlob,
  userId,
  interviewId,
  questionIndex,
  languageCode,
}) {
  const fileContent = await blobToBase64(audioBlob)
  const startResponse = await callVoiceApi('/voice/transcribe', {
    action: 'start',
    userId,
    interviewId,
    questionIndex,
    contentType: audioBlob.type || 'audio/webm',
    fileContent,
    languageCode,
  })

  if (!startResponse.jobName) {
    throw new Error('Voice transcript did not start correctly.')
  }

  for (let attempt = 0; attempt < MAX_TRANSCRIBE_POLLS; attempt += 1) {
    await wait(POLL_INTERVAL_MS)

    const statusResponse = await callVoiceApi('/voice/transcribe', {
      action: 'status',
      jobName: startResponse.jobName,
    })

    if (statusResponse.status === 'COMPLETED') {
      const transcript = String(statusResponse.transcript || '').trim()

      if (!transcript) {
        throw new Error('Transcript completed but did not return text.')
      }

      return {
        ...statusResponse,
        transcript,
      }
    }

    if (statusResponse.status === 'FAILED') {
      throw new Error(statusResponse.failureReason || 'Transcription job failed.')
    }
  }

  throw new Error('Transcription is still processing. Please try again in a moment.')
}

export function getPreferredRecordingMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) {
    return ''
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]

  return candidates.find((mimeType) => window.MediaRecorder.isTypeSupported(mimeType)) || ''
}

async function callVoiceApi(path, body) {
  let response

  try {
    response = await authFetch(`${VOICE_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot connect to the voice service. Please check the app connection and try again.')
  }

  const data = await parseJsonResponse(response)

  if (!response.ok) {
    const serverMessage = data.message === 'Internal server error' && data.error
      ? data.error
      : data.message || data.error

    throw new Error(serverMessage || `Voice API failed with status ${response.status}`)
  }

  return data
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }

    reader.onerror = () => {
      reject(new Error('Cannot read recorded audio.'))
    }

    reader.readAsDataURL(blob)
  })
}

async function parseJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
