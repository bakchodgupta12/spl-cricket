#!/usr/bin/env node
// scripts/import_historical.js
//
// Imports spl_historical_data.json into Supabase historical tables.
//
// Usage:
//   node scripts/import_historical.js --confirm-truncate
//
// Requires in .env.local:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_SERVICE_ROLE_KEY
//
// The --confirm-truncate flag is mandatory to prevent accidental runs.
// All 10 historical tables are wiped (reverse FK order) before insert.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── env ──────────────────────────────────────────────────────────────────────

process.loadEnvFile(resolve(process.cwd(), '.env.local'))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}
if (SERVICE_ROLE_KEY === 'paste-service-role-key-here') {
  console.error('ERROR: Replace the placeholder value of VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local with your real service role key.')
  process.exit(1)
}
if (!process.argv.includes('--confirm-truncate')) {
  console.error('ERROR: Pass --confirm-truncate to confirm truncation of all historical tables before import.')
  console.error('       Example: node scripts/import_historical.js --confirm-truncate')
  process.exit(1)
}

// ─── supabase client (service role — bypasses RLS) ────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── load data ────────────────────────────────────────────────────────────────

const dataPath = resolve(process.cwd(), 'data/spl_historical_data.json')
const data = JSON.parse(readFileSync(dataPath, 'utf8'))

// ─── helpers ──────────────────────────────────────────────────────────────────

// "7.2" overs → 44 balls (7 complete overs + 2 deliveries)
function oversToBalls(overs) {
  if (overs == null) return null
  const str = String(overs)
  const [whole, frac = '0'] = str.split('.')
  return parseInt(whole, 10) * 6 + parseInt(frac, 10)
}

async function dbInsert(table, rows) {
  if (rows.length === 0) return []
  const { data: inserted, error } = await supabase.from(table).insert(rows).select()
  if (error) throw new Error(`Insert into "${table}" failed: ${error.message}\nFirst row: ${JSON.stringify(rows[0])}`)
  return inserted
}

async function dbDelete(table) {
  const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(`Delete from "${table}" failed: ${error.message}`)
}

async function dbCount(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`Count "${table}" failed: ${error.message}`)
  return count
}

// Extract fielding credits from a raw dismissal string.
// Returns array of { name: string (registered name), kind: 'catch'|'stumping'|'run_out' }
function parseFieldingCredits(dismissal) {
  if (!dismissal) return []
  const d = dismissal.trim()

  // No fielding credit: not out, bowled, lbw, hit wicket
  if (
    d === 'not out' ||
    d.startsWith('b ') ||
    d.startsWith('lbw') ||
    d.startsWith('hit wkt')
  ) return []

  // c&b Bowler — bowler takes the catch
  if (d.startsWith('c&b ')) {
    return [{ name: d.slice(4).trim(), kind: 'catch' }]
  }

  // c Fielder b Bowler / c †Fielder b Bowler
  if (d.startsWith('c ') && d.includes(' b ')) {
    const lastB = d.lastIndexOf(' b ')
    const fielder = d.slice(2, lastB).replace(/^†\s*/, '').trim()
    return [{ name: fielder, kind: 'catch' }]
  }

  // st †Keeper b Bowler
  if (d.startsWith('st ') && d.includes(' b ')) {
    const lastB = d.lastIndexOf(' b ')
    const keeper = d.slice(3, lastB).replace(/^†\s*/, '').trim()
    return [{ name: keeper, kind: 'stumping' }]
  }

  // run out Fielder / run out †Fielder / run out F1 / F2
  if (d.startsWith('run out ')) {
    const rest = d.slice('run out '.length).trim()
    if (rest.includes(' / ')) {
      return rest.split(' / ').map(part => ({
        name: part.replace(/^†\s*/, '').trim(),
        kind: 'run_out',
      }))
    }
    return [{ name: rest.replace(/^†\s*/, '').trim(), kind: 'run_out' }]
  }

  return []
}

// ─── season years (derived from match dates in the JSON) ──────────────────────

