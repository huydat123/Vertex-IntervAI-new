import { useMemo, useState } from 'react'
import PreferenceControls from '../../components/PreferenceControls.jsx'
import {
  defaultSettings,
  loadSettings,
  resetSettings,
  saveSettings,
} from '../../services/settingsStorage.js'
import {
  getLanguageConfig,
  languageOptions,
  syncSettingsLanguage,
} from '../../services/language.js'
import { getAppCopy } from '../../services/i18n.js'
import '../Dashboard/Dashboard.css'
import './Settings.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'upload-cv', label: 'Upload CV', icon: 'file' },
  { id: 'interview', label: 'AI Interview', icon: 'mic' },
  { id: 'result', label: 'Result', icon: 'chart' },
  { id: 'history', label: 'History', icon: 'history' },
]

const fallbackUser = {
  userId: 'user_demo_001',
  fullName: 'Nguyen Huy Dat',
  initials: 'HD',
  role: 'user',
}

const settingsCopy = {
  en: {
    saved: 'Saved locally',
    unsaved: 'Unsaved changes',
    restored: 'Defaults restored',
    cleared: 'Local data cleared',
    clearConfirm: 'Clear local CV, interview, profile, and settings data from this browser?',
    settings: 'Settings',
    title: 'Workspace Preferences',
    back: 'Back to dashboard',
    heroEyebrow: 'Control Center',
    heroTitle: 'Configure your interview workspace',
    heroText: 'Keep only the core defaults for language, color theme, and app notifications.',
    readiness: 'Readiness',
    ready: 'Ready for practice',
    demo: 'Good for demo',
    needs: 'Needs setup',
    appTitle: 'App Preferences',
    appDescription: 'Display language and color theme for the workspace.',
    interfaceLanguage: 'Interface language',
    colorTheme: 'Color theme',
    currentColor: 'Light mode',
    blackMode: 'Black mode',
    notifications: 'Notifications',
    notificationsDescription: 'Status prompts shown inside the app.',
    cvAnalysisComplete: 'CV analysis complete',
    interviewCompleted: 'Interview completed',
    setup: 'Current Setup',
    setupDescription: 'Saved workspace defaults.',
    language: 'Language',
    theme: 'Theme',
    dataControls: 'Data Controls',
    dataDescription: 'Local browser data for the demo workflow.',
    save: 'Save Settings',
    restore: 'Restore Defaults',
    clear: 'Clear Local Data',
  },
  vi: {
    saved: 'Đã lưu cục bộ',
    unsaved: 'Có thay đổi chưa lưu',
    restored: 'Đã khôi phục mặc định',
    cleared: 'Đã xóa dữ liệu cục bộ',
    clearConfirm: 'Xóa dữ liệu CV, phỏng vấn, hồ sơ và cài đặt trong trình duyệt này?',
    settings: 'Cài đặt',
    title: 'Tùy chỉnh không gian làm việc',
    back: 'Quay lại dashboard',
    heroEyebrow: 'Trung tâm điều khiển',
    heroTitle: 'Cấu hình không gian phỏng vấn',
    heroText: 'Thiết lập ngôn ngữ, màu giao diện và thông báo trong ứng dụng.',
    readiness: 'Sẵn sàng',
    ready: 'Sẵn sàng luyện tập',
    demo: 'Phù hợp demo',
    needs: 'Cần cấu hình thêm',
    appTitle: 'Tùy chỉnh ứng dụng',
    appDescription: 'Ngôn ngữ hiển thị và màu giao diện.',
    interfaceLanguage: 'Ngôn ngữ giao diện',
    colorTheme: 'Màu giao diện',
    currentColor: 'Chế độ sáng',
    blackMode: 'Chế độ đen',
    notifications: 'Thông báo',
    notificationsDescription: 'Thông báo trạng thái trong ứng dụng.',
    cvAnalysisComplete: 'Phân tích CV hoàn tất',
    interviewCompleted: 'Phỏng vấn hoàn tất',
    setup: 'Thiết lập hiện tại',
    setupDescription: 'Cấu hình đã lưu.',
    language: 'Ngôn ngữ',
    theme: 'Giao diện',
    dataControls: 'Dữ liệu cục bộ',
    dataDescription: 'Dữ liệu demo lưu trong trình duyệt.',
    save: 'Lưu cài đặt',
    restore: 'Khôi phục mặc định',
    clear: 'Xóa dữ liệu cục bộ',
  },
}

