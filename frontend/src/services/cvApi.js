import { authFetch } from './apiClient.js'

const DEFAULT_UPLOAD_CV_API_URL =
  'https://j3zljogo3j.execute-api.ap-southeast-1.amazonaws.com/default/upload_cv'
const DEFAULT_ANALYZE_CV_API_URL =
  'https://j3zljogo3j.execute-api.ap-southeast-1.amazonaws.com/default/analyze_cv'

const UPLOAD_CV_API_URL = import.meta.env.VITE_UPLOAD_CV_API_URL || DEFAULT_UPLOAD_CV_API_URL
const ANALYZE_CV_API_URL = import.meta.env.VITE_ANALYZE_CV_API_URL || DEFAULT_ANALYZE_CV_API_URL
const DEMO_USER_ID = 'user_demo_001'

export async function uploadCvToAws(file, userId = DEMO_USER_ID) {
  const fileContent = await fileToBase64(file)

  let response

  try {
    response = await authFetch(UPLOAD_CV_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileContent,
      }),
    })
  } catch {
    throw new Error(
      'Cannot connect to the upload service. Please check the app connection and try again.',
    )
  }

  const data = await parseJsonResponse(response)

  if (!response.ok) {
    const serverMessage = data.message === 'Internal server error' && data.error
      ? data.error
      : data.message || data.error

    throw new Error(serverMessage || `Upload CV failed with status ${response.status}`)
  }

  return data.cv || data
}

export async function analyzeCvOnAws(uploadedCv, userId = DEMO_USER_ID) {
  const cvId = uploadedCv?.cvId
  const resolvedUserId = uploadedCv?.userId || userId

  if (!cvId) {
    throw new Error('Cannot analyze CV because cvId is missing from the upload response.')
  }

  let response

  try {
    response = await authFetch(ANALYZE_CV_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: resolvedUserId,
        cvId,
      }),
    })
  } catch {
    throw new Error(
      'Cannot connect to the analysis service. Please check the app connection and try again.',
    )
  }

  const data = await parseJsonResponse(response)

  if (!response.ok) {
    const serverMessage = data.message === 'Internal server error' && data.error
      ? data.error
      : data.message || data.error

    throw new Error(serverMessage || `Analyze CV failed with status ${response.status}`)
  }

  return data.cv || data
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }

    reader.onerror = () => {
      reject(new Error('Cannot read this CV file.'))
    }

    reader.readAsDataURL(file)
  })
}

async function parseJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}
