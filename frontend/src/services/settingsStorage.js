import { syncSettingsLanguage } from './language.js'

const SETTINGS_STORAGE_KEY = 'talentGraph.settings'

export const defaultSettings = {
  language: 'en',
  colorTheme: 'black',
  interviewLanguage: 'en-US',
  questionCount: 5,
  scoringMode: 'balanced',
  apiMode: 'aws-first',
  voiceProvider: 'aws',
  pollyVoice: 'Joanna',
  speechVoiceURI: '',
  transcribeLanguageCode: 'en-US',
  autoSpeakQuestion: false,
  cameraDefault: false,
  saveHistory: true,
  notifyAnalysis: true,
  notifyInterview: true,
  notifyAwsErrors: true,
  dataRetention: 'local-and-aws',
}

export function loadSettings() {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    return syncSettingsLanguage(stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings)
  } catch {
    return syncSettingsLanguage(defaultSettings)
  }
}

export function saveSettings(settings) {
  const nextSettings = syncSettingsLanguage({ ...defaultSettings, ...settings })
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings))
  return nextSettings
}

export function resetSettings() {
  const nextSettings = syncSettingsLanguage(defaultSettings)
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings))
  return nextSettings
}
