const THEME_KEY = 'spl_theme'

export function getTheme() {
  return localStorage.getItem(THEME_KEY) ?? 'default'
}

export function applyTheme(theme) {
  if (theme === 'midnight') {
    document.documentElement.setAttribute('data-theme', 'midnight')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  localStorage.setItem(THEME_KEY, theme)
}

export function cycleTheme() {
  const current = getTheme()
  const next = current === 'midnight' ? 'default' : 'midnight'
  applyTheme(next)
  return next
}

// Call synchronously before React renders to prevent any flash of wrong theme.
export function initTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'midnight') {
    document.documentElement.setAttribute('data-theme', 'midnight')
  }
  return stored ?? 'default'
}
