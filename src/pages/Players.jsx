import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { groupBy, ballsToOvers, fmtNum, fmtHalf, computeStats } from '../lib/cricketStats'

// ─── column definitions ───────────────────────────────────────────────────────

const COLS = [
  { key: 'name',             label: 'Player',  sortKey: 'name',             title: 'Player name', sticky: true, stickyLeft: 44 },
  { key: 'seasons_display',  label: 'Seasons', sortKey: 'season_count',     title: 'Seasons played' },
  { key: 'teams_display',    label: 'Teams',   sortKey: 'teams_display',    title: 'Teams played for' },
  { key: 'matches',          label: 'M',       sortKey: 'matches',          title: 'Matches played' },
  { key: 'bat_innings',      label: 'Inn',     sortKey: 'bat_innings',      title: 'Batting innings' },
  { key: 'runs',             label: 'Runs',    sortKey: 'runs',             title: 'Total runs scored' },
  { key: 'avg_display',      label: 'Avg',     sortKey: 'avg_num',          title: 'Batting average' },
  { key: 'sr_display',       label: 'SR',      sortKey: 'sr_num',           title: 'Strike rate' },
  { key: 'hs_display',       label: 'HS',      sortKey: 'hs_runs',          title: 'High score (* = not out)' },
  { key: 'fours',            label: '4s',      sortKey: 'fours',            title: 'Fours hit' },
  { key: 'sixes',            label: '6s',      sortKey: 'sixes',            title: 'Sixes hit' },
  { key: 'thirties',         label: '30+',     sortKey: 'thirties',         title: 'Innings of 30 or more' },
  { key: 'fifties',          label: '50+',     sortKey: 'fifties',          title: 'Innings of 50 or more' },
  { key: 'ducks',            label: '0s',      sortKey: 'ducks',            title: 'Ducks (0 off 1+ balls, dismissed)' },
  { key: 'bowl_innings',     label: 'Inn',     sortKey: 'bowl_innings',     title: 'Bowling innings' },
  { key: 'overs_display',    label: 'Ovrs',    sortKey: 'balls_bowled',     title: 'Overs bowled' },
  { key: 'wickets',          label: 'Wkts',    sortKey: 'wickets',          title: 'Wickets taken' },
  { key: 'bb_display',       label: 'BB',      sortKey: 'bb_sort',          title: 'Best bowling (Runs/Wickets)' },
  { key: 'bowl_avg_display', label: 'B.Avg',   sortKey: 'bowl_avg_num',     title: 'Bowling average' },
  { key: 'eco_display',      label: 'Eco',     sortKey: 'eco_num',          title: 'Economy rate' },
  { key: 'dot_pct_display',  label: 'Dot%',    sortKey: 'dot_pct_num',      title: 'Dot ball percentage' },
  { key: 'catches',          label: 'Ct',      sortKey: 'catches',          title: 'Catches' },
  { key: 'stumpings',        label: 'St',      sortKey: 'stumpings',        title: 'Stumpings' },
  { key: 'run_outs',         label: 'RO',      sortKey: 'run_outs',         title: 'Run outs effected' },
  { key: 'times_captained',  label: 'Cap',     sortKey: 'times_captained',  title: 'Times captained' },
  { key: 'capt_wins',        label: 'C.W',     sortKey: 'capt_wins',        title: 'Captain wins (+0.5 for abandoned)' },
  { key: 'capt_losses',      label: 'C.L',     sortKey: 'capt_losses',      title: 'Captain losses' },
  { key: 'capt_win_pct',     label: 'C.W%',    sortKey: 'capt_win_pct_num', title: 'Captain win %' },
  { key: 'final_appearances',label: 'FA',      sortKey: 'final_appearances',title: 'Final appearances' },
]

// Columns shown per view — name + shared cols always included
const VIEW_COLS = {
  Batting: new Set(['name', 'seasons_display', 'teams_display', 'matches', 'bat_innings', 'runs', 'avg_display', 'sr_display', 'hs_display', 'fours', 'sixes', 'thirties', 'fifties', 'ducks']),
  Bowling: new Set(['name', 'seasons_display', 'teams_display', 'matches', 'bowl_innings', 'overs_display', 'wickets', 'bb_display', 'bowl_avg_display', 'eco_display', 'dot_pct_display']),
  Others:  new Set(['name', 'seasons_display', 'teams_display', 'matches', 'catches', 'stumpings', 'run_outs', 'times_captained', 'capt_wins', 'capt_losses', 'capt_win_pct', 'final_appearances']),
}

const VIEW_DEFAULT_SORT = { Batting: 'runs', Bowling: 'wickets', Others: 'final_appearances' }

// ─── component ────────────────────────────────────────────────────────────────

