export function groupBy(arr, key) {
  const m = new Map()
  for (const item of arr) {
    const k = item[key]
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(item)
  }
  return m
}

export function ballsToOvers(balls) {
  if (!balls) return '0.0'
  return `${Math.floor(balls / 6)}.${balls % 6}`
}

export function fmtNum(n, dp = 2) {
  return n == null ? '—' : n.toFixed(dp)
}

export function fmtHalf(n) {
  if (n == null || n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

export function computePlayerStats(player, pSquads, pBat, pBowl, pField, seasonNumById) {
  const pid = player.id

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

  const season_nums = [...seasonSet].sort((a, b) => a - b)
  const team_names = [...teamSet]

  // ── batting ─────────────────────────────────────────────────────────────
  const bat_innings = pBat.length
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
  const bowl_innings = pBowl.length
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
    bat_innings, runs, balls_faced, not_outs, fours, sixes,
    hs_runs: hs_runs === -1 ? 0 : hs_runs,
    thirties, fifties, ducks,
    avg_num, sr_num, hs_display,
    bowl_innings, balls_bowled, runs_conceded, wickets, dot_balls,
    bb_wickets, bb_sort, bowl_avg_num, eco_num, dot_pct_num, bb_display,
    catches, stumpings, run_outs,
    times_captained, capt_wins, capt_losses, capt_win_pct_num,
    final_appearances,
  }
}

export function computeStats(players, squads, batting, bowling, fielding, seasonNumById) {
  const squadsByPlayer = groupBy(squads, 'player_id')
  const battingByPlayer = groupBy(batting, 'player_id')
  const bowlingByPlayer = groupBy(bowling, 'player_id')
  const fieldingByPlayer = groupBy(fielding, 'player_id')

  return players.map(player =>
    computePlayerStats(
      player,
      squadsByPlayer.get(player.id) ?? [],
      battingByPlayer.get(player.id) ?? [],
      bowlingByPlayer.get(player.id) ?? [],
      fieldingByPlayer.get(player.id) ?? [],
      seasonNumById,
    )
  )
}