const SEASON_YEARS = { 1: 2024, 2: 2025, 3: 2025, 4: 2025, 5: 2025 }

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SPL Hub — historical data import')
  console.log('=================================')

  // ── 0. Truncate (reverse FK dependency order) ─────────────────────────────
  console.log('\n[0] Truncating historical tables...')
  const TRUNCATE_ORDER = [
    'fielding_credits',
    'batting_records',
    'bowling_records',
    'match_squads',
    'innings',
    'matches',
    'player_season_aliases',
    'teams',
    'players',
    'seasons',
  ]
  for (const table of TRUNCATE_ORDER) {
    await dbDelete(table)
    process.stdout.write(`    cleared ${table}\n`)
  }

  // ── 1. Seasons ────────────────────────────────────────────────────────────
  console.log('\n[1] Inserting seasons...')
  const insertedSeasons = await dbInsert(
    'seasons',
    [1, 2, 3, 4, 5].map(n => ({ number: n, year: SEASON_YEARS[n] }))
  )
  const seasonId = {}  // season_number -> uuid
  for (const s of insertedSeasons) seasonId[s.number] = s.id
  console.log(`    inserted ${insertedSeasons.length} seasons`)

  // ── 2. Players (canonical) ────────────────────────────────────────────────
  console.log('\n[2] Inserting players...')
  const insertedPlayers = await dbInsert(
    'players',
    data.players_canonical.map(name => ({ canonical_name: name }))
  )
  const playerIdByCanonical = {}  // canonical_name.lower -> uuid
  for (const p of insertedPlayers) playerIdByCanonical[p.canonical_name.toLowerCase()] = p.id
  console.log(`    inserted ${insertedPlayers.length} players`)

  // ── 3. Teams — unique (season, team_name) pairs ───────────────────────────
  console.log('\n[3] Inserting teams...')
  const teamKeySet = new Map()  // `${seasonNum}:${name}` -> row object
  function addTeam(seasonNum, name) {
    const key = `${seasonNum}:${name}`
    if (!teamKeySet.has(key)) teamKeySet.set(key, { season_id: seasonId[seasonNum], name })
  }
  for (const m of data.matches) {
    for (const teamName of m.teams) addTeam(m.season, teamName)
  }
  for (const teamName of data.s4_final_fallback.finalists) addTeam(4, teamName)

  const insertedTeams = await dbInsert('teams', [...teamKeySet.values()])
  // Rebuild lookup using season number (find it via seasonId reverse map)
  const seasonNumById = {}
  for (const [num, id] of Object.entries(seasonId)) seasonNumById[id] = Number(num)

  const teamIdBySeasonName = {}  // `${seasonNum}:${name}` -> uuid
  for (const t of insertedTeams) {
    const sNum = seasonNumById[t.season_id]
    teamIdBySeasonName[`${sNum}:${t.name}`] = t.id
  }
  console.log(`    inserted ${insertedTeams.length} teams`)

  // ── 4. Player season aliases ───────────────────────────────────────────────
  console.log('\n[4] Inserting player season aliases...')
  const aliasRows = []
  for (const a of data.aliases) {
    const playerId = playerIdByCanonical[a.canonical_name.toLowerCase()]
    if (!playerId) throw new Error(`Alias references unknown canonical player: "${a.canonical_name}"`)
    aliasRows.push({
      player_id: playerId,
      season_id: seasonId[a.season],
      registered_name: a.registered_name,
    })
  }
  await dbInsert('player_season_aliases', aliasRows)
  console.log(`    inserted ${aliasRows.length} aliases`)

  // Build alias lookup for fielder resolution:
  // `${seasonNum}:${registeredName.lower}` -> canonical_name
  const aliasToCanonical = {}
  for (const a of data.aliases) {
    aliasToCanonical[`${a.season}:${a.registered_name.toLowerCase()}`] = a.canonical_name
  }

  // Resolve a name (registered or canonical, any casing) to a player UUID.
  function resolvePlayer(name, seasonNum) {
    const clean = name.trim().replace(/^†\s*/, '').toLowerCase()
    const canonical = aliasToCanonical[`${seasonNum}:${clean}`]
    if (canonical) return playerIdByCanonical[canonical.toLowerCase()] ?? null
    return playerIdByCanonical[clean] ?? null
  }

  // ── 5. Matches ────────────────────────────────────────────────────────────
  console.log('\n[5] Inserting matches...')
  const matchRowsToInsert = []
  for (const m of data.matches) {
    matchRowsToInsert.push({
      season_id: seasonId[m.season],
      file_name: m.file_name,
      date: m.date ?? null,
      match_type: m.match_type,
      team_a_id: teamIdBySeasonName[`${m.season}:${m.teams[0]}`],
      team_b_id: teamIdBySeasonName[`${m.season}:${m.teams[1]}`],
      winner_team_id: m.winner ? (teamIdBySeasonName[`${m.season}:${m.winner}`] ?? null) : null,
      is_super_over_match: m.is_super_over_match ?? false,
      abandoned: !m.winner,
    })
  }
  // Synthetic S4 Final
  matchRowsToInsert.push({
    season_id: seasonId[4],
    file_name: 'S4_Final_synthetic',
    date: null,
    match_type: 'Final',
    team_a_id: teamIdBySeasonName[`4:${data.s4_final_fallback.finalists[0]}`],
    team_b_id: teamIdBySeasonName[`4:${data.s4_final_fallback.finalists[1]}`],
    winner_team_id: null,
    is_super_over_match: false,
    abandoned: true,
  })

  const insertedMatches = await dbInsert('matches', matchRowsToInsert)
  const matchIdByFileName = {}
  for (const im of insertedMatches) matchIdByFileName[im.file_name] = im.id
  console.log(`    inserted ${insertedMatches.length} matches (${data.matches.length} real + 1 synthetic S4 Final)`)

  // ── 6. Match squads ───────────────────────────────────────────────────────
  console.log('\n[6] Inserting match squads...')
  const squadRows = []
  let squadWarnings = 0

  function collectSquadRows(squads, seasonNum, matchId) {
    for (const [teamName, players] of Object.entries(squads)) {
      const teamId = teamIdBySeasonName[`${seasonNum}:${teamName}`]
      for (const p of players) {
        const playerId = playerIdByCanonical[p.canonical_name.toLowerCase()]
        if (!playerId) {
          console.warn(`  WARN: squad player not found: "${p.canonical_name}"`)
          squadWarnings++
          continue
        }
        squadRows.push({
          match_id: matchId,
          team_id: teamId,
          player_id: playerId,
          is_captain: p.is_captain,
          is_wk: p.is_wk,
        })
      }
    }
  }

  for (const m of data.matches) {
    collectSquadRows(m.squads, m.season, matchIdByFileName[m.file_name])
  }
  collectSquadRows(
    data.s4_final_fallback.squads,
    4,
    matchIdByFileName['S4_Final_synthetic']
  )

  await dbInsert('match_squads', squadRows)
  console.log(`    inserted ${squadRows.length} squad entries${squadWarnings ? ` (${squadWarnings} warnings)` : ''}`)

  // ── 7–10. Innings, batting, bowling, fielding ─────────────────────────────
  console.log('\n[7–10] Inserting innings, batting, bowling, fielding...')
  let totalInnings = 0, totalBatting = 0, totalBowling = 0, totalFielding = 0
  let fieldingWarnings = 0

  for (const m of data.matches) {
    const matchId = matchIdByFileName[m.file_name]

    for (const inn of m.innings) {
      // Insert one innings row and get its ID back immediately
      const [inningsRow] = await dbInsert('innings', [{
        match_id: matchId,
        batting_team_id: teamIdBySeasonName[`${m.season}:${inn.batting_team}`],
        bowling_team_id: teamIdBySeasonName[`${m.season}:${inn.bowling_team}`],
        runs: inn.runs,
        wickets: inn.wickets,
        balls: oversToBalls(inn.overs),
        is_super_over: false,
      }])
      const inningsId = inningsRow.id
      totalInnings++

      // Batting records
      const battingRows = []
      for (const b of inn.batting_rows) {
        const playerId = resolvePlayer(b.canonical_name, m.season)
        if (!playerId) {
          console.warn(`  WARN: batter not found: "${b.canonical_name}" in ${m.file_name}`)
          continue
        }
        battingRows.push({
          innings_id: inningsId,
          player_id: playerId,
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          dismissal_text: b.dismissal,
          not_out: b.not_out,
        })
      }
      if (battingRows.length > 0) {
        await dbInsert('batting_records', battingRows)
        totalBatting += battingRows.length
      }

      // Bowling records
      const bowlingRows = []
      for (const b of inn.bowling_rows) {
        const playerId = resolvePlayer(b.canonical_name, m.season)
        if (!playerId) {
          console.warn(`  WARN: bowler not found: "${b.canonical_name}" in ${m.file_name}`)
          continue
        }
        bowlingRows.push({
          innings_id: inningsId,
          player_id: playerId,
          balls_bowled: b.balls_bowled,
          runs_conceded: b.runs_conceded,
          wickets: b.wickets,
          dot_balls: b.dot_balls,
          fours_conceded: b.fours_conceded,
          sixes_conceded: b.sixes_conceded,
          wides: b.wides,
          no_balls: b.no_balls,
          maidens: b.maidens,
        })
      }
      if (bowlingRows.length > 0) {
        await dbInsert('bowling_records', bowlingRows)
        totalBowling += bowlingRows.length
      }

      // Fielding credits (parsed from batting dismissals)
      const fieldingRows = []
      for (const b of inn.batting_rows) {
        const credits = parseFieldingCredits(b.dismissal)
        for (const { name, kind } of credits) {
          const playerId = resolvePlayer(name, m.season)
          if (!playerId) {
            console.warn(`  WARN: fielder not found: "${name}" (season ${m.season}, ${m.file_name}, dismissal: "${b.dismissal}")`)
            fieldingWarnings++
            continue
          }
          fieldingRows.push({ innings_id: inningsId, player_id: playerId, kind })
        }
      }
      if (fieldingRows.length > 0) {
        await dbInsert('fielding_credits', fieldingRows)
        totalFielding += fieldingRows.length
      }
    }
  }

  console.log(`    innings:          ${totalInnings}`)
  console.log(`    batting records:  ${totalBatting}`)
  console.log(`    bowling records:  ${totalBowling}`)
  console.log(`    fielding credits: ${totalFielding}${fieldingWarnings ? ` (${fieldingWarnings} unresolved fielders)` : ''}`)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════')
  console.log('Import complete — verification')
  console.log('═══════════════════════════════════')

  const counts = await Promise.all([
    dbCount('seasons'),
    dbCount('players'),
    dbCount('teams'),
    dbCount('matches'),
    dbCount('innings'),
    dbCount('batting_records'),
    dbCount('bowling_records'),
    dbCount('fielding_credits'),
  ])
  const [seasons, players, teams, matches, innings, batting, bowling, fielding] = counts
  console.log(`  seasons:          ${seasons}`)
  console.log(`  players:          ${players}`)
  console.log(`  teams:            ${teams}`)
  console.log(`  matches:          ${matches}  (51 real + 1 synthetic S4 Final)`)
  console.log(`  innings:          ${innings}`)
  console.log(`  batting records:  ${batting}`)
  console.log(`  bowling records:  ${bowling}`)
  console.log(`  fielding credits: ${fielding}`)

  // ── Sanity: top 5 run-scorers ─────────────────────────────────────────────
  console.log('\nTop 5 run-scorers (Neeraj Sodhi should be #1 with 811 runs):')
  const { data: topRunners, error: topErr } = await supabase
    .from('batting_records')
    .select('player_id, runs')

  if (topErr) {
    console.warn('  Could not fetch batting records for sanity check:', topErr.message)
  } else {
    const totals = {}
    for (const row of topRunners) {
      totals[row.player_id] = (totals[row.player_id] ?? 0) + row.runs
    }
    const sorted = Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    // Resolve player IDs back to names
    const idToName = {}
    for (const p of insertedPlayers) idToName[p.id] = p.canonical_name

    for (let i = 0; i < sorted.length; i++) {
      const [pid, runs] = sorted[i]
      console.log(`  ${i + 1}. ${idToName[pid] ?? pid}  —  ${runs} runs`)
    }
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