export default function Settings({
  currentUser = fallbackUser,
  language = 'en',
  colorTheme = 'black',
  onNavigate = () => {},
  onLogout = () => {},
  onThemeChange = () => {},
  onLanguageChange = () => {},
}) {
  const [settings, setSettings] = useState(() => loadSettings())
  const currentLanguage = settings.language === 'vi' ? 'vi' : 'en'
  const appCopy = getAppCopy(currentLanguage || language)
  const copy = settingsCopy[currentLanguage]
  const [saveState, setSaveState] = useState(copy.saved)

  const readiness = useMemo(() => {
    const checks = [
      Boolean(settings.language),
      Boolean(settings.colorTheme),
      settings.notifyAnalysis,
      settings.notifyInterview,
    ]
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100)

    if (score >= 80) return { label: copy.ready, score }
    if (score >= 60) return { label: copy.demo, score }
    return { label: copy.needs, score }
  }, [settings, copy])

  function updateSetting(key, value) {
    let syncedLanguage = ''
    let nextLanguage = currentLanguage

    setSettings((current) => {
      let nextSettings = { ...current, [key]: value }

      if (key === 'language') {
        nextSettings = syncSettingsLanguage(nextSettings)
        syncedLanguage = nextSettings.language
        nextLanguage = nextSettings.language
      }

      return nextSettings
    })
    setSaveState(settingsCopy[nextLanguage].unsaved)

    if (key === 'colorTheme') {
      onThemeChange(value)
    }

    if (syncedLanguage) {
      onLanguageChange(syncedLanguage)
    }
  }

  function handleSave() {
    const savedSettings = saveSettings(settings)
    setSettings(savedSettings)
    onThemeChange(savedSettings.colorTheme)
    onLanguageChange(savedSettings.language)
    setSaveState(settingsCopy[savedSettings.language === 'vi' ? 'vi' : 'en'].saved)
  }

  function handleReset() {
    const nextSettings = resetSettings()
    setSettings(nextSettings)
    onThemeChange(nextSettings.colorTheme)
    onLanguageChange(nextSettings.language)
    setSaveState(settingsCopy[nextSettings.language === 'vi' ? 'vi' : 'en'].restored)
  }

  function handleClearLocalData() {
    const didConfirm = window.confirm(copy.clearConfirm)

    if (!didConfirm) {
      return
    }

    clearTalentGraphLocalData()
    const nextSettings = saveSettings(defaultSettings)
    setSettings(nextSettings)
    onThemeChange(nextSettings.colorTheme)
    onLanguageChange(nextSettings.language)
    setSaveState(settingsCopy[nextSettings.language === 'vi' ? 'vi' : 'en'].cleared)
  }

  return (
    <div className="dashboard-page settings-page">
      <div className="dashboard-frame">
        <SettingsSidebar appCopy={appCopy} currentPage="settings" onNavigate={onNavigate} onLogout={onLogout} />

        <main className="dashboard-main">
          <header className="topbar">
            <div className="topbar-title">
              <button
                className="icon-button"
                type="button"
                aria-label="Back to dashboard"
                title={copy.back}
                onClick={() => onNavigate('dashboard')}
              >
                <Icon name="arrowLeft" />
              </button>
              <div>
                <p>{copy.settings}</p>
                <h2>{copy.title}</h2>
              </div>
            </div>

            <div className="topbar-actions">
              <PreferenceControls
                colorTheme={settings.colorTheme || colorTheme}
                language={settings.language || language}
                onLanguageChange={(value) => updateSetting('language', value)}
                onThemeChange={(value) => updateSetting('colorTheme', value)}
              />
              <div className="user-chip" aria-label={appCopy.common.currentUser}>
                <span>{currentUser.fullName}</span>
                <small>{currentUser.role}</small>
                <div className="avatar">{currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : currentUser.initials}</div>
              </div>
            </div>
          </header>

          <div className="dashboard-content settings-content">
            <section className="settings-hero panel">
              <div>
                <p className="eyebrow">{copy.heroEyebrow}</p>
                <h1>{copy.heroTitle}</h1>
                <p>{copy.heroText}</p>
              </div>
              <div className="settings-hero-card">
                <span>{copy.readiness}</span>
                <strong>{readiness.score}<small>/100</small></strong>
                <p>{readiness.label}</p>
              </div>
            </section>

            <section className="settings-grid compact-settings-grid">
              <div className="settings-main-column">
                <section className="panel settings-panel">
                  <PanelHeader title={copy.appTitle} description={copy.appDescription} />
                  <div className="settings-form-grid">
                    <SelectField
                      label={copy.interfaceLanguage}
                      icon="language"
                      value={settings.language}
                      onChange={(value) => updateSetting('language', value)}
                      options={languageOptions}
                    />
                    <SelectField
                      label={copy.colorTheme}
                      icon="theme"
                      value={settings.colorTheme}
                      onChange={(value) => updateSetting('colorTheme', value)}
                      options={[
                        { value: 'current', label: copy.currentColor },
                        { value: 'black', label: copy.blackMode },
                      ]}
                    />
                  </div>
                </section>

              </div>

              <aside className="settings-side-column">
                <section className="panel settings-panel">
                  <PanelHeader title={copy.notifications} description={copy.notificationsDescription} />
                  <div className="settings-toggle-list">
                    <ToggleField
                      label={copy.cvAnalysisComplete}
                      checked={settings.notifyAnalysis}
                      onChange={(value) => updateSetting('notifyAnalysis', value)}
                    />
                    <ToggleField
                      label={copy.interviewCompleted}
                      checked={settings.notifyInterview}
                      onChange={(value) => updateSetting('notifyInterview', value)}
                    />
                  </div>
                </section>

                <section className="panel settings-panel settings-summary-panel">
                  <PanelHeader title={copy.setup} description={copy.setupDescription} />
                  <div className="settings-summary-list">
                    <SummaryItem label={copy.language} value={getLanguageConfig(settings.language).label} />
                    <SummaryItem label={copy.theme} value={settings.colorTheme === 'black' ? copy.blackMode : copy.currentColor} />
                  </div>
                </section>

                <section className="panel settings-panel">
                  <PanelHeader title={copy.dataControls} description={copy.dataDescription} />
                  <div className="settings-action-list">
                    <button className="primary-settings-action" type="button" onClick={handleSave}>
                      <Icon name="save" />
                      {copy.save}
                    </button>
                    <button className="secondary-settings-action" type="button" onClick={handleReset}>
                      <Icon name="refresh" />
                      {copy.restore}
                    </button>
                    <button className="danger-settings-action" type="button" onClick={handleClearLocalData}>
                      <Icon name="trash" />
                      {copy.clear}
                    </button>
                  </div>
                  <p className="settings-save-state">{saveState}</p>
                </section>
              </aside>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

function clearTalentGraphLocalData() {
  const keys = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)

    if (key?.startsWith('talentGraph.') && key !== 'talentGraph.authUser') {
      keys.push(key)
    }
  }

  keys.forEach((key) => window.localStorage.removeItem(key))
}

