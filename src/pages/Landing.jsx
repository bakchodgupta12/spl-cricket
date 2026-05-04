import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function StatCard({ label, value, loading }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-card-border)',
      }}
      className="themed-card rounded-xl px-3 py-4 sm:px-5 sm:py-6 flex flex-col items-center justify-center gap-1 sm:gap-2 flex-1 min-w-0 min-h-[88px] sm:min-h-[130px]"
    >
      {loading ? (
        <div
          style={{ background: 'var(--color-border)' }}
          className="h-6 sm:h-10 w-12 sm:w-20 rounded animate-pulse"
        />
      ) : (
        <span
          style={{ color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}
          className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-none"
        >
          {value}
        </span>
      )}
      <span
        style={{ color: 'var(--color-text)' }}
        className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
      >
        {label}
      </span>
    </div>
  )
}

export default function Landing() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [matchesRes, inningsRes, playersRes] = await Promise.all([
          supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .not('file_name', 'ilike', '%synthetic%'),
          supabase.from('innings').select('runs, wickets'),
          supabase
            .from('players')
            .select('*', { count: 'exact', head: true }),
        ])

        if (matchesRes.error) throw matchesRes.error
        if (inningsRes.error) throw inningsRes.error
        if (playersRes.error) throw playersRes.error

        const rows = inningsRes.data ?? []
        const totalRuns = rows.reduce((sum, i) => sum + (i.runs ?? 0), 0)
        const totalWickets = rows.reduce((sum, i) => sum + (i.wickets ?? 0), 0)

        setStats({
          matches: matchesRes.count ?? 0,
          runs: totalRuns,
          wickets: totalWickets,
          players: playersRes.count ?? 0,
          seasons: 5,
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  // Seasons first, then Matches, Players, Runs, Wickets
  const statCards = [
    { label: 'Seasons',  value: stats?.seasons?.toLocaleString() },
    { label: 'Matches',  value: stats?.matches?.toLocaleString() },
    { label: 'Players',  value: stats?.players?.toLocaleString() },
    { label: 'Runs',     value: stats?.runs?.toLocaleString() },
    { label: 'Wickets',  value: stats?.wickets?.toLocaleString() },
  ]

  return (
    <div
      style={{ background: 'var(--color-bg)', minHeight: '100dvh', position: 'relative' }}
      className="flex flex-col items-center justify-center px-4 py-12 sm:py-16"
    >
      {/* Auction Mode — small ghost button, admin-style placement */}
      <Link
        to="/auction"
        style={{
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          background: 'transparent',
          letterSpacing: '0.06em',
        }}
        className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md font-medium uppercase text-[10px] sm:text-[11px] hover:opacity-80 transition-opacity"
      >
        Auction Mode
      </Link>

      <div className="w-full max-w-3xl flex flex-col items-center gap-7 sm:gap-10 text-center">

        {/* Branding — logo above wordmark */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/spl-logo.svg"
            alt="Superball Premier League"
            className="h-28 sm:h-40 md:h-44 w-auto"
          />
          <h1
            style={{ color: 'var(--color-heading)' }}
            className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-none"
          >
            🏏 SPL Hub
          </h1>
          <p
            style={{ color: 'var(--color-text)' }}
            className="text-sm sm:text-lg md:text-xl max-w-md px-2"
          >
            Five seasons of Superball Premier League cricket — every run, wicket,
            and catch, in one place.
          </p>
        </div>

        {/* Stat grid */}
        {error ? (
          <p style={{ color: '#f87171' }} className="text-sm">
            Could not load stats: {error}
          </p>
        ) : (
          <div className="w-full flex gap-2 sm:gap-3">
            {statCards.map(({ label, value }) => (
              <StatCard key={label} label={label} value={value} loading={loading} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 w-full sm:w-auto">
          <Link
            to="/spl-s6"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
            className="w-full sm:w-auto px-8 py-3 min-h-[48px] rounded-lg font-semibold text-base hover:opacity-90 transition-opacity flex items-center justify-center"
          >
            SPL Season 6
          </Link>
          <Link
            to="/players"
            style={{ background: 'transparent', color: 'var(--color-heading)', border: '1px solid var(--color-border)' }}
            className="w-full sm:w-auto px-8 py-3 min-h-[48px] rounded-lg font-semibold text-base hover:opacity-80 transition-opacity flex items-center justify-center"
          >
            Browse Players
          </Link>
        </div>

      </div>
    </div>
  )
}
