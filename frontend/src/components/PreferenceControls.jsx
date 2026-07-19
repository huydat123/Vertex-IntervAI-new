import { getAppCopy } from '../services/i18n.js'
import { normalizeLanguage } from '../services/language.js'

export default function PreferenceControls({
  language = 'en',
  colorTheme = 'black',
  onLanguageChange = () => {},
  onThemeChange = () => {},
}) {
  const activeLanguage = normalizeLanguage(language)
  const copy = getAppCopy(activeLanguage).controls
  const nextLanguage = activeLanguage === 'vi' ? 'en' : 'vi'
  const isBlackTheme = colorTheme === 'black'
  const nextTheme = isBlackTheme ? 'current' : 'black'

  return (
    <div className="preference-controls" aria-label="Workspace preferences">
      <button
        className="preference-toggle-button"
        type="button"
        aria-label={copy.languageLabel}
        title={copy.languageTitle}
        onClick={() => onLanguageChange(nextLanguage)}
      >
        <Icon name="language" />
        <span>{copy.languageButton}</span>
      </button>

      <button
        className={`preference-toggle-button ${isBlackTheme ? 'active' : ''}`}
        type="button"
        aria-label={copy.themeLabel}
        title={isBlackTheme ? copy.themeCurrentTitle : copy.themeBlackTitle}
        onClick={() => onThemeChange(nextTheme)}
      >
        <Icon name={isBlackTheme ? 'sun' : 'moon'} />
        <span>{isBlackTheme ? copy.themeToCurrent : copy.themeToBlack}</span>
      </button>
    </div>
  )
}

function Icon({ name }) {
  const paths = {
    language: <path d="M4 5h9M9 3v2M6 5c.6 2.9 2.4 5.1 5 6.5M12 5c-.7 3-2.5 5.2-5.5 6.7M14 21l5-12 5 12M16 17h6" />,
    moon: <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />,
    sun: <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
