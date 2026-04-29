import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function StatCard({ label, value, loading }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        minHeight: '130px',
      }}
      className="rounded-xl px-5 py-6 flex flex-col items-center justify-center gap-2 flex-1"
    >
      {loading ? (
        <div
          style={{ background: 'var(--color-border)' }}
          className="h-10 w-20 rounded animate-pulse"
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
        className="text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
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
      style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}
      className="flex flex-col items-center justify-center px-4 py-16"
    >
      <div className="w-full max-w-3xl flex flex-col items-center gap-10 text-center">

        {/* Branding — logo above wordmark */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/spl-logo.svg"
            alt="Superball Premier League"
            style={{ height: '180px', width: 'auto' }}
          />
          <h1
            style={{ color: 'var(--color-heading)' }}
            className="text-5xl sm:text-6xl font-bold tracking-tight leading-none"
          >
            🏏 SPL Hub
          </h1>
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
          <div className="w-full flex gap-3">
            {statCards.map(({ label, value }) => (
              <StatCard key={label} label={label} value={value} loading={loading} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex justify-center">
          <Link
            to="/players"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
            className="px-8 py-3 rounded-lg font-semibold text-base hover:opacity-90 transition-opacity"
          >
            Browse Players
          </Link>
        </div>

      </div>
    </div>
  )
}
