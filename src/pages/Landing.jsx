import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function StatCard({ label, value, loading }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
      className="rounded-xl px-6 py-5 flex flex-col items-center gap-1 min-w-0"
    >
      {loading ? (
        <div
          style={{ background: 'var(--color-border)' }}
          className="h-10 w-24 rounded animate-pulse mb-1"
        />
      ) : (
        <span
          style={{ color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}
          className="text-4xl sm:text-5xl font-bold tracking-tight leading-none"
        >
          {value}
        </span>
      )}
      <span
        style={{ color: 'var(--color-text)' }}
        className="text-sm font-medium uppercase tracking-widest mt-1"
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

  const statCards = [
    { label: 'Matches', value: stats?.matches?.toLocaleString() },
    { label: 'Runs scored', value: stats?.runs?.toLocaleString() },
    { label: 'Wickets', value: stats?.wickets?.toLocaleString() },
    { label: 'Players', value: stats?.players?.toLocaleString() },
    { label: 'Seasons', value: stats?.seasons?.toLocaleString() },
  ]

  return (
    <div
      style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}
      className="flex flex-col items-center justify-center px-4 py-16"
    >
      <div className="w-full max-w-3xl flex flex-col items-center gap-10 text-center">

        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/spl-logo.svg"
            alt="Superball Premier League"
            style={{ height: '100px', width: 'auto' }}
            className="mb-1"
          />
          <div className="flex items-center gap-3">
            <span className="text-4xl select-none">🏏</span>
            <h1
              style={{ color: 'var(--color-heading)' }}
              className="text-5xl sm:text-6xl font-bold tracking-tight leading-none"
            >
              SPL Hub
            </h1>
          </div>
          <p
            style={{ color: 'var(--color-text)' }}
            className="text-lg sm:text-xl max-w-md"
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
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statCards.map(({ label, value }) => (
              <StatCard key={label} label={label} value={value} loading={loading} />
            ))}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            to="/players"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
            }}
            className="px-7 py-3 rounded-lg font-semibold text-base hover:opacity-90 transition-opacity"
          >
            Browse Players
          </Link>
          <Link
            to="/seasons"
            style={{
              border: '1px solid var(--color-border)',
              color: 'var(--color-heading)',
            }}
            className="px-7 py-3 rounded-lg font-semibold text-base hover:opacity-80 transition-opacity"
          >
            View Seasons
          </Link>
        </div>

      </div>
    </div>
  )
}