export default function Players() {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('Batting')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [seasonFilter, setSeasonFilter] = useState(new Set())
  const [teamFilter, setTeamFilter] = useState(new Set())

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

  const allRows = useMemo(() => {
    if (!rawData) return []
    return computeStats(
      rawData.players, rawData.squads, rawData.batting,
      rawData.bowling, rawData.fielding, rawData.seasonNumById,
    )
  }, [rawData])

  const allSeasons = useMemo(() => {
    const s = new Set()
    for (const r of allRows) for (const n of r.season_nums) s.add(n)
    return [...s].sort((a, b) => a - b)
  }, [allRows])

  const allTeams = useMemo(() => {
    const s = new Set()
    for (const r of allRows) for (const t of r.team_names) s.add(t)
    return [...s].sort()
  }, [allRows])

  const rowsWithDisplay = useMemo(() => allRows.map(r => ({
    ...r,
    seasons_display: r.season_nums.join(', '),
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

  const filtered = useMemo(() => rowsWithDisplay.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (seasonFilter.size > 0 && !r.season_nums.some(n => seasonFilter.has(n))) return false
    if (teamFilter.size > 0 && !r.team_names.some(t => teamFilter.has(t))) return false
    return true
  }), [rowsWithDisplay, search, seasonFilter, teamFilter])

  const sorted = useMemo(() => {
    const col = COLS.find(c => c.sortKey === sortKey)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      let cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [filtered, sortKey, sortDir])

  const visibleCols = useMemo(() => COLS.filter(c => VIEW_COLS[viewMode].has(c.key)), [viewMode])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function setView(mode) {
    setViewMode(mode)
    setSortKey(VIEW_DEFAULT_SORT[mode])
    setSortDir('desc')
  }

  function toggleSeason(n) {
    setSeasonFilter(prev => { const next = new Set(prev); next.has(n) ? next.delete(n) : next.add(n); return next })
  }

  function toggleTeam(t) {
    setTeamFilter(prev => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next })
  }

  const activeFilterCount = seasonFilter.size + teamFilter.size

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>

      {/* Page header */}
      <div
        style={{ borderBottom: '1px solid var(--color-border)' }}
        className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
      >
        <h1 style={{ color: 'var(--color-heading)' }} className="text-xl sm:text-2xl font-bold tracking-tight">
          Players
        </h1>
        <input
          type="search"
          placeholder="Search player…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-heading)',
          }}
          className="w-full sm:w-60 px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* View pills + Filters toggle */}
      <div
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        className="px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap"
      >
        {['Batting', 'Bowling', 'Others'].map(mode => {
          const active = viewMode === mode
          return (
            <button
              key={mode}
              onClick={() => setView(mode)}
              style={active
                ? { background: 'var(--color-accent)', color: '#fff', border: '1px solid var(--color-accent)' }
                : { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)' }
              }
              className="px-4 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-80"
            >
              {mode}
            </button>
          )
        })}
        <button
          onClick={() => setFiltersOpen(o => !o)}
          style={{
            background: activeFilterCount > 0 ? 'rgba(77,142,255,0.12)' : 'transparent',
            color: activeFilterCount > 0 ? 'var(--color-accent)' : 'var(--color-text)',
            border: `1px solid ${activeFilterCount > 0 ? 'var(--color-accent)' : 'var(--color-border)'}`,
          }}
          className="px-4 py-1.5 sm:py-1 min-h-[36px] sm:min-h-0 rounded-full text-xs font-semibold transition-colors hover:opacity-80 sm:ml-auto flex items-center gap-1.5"
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} {filtersOpen ? '▲' : '▼'}
        </button>
      </div>

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <div
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
          className="px-4 sm:px-6 py-4 flex flex-col gap-3"
        >
          {/* Season pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <span style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }} className="mr-1">Season</span>
            {allSeasons.map(n => {
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
              <span style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }} className="mr-1">Team</span>
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
              {(seasonFilter.size > 0 || teamFilter.size > 0) && (
                <button
                  onClick={() => { setSeasonFilter(new Set()); setTeamFilter(new Set()) }}
                  style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', background: 'transparent' }}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-80 ml-2"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {error && <p style={{ color: '#f87171' }} className="p-6 text-sm">{error}</p>}

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading players…</div>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
                  className="sticky top-0 z-10">
                {/* Row number */}
                <th
                  style={{
                    color: 'var(--color-text)',
                    background: 'var(--color-surface)',
                    borderRight: '1px solid var(--color-border)',
                    borderBottom: '1px solid var(--color-border)',
                    position: 'sticky', left: 0, zIndex: 20,
                    width: '44px', minWidth: '44px',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}
                  className="px-3 py-2 text-center select-none whitespace-nowrap"
                >
                  #
                </th>
                {visibleCols.map(col => {
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
                        borderBottom: '1px solid var(--color-border)',
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                        ...(col.sticky ? { position: 'sticky', left: col.stickyLeft ?? 0, zIndex: 20 } : {}),
                      }}
                      className="px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap hover:opacity-80"
                    >
                      {col.label}
                      {active && <span className="ml-1">{sortDir === 'desc' ? '▼' : '▲'}</span>}
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
                    background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                  className="hover:brightness-110 transition-all"
                >
                  <td
                    style={{
                      color: 'var(--color-text)',
                      background: 'var(--color-bg)',
                      borderRight: '1px solid var(--color-border)',
                      position: 'sticky', left: 0, zIndex: 1,
                      width: '44px', minWidth: '44px',
                      fontSize: 12,
                    }}
                    className="px-3 py-2 whitespace-nowrap text-center"
                  >
                    {i + 1}
                  </td>
                  {visibleCols.map(col => {
                    const isName = col.key === 'name'
                    const val = row[col.key] ?? row[col.sortKey]
                    return (
                      <td
                        key={col.key}
                        style={{
                          color: isName ? 'var(--color-heading)' : 'var(--color-text)',
                          background: col.sticky ? 'var(--color-bg)' : undefined,
                          borderRight: '1px solid var(--color-border)',
                          fontVariantNumeric: isName ? undefined : 'tabular-nums',
                          fontSize: isName ? 14 : 13,
                          ...(col.sticky ? { position: 'sticky', left: col.stickyLeft ?? 0, zIndex: 1 } : {}),
                        }}
                        className={`px-3 py-2 whitespace-nowrap ${isName ? 'font-medium' : ''}`}
                      >
                        {isName
                          ? <Link to={`/players/${row.id}`} style={{ color: 'var(--color-heading)' }} className="hover:underline">
                              {val}
                            </Link>
                          : (val == null ? '—' : val)
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
