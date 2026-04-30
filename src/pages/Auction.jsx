import { useState } from 'react'
import { Link } from 'react-router-dom'

const PASSCODE = import.meta.env.VITE_AUCTION_PASSCODE ?? 'spl2026'
const SESSION_KEY = 'spl_auction_auth'

const TABS = [
  'Setup',
  'Categories',
  'Live Auction',
  'Team Dashboard',
  'Final Team List',
]

function PasscodeGate({ onSuccess }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (value === PASSCODE) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onSuccess()
    } else {
      setError(true)
    }
  }

  return (
    <div
      style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}
      className="flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-xs flex flex-col gap-5">
        <div className="text-center">
          <h1
            style={{ color: 'var(--color-heading)' }}
            className="text-2xl font-bold tracking-tight"
          >
            Auction Mode
          </h1>
          <p style={{ color: 'var(--color-text)' }} className="text-sm mt-1">
            Enter the passcode to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Passcode"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false) }}
            autoFocus
            style={{
              background: 'var(--color-surface)',
              border: `1px solid ${error ? '#f87171' : 'var(--color-border)'}`,
              color: 'var(--color-heading)',
            }}
            className="px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
          {error && (
            <p style={{ color: '#f87171' }} className="text-xs">
              Incorrect passcode.
            </p>
          )}
          <button
            type="submit"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
            className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Enter
          </button>
        </form>

        <Link
          to="/"
          style={{ color: 'var(--color-text)' }}
          className="text-xs text-center hover:opacity-80 transition-opacity"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  )
}

function AuctionPlaceholder() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 flex flex-col gap-8">
        <Link
          to="/"
          style={{ color: 'var(--color-text)' }}
          className="text-sm hover:opacity-80 transition-opacity self-start"
        >
          ← Home
        </Link>

        <div>
          <h1
            style={{ color: 'var(--color-heading)' }}
            className="text-2xl font-bold tracking-tight"
          >
            Auction app — coming in next chunk
          </h1>
          <p style={{ color: 'var(--color-text)' }} className="text-sm mt-2">
            Season 6 auction interface. Planned tabs:
          </p>
        </div>

        <ol className="flex flex-col gap-2">
          {TABS.map((tab, i) => (
            <li
              key={tab}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg"
            >
              <span
                style={{
                  background: 'var(--color-accent-dim)',
                  color: 'var(--color-accent)',
                  width: 24, height: 24, flexShrink: 0,
                }}
                className="rounded-full flex items-center justify-center text-xs font-bold"
              >
                {i + 1}
              </span>
              <span style={{ color: 'var(--color-heading)' }} className="text-sm font-medium">
                {tab}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default function Auction() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  )

  if (!authed) return <PasscodeGate onSuccess={() => setAuthed(true)} />
  return <AuctionPlaceholder />
}
