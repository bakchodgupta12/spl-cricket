import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ballsToOvers, fmtNum, fmtHalf, computePlayerStats } from '../lib/cricketStats'

// ─── sub-components ───────────────────────────────────────────────────────────

function StatRow({ label, value }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <span
        style={{ color: 'var(--color-text)' }}
        className="text-xs uppercase tracking-wider whitespace-nowrap"
      >
        {label}
      </span>
      <span
        style={{ color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}
        className="text-xl font-bold leading-none"
      >
        {value}
      </span>
    </div>
  )
}

function StatBlock({ title, rows, emptyMessage }) {
  return (
    <div
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      className="rounded-xl p-5 flex-1 min-w-0"
    >
      <h3
        style={{ color: 'var(--color-text)' }}
        className="text-xs font-semibold uppercase tracking-widest mb-3"
      >
        {title}
      </h3>
      {emptyMessage
        ? <p style={{ color: 'var(--color-text)' }} className="text-sm italic py-2">{emptyMessage}</p>
        : rows.map(r => <StatRow key={r.label} label={r.label} value={r.value} />)
      }
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }} className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div style={{ background: 'var(--color-border)' }} className="h-4 w-20 rounded animate-pulse mb-8" />
      <div className="flex items-center gap-5 mb-8">
        <div style={{ background: 'var(--color-border)', width: 72, height: 72 }} className="rounded-full animate-pulse flex-shrink-0" />
        <div className="flex flex-col gap-2">
          <div style={{ background: 'var(--color-border)' }} className="h-8 w-48 rounded animate-pulse" />
          <div style={{ background: 'var(--color-border)' }} className="h-4 w-32 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
               className="rounded-xl p-5 flex-1 h-64 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}
         className="flex flex-col items-center justify-center gap-4 p-8">
      <p style={{ color: 'var(--color-heading)' }} className="text-xl font-semibold">Player not found</p>
      <Link to="/players" style={{ color: 'var(--color-accent)' }} className="text-sm hover:underline">
        ← Back to Players
      </Link>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function PlayerProfile() {
  const { id } = useParams()
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    setError(null)
    setRawData(null)

    async function fetchAll() {
      try {
        const [pRes, sqRes, batRes, bowlRes, fieldRes, sRes, teamsRes] = await Promise.all([
          supabase.from('players').select('id, canonical_name').eq('id', id).single(),
          supabase.from('match_squads').select(
            'match_id, team_id, is_captain, is_wk, ' +
            'teams!inner(name), ' +
            'matches!inner(id, date, match_type, file_name, season_id, winner_team_id, abandoned, team_a_id, team_b_id)'
          ).eq('player_id', id),
          supabase.from('batting_records').select(
            'innings_id, runs, balls, fours, sixes, not_out, innings!inner(match_id)'
          ).eq('player_id', id),
          supabase.from('bowling_records').select(
            'innings_id, balls_bowled, runs_conceded, wickets, dot_balls, innings!inner(match_id)'
          ).eq('player_id', id),
          supabase.from('fielding_credits').select(
            'innings_id, kind, innings!inner(match_id)'
          ).eq('player_id', id),
          supabase.from('seasons').select('id, number'),
          supabase.from('teams').select('id, name'),
        ])

        if (pRes.error) {
          if (pRes.error.code === 'PGRST116') { setNotFound(true); return }
          throw pRes.error
        }
        for (const r of [sqRes, batRes, bowlRes, fieldRes, sRes, teamsRes]) {
          if (r.error) throw r.error
        }

        const seasonNumById = {}
        for (const s of sRes.data) seasonNumById[s.id] = s.number

        const teamsById = {}
        for (const t of teamsRes.data) teamsById[t.id] = t.name

        setRawData({
          player: pRes.data,
          squads: sqRes.data,
          batting: batRes.data,
          bowling: bowlRes.data,
          fielding: fieldRes.data,
          seasonNumById,
          teamsById,
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [id])

  const stats = useMemo(() => {
    if (!rawData) return null
    const { player, squads, batting, bowling, fielding, seasonNumById } = rawData
    return computePlayerStats(player, squads, batting, bowling, fielding, seasonNumById)
  }, [rawData])

  const matchLog = useMemo(() => {
    if (!rawData) return []
    const { squads, batting, bowling, fielding, seasonNumById, teamsById } = rawData

    const batByMatch = new Map()
    for (const b of batting) {
      const mid = b.innings?.match_id
      if (mid && !batByMatch.has(mid)) batByMatch.set(mid, b)
    }
    const bowlByMatch = new Map()
    for (const b of bowling) {
      const mid = b.innings?.match_id
      if (mid && !bowlByMatch.has(mid)) bowlByMatch.set(mid, b)
    }
    const fieldByMatch = new Map()
    for (const f of fielding) {
      const mid = f.innings?.match_id
      if (!mid) continue
      if (!fieldByMatch.has(mid)) fieldByMatch.set(mid, [])
      fieldByMatch.get(mid).push(f.kind)
    }

    return squads
      .filter(sq => !sq.matches.file_name?.includes('synthetic'))
      .map(sq => {
        const m = sq.matches
        const batRow = batByMatch.get(m.id)
        const bowlRow = bowlByMatch.get(m.id)
        const fieldKinds = fieldByMatch.get(m.id) ?? []

        const oppId = m.team_a_id === sq.team_id ? m.team_b_id : m.team_a_id
        const opp = teamsById[oppId] ?? '?'

        const batStr = batRow
          ? `${batRow.runs}${batRow.not_out ? '*' : ''} (${batRow.balls}b)`
          : '—'
        const bowlStr = bowlRow
          ? `${bowlRow.wickets}/${bowlRow.runs_conceded} (${ballsToOvers(bowlRow.balls_bowled)} ov)`
          : '—'

        const fieldParts = []
        const catches = fieldKinds.filter(k => k === 'catch').length
        const stumpings = fieldKinds.filter(k => k === 'stumping').length
        const run_outs = fieldKinds.filter(k => k === 'run_out').length
        if (catches) fieldParts.push(`${catches}ct`)
        if (stumpings) fieldParts.push(`${stumpings}st`)
        if (run_outs) fieldParts.push(`${run_outs}ro`)

        return {
          date: m.date,
          season: seasonNumById[m.season_id],
          matchType: m.match_type,
          opp,
          bat: batStr,
          bowl: bowlStr,
          field: fieldParts.join(' ') || '—',
          isCaptain: sq.is_captain,
        }
      })
      .sort((a, b) => {
        if (!a.date) return 1
        if (!b.date) return -1
        return new Date(b.date) - new Date(a.date)
      })
  }, [rawData])

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />
  if (notFound) return <NotFound />
  if (error) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }} className="p-8">
      <p style={{ color: '#f87171' }} className="text-sm">Error: {error}</p>
    </div>
  )
  if (!stats) return null

  const initials = stats.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const battingRows = [
    { label: 'Matches',      value: stats.matches },
    { label: 'Innings',      value: stats.bat_innings },
    { label: 'Runs',         value: stats.runs },
    { label: 'Average',      value: fmtNum(stats.avg_num) },
    { label: 'Strike Rate',  value: fmtNum(stats.sr_num) },
    { label: 'High Score',   value: stats.hs_display },
    { label: 'Fours',        value: stats.fours },
    { label: 'Sixes',        value: stats.sixes },
    { label: '30+',          value: stats.thirties },
    { label: '50+',          value: stats.fifties },
    { label: 'Ducks',        value: stats.ducks },
  ]

  const bowlingRows = [
    { label: 'Innings',      value: stats.bowl_innings },
    { label: 'Overs',        value: ballsToOvers(stats.balls_bowled) },
    { label: 'Wickets',      value: stats.wickets },
    { label: 'Best Bowling', value: stats.bb_display },
    { label: 'Average',      value: fmtNum(stats.bowl_avg_num) },
    { label: 'Economy',      value: fmtNum(stats.eco_num) },
    { label: 'Dot Ball %',   value: fmtNum(stats.dot_pct_num, 1) },
  ]

  const fieldingRows = [
    { label: 'Catches',      value: stats.catches },
    { label: 'Stumpings',    value: stats.stumpings },
    { label: 'Run Outs',     value: stats.run_outs },
  ]

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

        {/* Back */}
        <Link
          to="/players"
          style={{ color: 'var(--color-text)' }}
          className="text-sm hover:opacity-80 transition-opacity self-start"
        >
          ← Players
        </Link>

        {/* Header */}
        <div className="flex items-center gap-5">
          <div
            style={{
              background: 'var(--color-accent-dim)',
              border: '2px solid var(--color-accent)',
              color: 'var(--color-accent)',
              width: 72, height: 72, flexShrink: 0,
            }}
            className="rounded-full flex items-center justify-center text-xl font-bold select-none"
          >
            {initials}
          </div>
          <div>
            <h1
              style={{ color: 'var(--color-heading)' }}
              className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight"
            >
              {stats.name}
            </h1>
            <p style={{ color: 'var(--color-text)' }} className="text-sm mt-1">
              {stats.season_nums.length > 0 && `Played seasons ${stats.season_nums.join(', ')}`}
              {stats.season_nums.length > 0 && stats.team_names.length > 0 && '  ·  '}
              {stats.team_names.join(', ')}
            </p>
          </div>
        </div>

        {/* Callout strips */}
        <div className="flex flex-col gap-3">
          {stats.times_captained > 0 && (
            <div
              style={{
                background: 'var(--color-accent-dim)',
                border: '1px solid var(--color-accent)',
                borderLeft: '3px solid var(--color-accent)',
              }}
              className="rounded-lg px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 items-center"
            >
              <span style={{ color: 'var(--color-text)' }} className="text-xs uppercase tracking-wider font-semibold">
                Captain
              </span>
              <span style={{ color: 'var(--color-heading)' }} className="text-sm">
                Captained {stats.times_captained}
              </span>
              <span style={{ color: 'var(--color-heading)' }} className="text-sm">
                Won {fmtHalf(stats.capt_wins)}
              </span>
              <span style={{ color: 'var(--color-heading)' }} className="text-sm">
                Lost {fmtHalf(stats.capt_losses)}
              </span>
              <span style={{ color: 'var(--color-heading)' }} className="text-sm font-semibold">
                Win% {fmtNum(stats.capt_win_pct_num, 1)}
              </span>
            </div>
          )}

          {stats.final_appearances > 0 && (
            <div className="self-start">
              <span
                style={{
                  background: 'var(--color-accent-dim)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-accent)',
                }}
                className="text-xs font-semibold px-3 py-1 rounded-full"
              >
                🏆 {stats.final_appearances} final{stats.final_appearances !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Stat blocks */}
        <div className="flex flex-col sm:flex-row gap-4">
          <StatBlock
            title="Batting"
            rows={battingRows}
            emptyMessage={stats.bat_innings === 0 ? 'Did Not Bat' : null}
          />
          <StatBlock
            title="Bowling"
            rows={bowlingRows}
            emptyMessage={stats.bowl_innings === 0 ? 'Did Not Bowl' : null}
          />
          <StatBlock
            title="Fielding"
            rows={fieldingRows}
          />
        </div>

        {/* Match log */}
        <div
          style={{ border: '1px solid var(--color-border)' }}
          className="rounded-xl overflow-hidden"
        >
          <button
            onClick={() => setLogOpen(o => !o)}
            style={{ background: 'var(--color-surface)', color: 'var(--color-heading)' }}
            className="w-full px-5 py-4 flex items-center justify-between text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            <span>Match Log ({matchLog.length} matches)</span>
            <span style={{ color: 'var(--color-text)' }}>{logOpen ? '▲' : '▼'}</span>
          </button>

          {logOpen && (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}>
                    {['Date', 'S', 'Type', 'vs', 'Bat', 'Bowl', 'Field'].map(h => (
                      <th
                        key={h}
                        style={{ color: 'var(--color-text)', borderRight: '1px solid var(--color-border)' }}
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matchLog.map((m, i) => (
                    <tr
                      key={`${m.date}-${i}`}
                      style={{
                        background: i % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <td style={{ color: 'var(--color-text)', borderRight: '1px solid var(--color-border)' }}
                          className="px-3 py-2 whitespace-nowrap">{m.date ?? '—'}</td>
                      <td style={{ color: 'var(--color-text)', borderRight: '1px solid var(--color-border)' }}
                          className="px-3 py-2 whitespace-nowrap">{m.season}</td>
                      <td style={{ color: 'var(--color-text)', borderRight: '1px solid var(--color-border)' }}
                          className="px-3 py-2 whitespace-nowrap">{m.matchType}</td>
                      <td style={{ color: 'var(--color-heading)', borderRight: '1px solid var(--color-border)' }}
                          className="px-3 py-2 whitespace-nowrap font-medium">{m.opp}</td>
                      <td style={{ color: 'var(--color-text)', borderRight: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}
                          className="px-3 py-2 whitespace-nowrap">{m.bat}</td>
                      <td style={{ color: 'var(--color-text)', borderRight: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}
                          className="px-3 py-2 whitespace-nowrap">{m.bowl}</td>
                      <td style={{ color: 'var(--color-text)' }}
                          className="px-3 py-2 whitespace-nowrap">{m.field}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
