export const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
]

const languageConfigs = {
  en: {
    language: 'en',
    label: 'English',
    interviewLanguage: 'en-US',
    speechRecognitionLanguage: 'en-US',
    speechSynthesisLanguage: 'en-US',
    transcribeLanguageCode: 'en-US',
    pollyVoiceId: 'Joanna',
    pollyEngine: 'standard',
    usePolly: true,
  },
  vi: {
    language: 'vi',
    label: 'Tiếng Việt',
    interviewLanguage: 'vi-VN',
    speechRecognitionLanguage: 'vi-VN',
    speechSynthesisLanguage: 'vi-VN',
    speechSynthesisRate: 0.9,
    speechVoiceNames: [
      'Microsoft Nam Minh Online',
      'Microsoft Nam Minh',
      'Nam Minh',
      'Microsoft Hoai My Online',
      'Microsoft Hoai My',
      'Microsoft HoaiMy Online',
      'Microsoft HoaiMy',
      'Microsoft NamMinh Online',
      'Microsoft NamMinh',
      'Hoai My',
      'HoaiMy',
      'Microsoft An',
      'Microsoft Linh',
      'Microsoft Hai',
      'Google Tieng Viet',
      'Google Vietnamese',
      'Vietnamese',
    ],
    transcribeLanguageCode: 'vi-VN',
    pollyVoiceId: 'Browser vi-VN',
    pollyEngine: 'standard',
    usePolly: false,
  },
}

export function normalizeLanguage(value) {
  return value === 'vi' || value === 'vi-VN' ? 'vi' : 'en'
}

export function getLanguageConfig(value) {
  return languageConfigs[normalizeLanguage(value)]
}

export function languageFromInterviewLanguage(value) {
  return String(value || '').toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

export function syncSettingsLanguage(settings) {
  const config = getLanguageConfig(settings?.language || settings?.interviewLanguage)

  return {
    ...settings,
    language: config.language,
    interviewLanguage: config.interviewLanguage,
    transcribeLanguageCode: config.transcribeLanguageCode,
    pollyVoice: config.pollyVoiceId,
  }
}
