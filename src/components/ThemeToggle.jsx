import { useState } from 'react'
import { cycleTheme, getTheme } from '../lib/theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme)

  function handleClick() {
    const next = cycleTheme()
    setTheme(next)
  }

  const isMidnight = theme === 'midnight'

  return (
    <button
      onClick={handleClick}
      title={`Switch to ${isMidnight ? 'Default' : 'Midnight'} theme`}
      style={{
        color: 'var(--color-text)',
        background: isMidnight ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      {isMidnight ? '◑ Midnight' : '○ Default'}
    </button>
  )
}
