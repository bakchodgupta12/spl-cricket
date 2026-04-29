import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ─── pure computation ─────────────────────────────────────────────────────────

function groupBy(arr, key) {
  const m = new Map()
  for (const item of arr) {
    const k = item[key]
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(item)
  }
  return m
}

function ballsToOvers(balls) {
  if (!balls) return '0.0'
  return `${Math.floor(balls / 6)}.${balls % 6}`
}

function fmtNum(n, dp = 2) {
  return n == null ? '—' : n.toFixed(dp)
}

function fmtHalf(n) {
  if (n == null || n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function computeStats(players, squads, batting, bowling, fielding, seasonNumById) {
  const squadsByPlayer = groupBy(squads, 'player_id')
  const battingByPlayer = groupBy(batting, 'player_id')
  const bowlingByPlayer = groupBy(bowling, 'player_id')
  const fieldingByPlayer = groupBy(fielding, 'player_id')

  return players.map(player => {
    const pid = player.id
    const pSquads = squadsByPlayer.get(pid) ?? []
    const pBat = battingByPlayer.get(pid) ?? []
    const pBowl = bowlingByPlayer.get(pid) ?? []
    const pField = fieldingByPlayer.get(pid) ?? []

    // ── matches, seasons, teams, captaincy, finals ──────────────────────────
    let matchCount = 0
    let times_captained = 0, capt_wins = 0, capt_losses = 0, final_appearances = 0
    const seasonSet = new Set()
    const teamSet = new Set()

    for (const sq of pSquads) {
      const m = sq.matches
      if (!m) continue
      const synthetic = m.file_name?.includes('synthetic')

      if (!synthetic) matchCount++
      if (m.match_type === 'Final') final_appearances++

      const sNum = seasonNumById[m.season_id]
      if (sNum) seasonSet.add(sNum)
      if (sq.teams?.name) teamSet.add(sq.teams.name)

      if (sq.is_captain) {
        times_captained++
        if (m.abandoned) {
          capt_wins += 0.5
          capt_losses += 0.5
        } else if (m.winner_team_id && m.winner_team_id === sq.team_id) {
          capt_wins += 1
        } else {
          capt_losses += 1
        }
      }
    }

    const season_nums = [...seasonSet].sort()
    const team_names = [...teamSet]

    // ── batting ─────────────────────────────────────────────────────────────
    let bat_innings = pBat.length
    let runs = 0, balls_faced = 0, not_outs = 0, fours = 0, sixes = 0
    let hs_runs = -1, hs_not_out = false
    let thirties = 0, fifties = 0, ducks = 0

    for (const b of pBat) {
      runs += b.runs
      balls_faced += b.balls
      fours += b.fours
      sixes += b.sixes
      if (b.not_out) not_outs++
      if (b.runs >= 30) thirties++
      if (b.runs >= 50) fifties++
      if (b.runs === 0 && !b.not_out && b.balls > 0) ducks++

      if (b.runs > hs_runs || (b.runs === hs_runs && b.not_out && !hs_not_out)) {
        hs_runs = b.runs
        hs_not_out = b.not_out
      } else if (b.runs === hs_runs && b.not_out) {
        hs_not_out = true
      }
    }

    const dismissals = bat_innings - not_outs
    const avg_num = dismissals > 0 ? runs / dismissals : null
    const sr_num = balls_faced > 0 ? (runs / balls_faced) * 100 : null
    const hs_display = bat_innings > 0 ? `${hs_runs}${hs_not_out ? '*' : ''}` : '—'

    // ── bowling ─────────────────────────────────────────────────────────────
    let bowl_innings = pBowl.length
    let balls_bowled = 0, runs_conceded = 0, wickets = 0, dot_balls = 0
    let bb_wickets = 0, bb_runs = Infinity

    for (const b of pBowl) {
      balls_bowled += b.balls_bowled
      runs_conceded += b.runs_conceded
      wickets += b.wickets
      dot_balls += b.dot_balls

      if (
        b.wickets > bb_wickets ||
        (b.wickets === bb_wickets && b.runs_conceded < bb_runs)
      ) {
        bb_wickets = b.wickets
        bb_runs = b.runs_conceded
      }
    }

    const bowl_avg_num = wickets > 0 ? runs_conceded / wickets : null
    const eco_num = balls_bowled > 0 ? (runs_conceded / balls_bowled) * 6 : null
    const dot_pct_num = balls_bowled > 0 ? (dot_balls / balls_bowled) * 100 : null
    const bb_display = bowl_innings > 0 ? `${bb_runs === Infinity ? 0 : bb_runs}/${bb_wickets}` : '—'
    // bb_sort: higher wickets better; among equal wickets, fewer runs better
    const bb_sort = bowl_innings > 0 ? bb_wickets * 10000 - (bb_runs === Infinity ? 0 : bb_runs) : -1

    // ── fielding ─────────────────────────────────────────────────────────────
    let catches = 0, stumpings = 0, run_outs = 0
    for (const f of pField) {
      if (f.kind === 'catch') catches++
      else if (f.kind === 'stumping') stumpings++
      else if (f.kind === 'run_out') run_outs++
    }

    // ── captaincy ────────────────────────────────────────────────────────────
    const capt_win_pct_num = times_captained > 0 ? (capt_wins / times_captained) * 100 : null

    return {
      id: pid,
      name: player.canonical_name,
      season_nums,
      team_names,
      matches: matchCount,
      // batting raw
      bat_innings, runs, balls_faced, not_outs, fours, sixes,
      hs_runs: hs_runs === -1 ? 0 : hs_runs,
      thirties, fifties, ducks,
      avg_num, sr_num,
      hs_display,
      // bowling raw
      bowl_innings, balls_bowled, runs_conceded, wickets, dot_balls,
      bb_wickets, bb_sort,
      bowl_avg_num, eco_num, dot_pct_num,
      bb_display,
      // fielding
      catches, stumpings, run_outs,
      // captaincy
      times_captained, capt_wins, capt_losses,
      capt_win_pct_num,
      // finals
      final_appearances,
    }
  })
}

// ─── column definitions ───────────────────────────────────────────────────────

const COLS = [
  { key: 'name',             label: 'Player',   sortKey: 'name',            title: 'Player name', sticky: true },
  { key: 'seasons_display',  label: 'Seasons',  sortKey: 'season_count',    title: 'Seasons played' },
  { key: 'teams_display',    label: 'Teams',    sortKey: 'teams_display',   title: 'Teams played for' },
  { key: 'matches',          label: 'M',        sortKey: 'matches',         title: 'Matches played' },
  { key: 'bat_innings',      label: 'Inn',      sortKey: 'bat_innings',     title: 'Batting innings' },
  { key: 'runs',             label: 'Runs',     sortKey: 'runs',            title: 'Total runs scored' },
  { key: 'avg_display',      label: 'Avg',      sortKey: 'avg_num',         title: 'Batting average' },
  { key: 'sr_display',       label: 'SR',       sortKey: 'sr_num',          title: 'Strike rate' },
  { key: 'hs_display',       label: 'HS',       sortKey: 'hs_runs',         title: 'High score (* = not out)' },
  { key: 'fours',            label: '4s',       sortKey: 'fours',           title: 'Fours hit' },
  { key: 'sixes',            label: '6s',       sortKey: 'sixes',           title: 'Sixes hit' },
  { key: 'thirties',         label: '30+',      sortKey: 'thirties',        title: 'Innings of 30 or more' },
  { key: 'fifties',          label: '50+',      sortKey: 'fifties',         title: 'Innings of 50 or more' },
  { key: 'ducks',            label: '0s',       sortKey: 'ducks',           title: 'Ducks (0 off 1+ balls, dismissed)' },
  { key: 'bowl_innings',     label: 'Inn',      sortKey: 'bowl_innings',    title: 'Bowling innings' },
  { key: 'overs_display',    label: 'Ovrs',     sortKey: 'balls_bowled',    title: 'Overs bowled' },
  { key: 'wickets',          label: 'Wkts',     sortKey: 'wickets',         title: 'Wickets taken' },
  { key: 'bb_display',       label: 'BB',       sortKey: 'bb_sort',         title: 'Best bowling (Runs/Wickets)' },
  { key: 'bowl_avg_display', label: 'B.Avg',    sortKey: 'bowl_avg_num',    title: 'Bowling average' },
  { key: 'eco_display',      label: 'Eco',      sortKey: 'eco_num',         title: 'Economy rate' },
  { key: 'dot_pct_display',  label: 'Dot%',     sortKey: 'dot_pct_num',     title: 'Dot ball percentage' },
  { key: 'catches',          label: 'Ct',       sortKey: 'catches',         title: 'Catches' },
  { key: 'stumpings',        label: 'St',       sortKey: 'stumpings',       title: 'Stumpings' },
  { key: 'run_outs',         label: 'RO',       sortKey: 'run_outs',        title: 'Run outs effected' },
  { key: 'times_captained',  label: 'Cap',      sortKey: 'times_captained', title: 'Times captained' },
  { key: 'capt_wins',        label: 'C.W',      sortKey: 'capt_wins',       title: 'Captain wins (+0.5 for abandoned)' },
  { key: 'capt_losses',      label: 'C.L',      sortKey: 'capt_losses',     title: 'Captain losses' },
  { key: 'capt_win_pct',     label: 'C.W%',     sortKey: 'capt_win_pct_num',title: 'Captain win %' },
  { key: 'final_appearances',label: 'FA',       sortKey: 'final_appearances',title: 'Final appearances' },
]

// ─── component ────────────────────────────────────────────────────────────────

export default function Players() {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [seasonFilter, setSeasonFilter] = useState(new Set())   // empty = all
  const [teamFilter, setTeamFilter] = useState(new Set())       // empty = all

  const [sortKey, setSortKey] = useState('runs')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    async function fetchAll() {
      try {
        const [pRes, sqRes, batRes, bowlRes, fieldRes, sRes] = await Promise.all([
          supabase.from('players').select('id, canonical_name'),
          supabase.from('match_squads').select(
            'match_id, player_id, team_id, is_captain, matches!inner(match_type, file_name, winner_team_id, abandoned, season_id), teams!inner(name)'
          ),
          supabase.from('batting_records').select('player_id, runs, balls, fours, sixes, not_out'),
          supabase.from('bowling_records').select('player_id, balls_bowled, runs_conceded, wickets, dot_balls'),
          supabase.from('fielding_credits').select('player_id, kind'),
          supabase.from('seasons').select('id, number'),
        ])

        for (const r of [pRes, sqRes, batRes, bowlRes, fieldRes, sRes]) {
          if (r.error) throw r.error
        }

        const seasonNumById = {}
        for (const s of sRes.data) seasonNumById[s.id] = s.number

        setRawData({
          players: pRes.data,
          squads: sqRes.data,
          batting: batRes.data,
          bowling: bowlRes.data,
          fielding: fieldRes.data,
          seasonNumById,
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Compute per-player stats once raw data is available
  const allRows = useMemo(() => {
    if (!rawData) return []
    return computeStats(
      rawData.players,
      rawData.squads,
      rawData.batting,
      rawData.bowling,
      rawData.fielding,
      rawData.seasonNumById,
    )
  }, [rawData])

  // Available filter options (derived from computed rows)
  const allTeams = useMemo(() => {
    const s = new Set()
    for (const r of allRows) for (const t of r.team_names) s.add(t)
    return [...s].sort()
  }, [allRows])

  // Attach display values and sort helper values
  const rowsWithDisplay = useMemo(() => allRows.map(r => ({
    ...r,
    seasons_display: r.season_nums.map(n => `S${n}`).join(', '),
    season_count: r.season_nums.length,
    teams_display: r.team_names.join(', '),
    avg_display: fmtNum(r.avg_num),
    sr_display: fmtNum(r.sr_num),
    overs_display: ballsToOvers(r.balls_bowled),
    bowl_avg_display: fmtNum(r.bowl_avg_num),
    eco_display: fmtNum(r.eco_num),
    dot_pct_display: fmtNum(r.dot_pct_num, 1),
    capt_wins: fmtHalf(r.capt_wins),
    capt_losses: fmtHalf(r.capt_losses),
    capt_win_pct: fmtNum(r.capt_win_pct_num, 1),
  })), [allRows])

  // Filter
  const filtered = useMemo(() => {
    return rowsWithDisplay.filter(r => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
      if (seasonFilter.size > 0 && !r.season_nums.some(n => seasonFilter.has(n))) return false
      if (teamFilter.size > 0 && !r.team_names.some(t => teamFilter.has(t))) return false
      return true
    })
  }, [rowsWithDisplay, search, seasonFilter, teamFilter])

  // Sort
  const sorted = useMemo(() => {
    const col = COLS.find(c => c.sortKey === sortKey)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? a[col.key]
      const bv = b[sortKey] ?? b[col.key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      let cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function toggleSeason(n) {
    setSeasonFilter(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  function toggleTeam(t) {
    setTeamFilter(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>

      {/* Page header */}
      <div
        style={{ borderBottom: '1px solid var(--color-border)' }}
        className="px-4 sm:px-6 py-5"
      >
        <h1
          style={{ color: 'var(--color-heading)' }}
          className="text-2xl font-bold tracking-tight"
        >
          Players
        </h1>
      </div>

      {/* Filters */}
      <div
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        className="px-4 sm:px-6 py-4 flex flex-col gap-3"
      >
        {/* Search */}
        <input
          type="search"
          placeholder="Search player…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-heading)',
          }}
          className="w-full sm:w-72 px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Season pills */}
        <div className="flex flex-wrap gap-2 items-center">
          <span style={{ color: 'var(--color-text)' }} className="text-xs uppercase tracking-wider mr-1">Season</span>
          {[1, 2, 3, 4, 5].map(n => {
            const active = seasonFilter.has(n)
            return (
              <button
                key={n}
                onClick={() => toggleSeason(n)}
                style={active
                  ? { background: 'var(--color-accent)', color: '#fff', border: '1px solid var(--color-accent)' }
                  : { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)' }
                }
                className="px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-80"
              >
                S{n}
              </button>
            )
          })}
        </div>

        {/* Team pills */}
        {allTeams.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span style={{ color: 'var(--color-text)' }} className="text-xs uppercase tracking-wider mr-1">Team</span>
            {allTeams.map(t => {
              const active = teamFilter.has(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleTeam(t)}
                  style={active
                    ? { background: 'var(--color-accent)', color: '#fff', border: '1px solid var(--color-accent)' }
                    : { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)' }
                  }
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-80 whitespace-nowrap"
                >
                  {t}
                </button>
              )
            })}
          </div>
        )}

        {!loading && (
          <p style={{ color: 'var(--color-text)' }} className="text-xs">
            {sorted.length} of {allRows.length} players
          </p>
        )}
      </div>

      {/* Table */}
      {error && (
        <p style={{ color: '#f87171' }} className="p-6 text-sm">{error}</p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading players…</div>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}
                  className="sticky top-0 z-10">
                {COLS.map((col, i) => {
                  const active = sortKey === col.sortKey
                  return (
                    <th
                      key={col.key}
                      title={col.title}
                      onClick={() => handleSort(col.sortKey)}
                      style={{
                        color: active ? 'var(--color-heading)' : 'var(--color-text)',
                        background: 'var(--color-surface)',
                        borderRight: '1px solid var(--color-border)',
                        borderBottom: '2px solid var(--color-border)',
                        ...(col.sticky ? { position: 'sticky', left: 0, zIndex: 20 } : {}),
                      }}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:opacity-80"
                    >
                      {col.label}
                      {active && (
                        <span className="ml-1">{sortDir === 'desc' ? '▼' : '▲'}</span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.id}
                  style={{
                    background: i % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                  className="hover:brightness-110 transition-all cursor-pointer"
                  onClick={() => window.location.href = `/players/${row.id}`}
                >
                  {COLS.map(col => {
                    const isName = col.key === 'name'
                    const val = row[col.key] ?? row[col.sortKey]
                    return (
                      <td
                        key={col.key}
                        style={{
                          color: isName ? 'var(--color-heading)' : 'var(--color-text)',
                          background: col.sticky
                            ? (i % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)')
                            : undefined,
                          borderRight: '1px solid var(--color-border)',
                          ...(col.sticky ? { position: 'sticky', left: 0 } : {}),
                        }}
                        className={`px-3 py-2 whitespace-nowrap ${isName ? 'font-medium' : ''}`}
                      >
                        {isName
                          ? <Link
                              to={`/players/${row.id}`}
                              style={{ color: 'var(--color-heading)' }}
                              className="hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {val}
                            </Link>
                          : (val == null || val === undefined ? '—' : val)
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <p style={{ color: 'var(--color-text)' }} className="text-center py-12 text-sm">
              No players match the current filters.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