function SettingsSidebar({ appCopy, currentPage, onNavigate, onLogout }) {
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
        <button className="nav-item active" type="button" onClick={() => onNavigate('settings')}>
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

function PanelHeader({ title, description }) {
  return (
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}

function SelectField({ label, icon, value, options, onChange }) {
  return (
    <label className="settings-field">
      <span className="settings-field-icon"><Icon name={icon} /></span>
      <div>
        <strong>{label}</strong>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  )
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="settings-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
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
    chart: <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8" />,
    history: <path d="M4 12a8 8 0 1 0 3-6.25M4 5v5h5M12 8v5l3 2" />,
    user: <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />,
    settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />,
    bell: <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0" />,
    brain: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 5 2.2M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-5 2.2M12 5v14M8 10h3M13 10h3M8 15h3M13 15h3" />,
    language: <path d="M4 5h9M9 3v2M6 5c.6 2.9 2.4 5.1 5 6.5M12 5c-.7 3-2.5 5.2-5.5 6.7M14 21l5-12 5 12M16 17h6" />,
    theme: <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />,
    message: <path d="M4 5h16v11H8l-4 4z" />,
    save: <path d="M5 4h12l2 2v14H5zM8 4v6h8M8 20v-6h8" />,
    refresh: <path d="M20 6v5h-5M4 18v-5h5M18.7 10A7 7 0 0 0 6.1 7.1L4 11M5.3 14a7 7 0 0 0 12.6 2.9L20 13" />,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 4v16" />,
    arrowLeft: <path d="M15 18l-6-6 6-6" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
