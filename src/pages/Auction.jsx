import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toPng } from 'html-to-image'
import confetti from 'canvas-confetti'
import { ballsToOvers, fmtNum, fmtHalf, computePlayerStats } from '../lib/cricketStats'

// ─── constants ────────────────────────────────────────────────────────────────

const PASSCODE = import.meta.env.VITE_AUCTION_PASSCODE ?? 'spl2026'
const SESSION_KEY = 'spl_auction_auth'
const TABS = ['Setup', 'Categories', 'Live Auction', 'Team Dashboard', 'Final Team List', 'Schedule']
const CATEGORIES = ['A', 'B', 'C', 'D']
const CATEGORY_IDEAL = 12

// ─── PasscodeGate ─────────────────────────────────────────────────────────────

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
          <h1 style={{ color: 'var(--color-heading)' }} className="text-2xl font-bold tracking-tight">
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
          {error && <p style={{ color: '#f87171' }} className="text-xs">Incorrect passcode.</p>}
          <button
            type="submit"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
            className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Enter
          </button>
        </form>
        <Link to="/" style={{ color: 'var(--color-text)' }} className="text-xs text-center hover:opacity-80 transition-opacity">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}

// ─── shared input style ───────────────────────────────────────────────────────

const inputStyle = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-heading)',
}
const inputCls = 'px-2 py-1 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500'
const enterBlur = e => e.key === 'Enter' && e.target.blur()

// ─── MappedPlayerInput ────────────────────────────────────────────────────────

function MappedPlayerInput({ mappedId, historicalPlayers, onSelect, onClear }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const currentPlayer = historicalPlayers.find(p => p.id === mappedId)
  const suggestions = focused && query.length >= 1
    ? historicalPlayers
        .filter(p => p.canonical_name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
    : []

  return (
    <div className="relative flex items-center gap-1">
      <input
        value={focused ? query : (currentPlayer?.canonical_name ?? '')}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); setQuery('') }}
        onBlur={() => { setFocused(false); setQuery('') }}
        placeholder="Search player…"
        style={{ ...inputStyle, width: 150 }}
        className={inputCls}
      />
      {currentPlayer && (
        <button
          onMouseDown={e => { e.preventDefault(); onClear(); setFocused(false) }}
          style={{ color: 'var(--color-text)' }}
          className="text-xs hover:opacity-70 px-1 flex-shrink-0"
          title="Clear"
        >
          ×
        </button>
      )}
      {focused && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          minWidth: 190, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', borderRadius: 8,
        }}>
          {suggestions.map(p => (
            <div
              key={p.id}
              onMouseDown={e => {
                e.preventDefault()
                onSelect(p.id)
                setFocused(false)
                setQuery('')
              }}
              style={{ color: 'var(--color-heading)' }}
              className="px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-500/20"
            >
              {p.canonical_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

function PlayerRow({ player, historicalPlayers, onUpdate, onMultiUpdate, onDelete, rowBg }) {
  const [name, setName] = useState(player.name)
  const [basePrice, setBasePrice] = useState(player.base_price)

  useEffect(() => setName(player.name), [player.name])
  useEffect(() => setBasePrice(player.base_price), [player.base_price])

  async function save(field, value) {
    const { error } = await supabase.from('s6_players').update({ [field]: value }).eq('id', player.id)
    if (error) console.error('save player', field, error.message)
    else onUpdate(player.id, field, value)
  }

  async function saveMulti(updates) {
    const { error } = await supabase.from('s6_players').update(updates).eq('id', player.id)
    if (error) console.error('save player multi', error.message)
    else onMultiUpdate(player.id, updates)
  }

  return (
    <tr style={{ background: rowBg, borderBottom: '1px solid var(--color-border)' }}>
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => save('name', name)}
          onKeyDown={enterBlur}
          style={{ ...inputStyle, width: 170 }}
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={player.category}
          onChange={e => save('category', e.target.value)}
          style={{ ...inputStyle, width: 60 }}
          className={inputCls}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={basePrice}
          onChange={e => setBasePrice(e.target.value)}
          onBlur={() => save('base_price', Number(basePrice))}
          onKeyDown={enterBlur}
          style={{ ...inputStyle, width: 80 }}
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2">
        <MappedPlayerInput
          mappedId={player.mapped_player_id}
          historicalPlayers={historicalPlayers}
          onSelect={id => saveMulti({ mapped_player_id: id, is_debut: false })}
          onClear={() => saveMulti({ mapped_player_id: null })}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={player.is_debut}
          onChange={e =>
            saveMulti(e.target.checked
              ? { is_debut: true, mapped_player_id: null }
              : { is_debut: false })
          }
          className="cursor-pointer"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={() => onDelete(player.id)}
          style={{ color: '#f87171' }}
          className="text-xs hover:opacity-70 transition-opacity"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

// ─── CategoryCounter ──────────────────────────────────────────────────────────

function CategoryCounter({ players }) {
  const counts = { A: 0, B: 0, C: 0, D: 0 }
  for (const p of players) if (p.category in counts) counts[p.category]++

  return (
    <div className="flex flex-wrap gap-5 text-xs">
      {CATEGORIES.map(c => {
        const n = counts[c]
        const need = CATEGORY_IDEAL - n
        return (
          <span key={c} style={{ color: 'var(--color-text)' }}>
            <span style={{ color: 'var(--color-heading)' }} className="font-semibold">{c}:</span>{' '}
            <span style={{ color: need > 0 ? '#f59e0b' : '#34d399' }} className="font-semibold">{n}</span>
            {need > 0 && <span style={{ color: '#f59e0b' }}> / {CATEGORY_IDEAL} (need {need})</span>}
          </span>
        )
      })}
    </div>
  )
}

// ─── TeamRow ──────────────────────────────────────────────────────────────────

function TeamRow({ team, s6Players, allTeams, onUpdate, onDelete, rowBg }) {
  const [name, setName] = useState(team.name)
  const [color, setColor] = useState(team.color)
  const [budget, setBudget] = useState(team.budget_total)

  useEffect(() => setName(team.name), [team.name])
  useEffect(() => setColor(team.color), [team.color])
  useEffect(() => setBudget(team.budget_total), [team.budget_total])

  async function save(field, value) {
    const { error } = await supabase.from('s6_teams').update({ [field]: value }).eq('id', team.id)
    if (error) console.error('save team', field, error.message)
    else onUpdate(team.id, field, value)
  }

  const takenCaptainIds = new Set(
    allTeams.filter(t => t.id !== team.id && t.captain_s6_player_id).map(t => t.captain_s6_player_id)
  )
  const captainOptions = s6Players.filter(p => !takenCaptainIds.has(p.id))

  return (
    <tr style={{ background: rowBg, borderBottom: '1px solid var(--color-border)' }}>
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => save('name', name)}
          onKeyDown={enterBlur}
          style={{ ...inputStyle, width: 160 }}
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          onBlur={() => save('color', color)}
          style={{ width: 40, height: 28, cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: 4, padding: 2, background: 'transparent' }}
          title={color}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={team.captain_s6_player_id ?? ''}
          onChange={e => save('captain_s6_player_id', e.target.value || null)}
          style={{ ...inputStyle, minWidth: 160 }}
          className={inputCls}
        >
          <option value="">— No captain —</option>
          {captainOptions.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={budget}
          onChange={e => setBudget(e.target.value)}
          onBlur={() => save('budget_total', Number(budget))}
          onKeyDown={enterBlur}
          style={{ ...inputStyle, width: 90 }}
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={() => onDelete(team.id)}
          style={{ color: '#f87171' }}
          className="text-xs hover:opacity-70 transition-opacity"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

// ─── SetupStatus ──────────────────────────────────────────────────────────────

function SetupStatus({ players, teams }) {
  const captainsAssigned = teams.filter(t => t.captain_s6_player_id).length
  const allHaveBudget = teams.length > 0 && teams.every(t => t.budget_total > 0)

  const items = [
    { label: `${players.length} player${players.length !== 1 ? 's' : ''}`, ok: players.length > 0 },
    { label: `${teams.length} team${teams.length !== 1 ? 's' : ''}`, ok: teams.length > 0 },
    { label: `${captainsAssigned} / ${teams.length} captains assigned`, ok: teams.length > 0 && captainsAssigned === teams.length },
    { label: 'All teams have budget', ok: allHaveBudget },
  ]

  return (
    <div
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      className="rounded-lg px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 items-center"
    >
      <span style={{ color: 'var(--color-text)' }} className="text-xs uppercase tracking-wider font-semibold">
        Setup Status
      </span>
      {items.map(({ label, ok }) => (
        <span key={label} style={{ color: ok ? '#34d399' : '#f59e0b' }} className="text-xs font-medium">
          {ok ? '✓' : '○'} {label}
        </span>
      ))}
    </div>
  )
}

// ─── AddRow button ────────────────────────────────────────────────────────────

function AddRowButton({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginTop: 8,
        background: 'var(--color-accent-dim)',
        color: 'var(--color-accent)',
        border: '1px dashed var(--color-accent)',
      }}
      className="w-full py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
    >
      {label}
    </button>
  )
}

// ─── SetupTab ─────────────────────────────────────────────────────────────────

function SetupTab() {
  const [s6Players, setS6Players] = useState([])
  const [s6Teams, setS6Teams] = useState([])
  const [historicalPlayers, setHistoricalPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [p6Res, t6Res, hpRes] = await Promise.all([
          supabase.from('s6_players').select('*').order('created_at'),
          supabase.from('s6_teams').select('*').order('created_at'),
          supabase.from('players').select('id, canonical_name').order('canonical_name'),
        ])
        if (p6Res.error) throw p6Res.error
        if (t6Res.error) throw t6Res.error
        if (hpRes.error) throw hpRes.error
        setS6Players(p6Res.data)
        setS6Teams(t6Res.data)
        setHistoricalPlayers(hpRes.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── player CRUD ──────────────────────────────────────────────────────────────

  function updatePlayer(id, field, value) {
    setS6Players(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function multiUpdatePlayer(id, updates) {
    setS6Players(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  async function addPlayer() {
    const { data, error } = await supabase
      .from('s6_players')
      .insert({ name: 'New Player', category: 'A', base_price: 100 })
      .select().single()
    if (error) console.error('add player', error.message)
    else setS6Players(prev => [...prev, data])
  }

  async function deletePlayer(id) {
    const { error } = await supabase.from('s6_players').delete().eq('id', id)
    if (error) console.error('delete player', error.message)
    else setS6Players(prev => prev.filter(p => p.id !== id))
  }

  // ── team CRUD ────────────────────────────────────────────────────────────────

  function updateTeam(id, field, value) {
    setS6Teams(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  async function addTeam() {
    const { data, error } = await supabase
      .from('s6_teams')
      .insert({ name: 'New Team', color: '#6b7280', budget_total: 1000 })
      .select().single()
    if (error) console.error('add team', error.message)
    else setS6Teams(prev => [...prev, data])
  }

  async function deleteTeam(id) {
    const { error } = await supabase.from('s6_teams').delete().eq('id', id)
    if (error) console.error('delete team', error.message)
    else setS6Teams(prev => prev.filter(t => t.id !== id))
  }

  // ── render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <span style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading…</span>
    </div>
  )
  if (error) return <p style={{ color: '#f87171' }} className="text-sm">{error}</p>

  const thStyle = { color: 'var(--color-text)', borderRight: '1px solid var(--color-border)' }
  const thCls = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap'
  const tableWrap = { border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }

  return (
    <div className="flex flex-col gap-10">

      {/* Players section */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 style={{ color: 'var(--color-heading)' }} className="text-sm font-semibold uppercase tracking-wider">
            Players ({s6Players.length})
          </h2>
        </div>
        <CategoryCounter players={s6Players} />
        <div className="overflow-x-auto mt-3" style={tableWrap}>
          <table className="text-sm border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}>
                {['Name', 'Category', 'Base Price', 'Mapped Player', 'Debut', ''].map(h => (
                  <th key={h} style={thStyle} className={thCls}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s6Players.map((p, i) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  historicalPlayers={historicalPlayers}
                  onUpdate={updatePlayer}
                  onMultiUpdate={multiUpdatePlayer}
                  onDelete={deletePlayer}
                  rowBg={i % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)'}
                />
              ))}
            </tbody>
          </table>
        </div>
        <AddRowButton onClick={addPlayer} label="+ Add Player" />
      </section>

      {/* Teams section */}
      <section>
        <h2 style={{ color: 'var(--color-heading)' }} className="text-sm font-semibold uppercase tracking-wider mb-3">
          Teams ({s6Teams.length})
        </h2>
        <div className="overflow-x-auto" style={tableWrap}>
          <table className="text-sm border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}>
                {['Team Name', 'Color', 'Captain', 'Budget', ''].map(h => (
                  <th key={h} style={thStyle} className={thCls}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s6Teams.map((t, i) => (
                <TeamRow
                  key={t.id}
                  team={t}
                  s6Players={s6Players}
                  allTeams={s6Teams}
                  onUpdate={updateTeam}
                  onDelete={deleteTeam}
                  rowBg={i % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)'}
                />
              ))}
            </tbody>
          </table>
        </div>
        <AddRowButton onClick={addTeam} label="+ Add Team" />
      </section>

      <SetupStatus players={s6Players} teams={s6Teams} />
    </div>
  )
}

// ─── CategoriesTab ────────────────────────────────────────────────────────────

// Hardcoded palette — CSS variables are not reliable inside html-to-image canvas
const BG       = '#060608'
const SURFACE  = '#0e0e10'
const BORDER   = 'rgba(255,255,255,0.07)'
const MUTED    = 'rgba(250,250,250,0.52)'
const HEADING  = '#f5f5f5'
const ACCENT   = '#4d8eff'
const GOLD     = '#FFC940'

const CAT_PALETTE = {
  A: { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)',  text: '#93c5fd',  label: '#bfdbfe' },
  B: { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#6ee7b7',  label: '#a7f3d0' },
  C: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#fcd34d',  label: '#fde68a' },
  D: { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.35)',  text: '#c4b5fd',  label: '#ddd6fe' },
}

const COLUMN_BIDDING = {
  A: { base: '2,000', inc: '500' },
  B: { base: '1,000', inc: '300' },
  C: { base: '500',   inc: '200' },
  D: { base: '200',   inc: '100' },
}

// Returns '#fff' or '#111' based on background hex luminance
function captainTextColor(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return lum > 0.35 ? '#111111' : '#ffffff'
  } catch { return '#ffffff' }
}

// Lighten a team color until it's readable against the dark background (#0f1117)
function readableTeamColor(hex) {
  try {
    let r = parseInt(hex.slice(1, 3), 16)
    let g = parseInt(hex.slice(3, 5), 16)
    let b = parseInt(hex.slice(5, 7), 16)
    const lum = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    const luminance = () => 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b)
    if (luminance() >= 0.08) return hex
    for (let t = 0.2; t <= 1; t += 0.1) {
      r = Math.round(r + (255 - r) * t)
      g = Math.round(g + (255 - g) * t)
      b = Math.round(b + (255 - b) * t)
      if (luminance() >= 0.08) return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
    }
    return '#9ca3af'
  } catch { return hex }
}

function teamLogoSrc(teamName) {
  return `/team-logos/${teamName.toLowerCase().replace(/\s+/g, '-')}.png`
}

// White circular logo container — logos have light backgrounds, looks intentional on dark theme
function TeamLogo({ teamName, size = 40 }) {
  const [failed, setFailed] = useState(false)
  if (failed) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: Math.round(size * 0.1), boxSizing: 'border-box', overflow: 'hidden' }}>
      <img
        src={teamLogoSrc(teamName)}
        alt={teamName}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}

// Inline (non-state) logo for export-safe contexts (toPng can't wait for state updates)
function TeamLogoInline({ teamName, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: Math.round(size * 0.1), boxSizing: 'border-box', overflow: 'hidden' }}>
      <img
        src={teamLogoSrc(teamName)}
        alt={teamName}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}

function CategoryColumn({ category, players }) {
  const pal = CAT_PALETTE[category]
  const bid = COLUMN_BIDDING[category]
  return (
    <div className="themed-card" style={{
      background: pal.bg,
      border: `1px solid ${pal.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* column header */}
      <div style={{
        borderBottom: `1px solid ${pal.border}`,
        padding: '10px 14px',
        textAlign: 'center',
      }}>
        <span style={{ color: pal.label, fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Category {category}
        </span>
      </div>

      {/* player list */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {players.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
            No players assigned
          </p>
        ) : players.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 26, overflow: 'hidden' }}>
            <span style={{ color: MUTED, fontSize: 11, minWidth: 20, textAlign: 'right', flexShrink: 0 }}>
              {i + 1}.
            </span>
            <span style={{ color: HEADING, fontSize: 14, whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
        ))}
      </div>

      {/* bidding footer */}
      <div style={{ borderTop: `1px solid ${pal.border}`, padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: MUTED, fontSize: 10.5 }}>Base price: <span style={{ color: pal.text, fontWeight: 600 }}>{bid.base}</span></span>
        <span style={{ color: MUTED, fontSize: 10.5 }}>Increments by <span style={{ color: pal.text, fontWeight: 600 }}>{bid.inc}</span></span>
      </div>
    </div>
  )
}

function CategoriesTab() {
  const captureRef = useRef(null)
  const [s6Players, setS6Players] = useState([])
  const [s6Teams, setS6Teams] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [pRes, tRes] = await Promise.all([
          supabase.from('s6_players').select('*').order('name'),
          supabase.from('s6_teams').select('*').order('name'),
        ])
        if (pRes.error) throw pRes.error
        if (tRes.error) throw tRes.error
        setS6Players(pRes.data)
        setS6Teams(tRes.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const captainMap = useMemo(() => {
    const m = new Map()
    for (const t of s6Teams) if (t.captain_s6_player_id) m.set(t.captain_s6_player_id, t.name)
    return m
  }, [s6Teams])

  const captainCards = useMemo(() => s6Teams
    .filter(t => t.captain_s6_player_id)
    .map(t => {
      const captain = s6Players.find(p => p.id === t.captain_s6_player_id)
      return { teamName: t.name, teamColor: t.color, captainName: captain?.name ?? '—' }
    }),
  [s6Teams, s6Players])

  const byCategory = useMemo(() => {
    const m = { A: [], B: [], C: [], D: [] }
    for (const p of s6Players) if (p.category in m) m[p.category].push(p)
    return m
  }, [s6Players])

  const budgetDisplay = useMemo(() => {
    const budgets = s6Teams.map(t => t.budget_total).filter(Boolean)
    if (!budgets.length) return 'TBD'
    if (budgets.every(b => b === budgets[0])) return budgets[0].toLocaleString()
    return `${Math.min(...budgets).toLocaleString()}–${Math.max(...budgets).toLocaleString()}`
  }, [s6Teams])

  const maxBudget = useMemo(() => {
    const budgets = s6Teams.map(t => t.budget_total).filter(Boolean)
    return budgets.length ? Math.max(...budgets).toLocaleString() : null
  }, [s6Teams])

  async function handleExport() {
    if (!captureRef.current || exporting) return
    setExporting(true)
    try {
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: BG,
        skipFonts: false,
      })
      const a = document.createElement('a')
      a.download = 'spl-s6-players.png'
      a.href = dataUrl
      a.click()
    } catch (err) {
      console.error('export failed', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <span style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading…</span>
    </div>
  )
  if (error) return <p style={{ color: '#f87171' }} className="text-sm">{error}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Capture area — button is intentionally outside */}
      <div
        ref={captureRef}
        style={{
          background: BG,
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img
            src="/spl-logo.svg"
            alt="SPL"
            style={{ height: 72, width: 'auto', flexShrink: 0 }}
          />
          <div>
            <h1 style={{ color: HEADING, fontSize: 20, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
              Superball Premier League — Season 6 Players List
            </h1>
            <p style={{ color: MUTED, fontSize: 13, marginTop: 14, marginBottom: 0 }}>
              Auction date: 1st May, 9:30 PM (Bangkok time)
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: BORDER }} />

        {/* Captains strip + budget context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {captainCards.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              {captainCards.map(card => {
                const fg = captainTextColor(card.teamColor)
                return (
                  <div
                    key={card.teamName}
                    style={{
                      flex: 1, minWidth: 0,
                      background: card.teamColor,
                      border: '2px solid rgba(255,255,255,0.35)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <TeamLogoInline teamName={card.teamName} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: fg, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                          {card.captainName}
                        </div>
                        <div style={{ color: fg, fontSize: 11, opacity: 0.72, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {card.teamName}
                        </div>
                      </div>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>👑</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {maxBudget && (
            <p style={{ color: MUTED, fontSize: 11, textAlign: 'left', margin: 0 }}>
              Total auction budget: <span style={{ color: '#9ca3af', fontWeight: 600 }}>{maxBudget}</span> per team
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: BORDER }} />

        {/* Four columns */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
          {CATEGORIES.map(cat => (
            <CategoryColumn
              key={cat}
              category={cat}
              players={byCategory[cat]}
            />
          ))}
        </div>

      </div>

      {/* Export button — below capture area, centred, not included in PNG */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            background: exporting ? 'var(--color-surface)' : 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 13,
            fontWeight: 600,
            cursor: exporting ? 'default' : 'pointer',
            opacity: exporting ? 0.6 : 1,
          }}
        >
          {exporting ? 'Exporting…' : '↓ Export PNG'}
        </button>
      </div>
    </div>
  )
}

// ─── ScheduleTab ──────────────────────────────────────────────────────────────

const GROUP_STAGE_8_OVER = [
  { teamA: 'C', teamB: 'A', start: '08:30', end: '09:20' },
  { teamA: 'E', teamB: 'B', start: '09:25', end: '10:15' },
  { teamA: 'D', teamB: 'A', start: '10:20', end: '11:10' },
  { teamA: 'C', teamB: 'E', start: '11:15', end: '12:05' },
  { teamA: 'B', teamB: 'D', start: '12:10', end: '13:00' },
]
const GROUP_STAGE_4_OVER = [
  { teamA: 'A', teamB: 'E', start: '13:30', end: '13:55' },
  { teamA: 'C', teamB: 'D', start: '14:00', end: '14:25' },
  { teamA: 'A', teamB: 'B', start: '14:30', end: '14:55' },
  { teamA: 'B', teamB: 'C', start: '15:00', end: '15:25' },
  { teamA: 'D', teamB: 'E', start: '15:30', end: '15:55' },
]
const KNOCKOUTS = [
  { name: 'Qualifier 1',  start: '16:10', end: '17:10', format: '8-over', desc: 'Top 2 from group stage' },
  { name: 'Eliminator 1', start: '17:15', end: '18:15', format: '8-over', desc: '3rd vs 4th from group stage' },
  { name: 'Qualifier 2',  start: '18:20', end: '19:20', format: '8-over', desc: 'Loser Q1 vs Winner Elim 1' },
  { name: 'Final',        start: '19:25', end: '20:25', format: '8-over', desc: 'Winner Q1 vs Winner Q2' },
]

const TEAM_LETTERS = {
  A: 'Bangkok Titans',
  B: 'Bangkok Super Kings',
  C: 'Bangkok Indians',
  D: 'Bangkok Royals',
  E: 'Royal Challengers Bangkok',
}

// Drop "Bangkok" (prefix or suffix) so names fit in match rows.
function shortTeamName(fullName) {
  return fullName.replace(/^Bangkok\s+/, '').replace(/\s+Bangkok$/, '').trim()
}

function TeamCell({ letter }) {
  const fullName = TEAM_LETTERS[letter] ?? letter
  const short = shortTeamName(fullName)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <TeamLogoInline teamName={fullName} size={22} />
      <span style={{ color: HEADING, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {short}
      </span>
    </span>
  )
}

function MatchRow({ match, format }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ color: MUTED, fontFamily: 'ui-monospace, Cascadia Code, Consolas, monospace', fontSize: 13, fontVariantNumeric: 'tabular-nums', minWidth: 110, flexShrink: 0 }}>
        {match.start} – {match.end}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <TeamCell letter={match.teamA} />
        <span style={{ color: MUTED, fontSize: 12, fontWeight: 400, flexShrink: 0 }}>vs</span>
        <TeamCell letter={match.teamB} />
      </span>
      <span style={{ color: MUTED, fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0 }}>
        {format}
      </span>
    </div>
  )
}

function SectionLabel({ children, accent = false }) {
  return (
    <p style={{ color: accent ? GOLD : MUTED, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, padding: '10px 16px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: accent ? GOLD : ACCENT, fontSize: 9 }}>•</span> {children}
    </p>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'rgba(255,255,255,0.025)', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ color: MUTED, fontSize: 11, fontStyle: 'italic' }}>{label}</span>
    </div>
  )
}

export function ScheduleTab() {
  const captureRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (!captureRef.current || exporting) return
    setExporting(true)
    try {
      const dataUrl = await toPng(captureRef.current, { pixelRatio: 2, backgroundColor: BG, skipFonts: false })
      const a = document.createElement('a')
      a.download = 'spl-s6-schedule.png'
      a.href = dataUrl
      a.click()
    } catch (err) {
      console.error('schedule export failed', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Capture area */}
      <div ref={captureRef} style={{ background: BG, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src="/spl-logo.svg" alt="SPL" style={{ height: 64, width: 'auto', flexShrink: 0 }} />
          <div>
            <h1 style={{ color: HEADING, fontSize: 20, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
              Superball Premier League — Season 6 Schedule
            </h1>
            <p style={{ color: MUTED, fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              Tournament Date: June 13th, 2026
            </p>
          </div>
        </div>

        <div style={{ height: 1, background: BORDER }} />

        {/* Group Stage */}
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: GOLD, fontSize: 9 }}>•</span> Group Stage
          </p>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', background: SURFACE }}>
            <SectionLabel>8-over matches · morning</SectionLabel>
            {GROUP_STAGE_8_OVER.map((m, i) => (
              <MatchRow key={i} match={m} format="8-over" />
            ))}
            <Divider label="30 mins lunch break" />
            <SectionLabel>4-over matches · afternoon</SectionLabel>
            {GROUP_STAGE_4_OVER.map((m, i) => (
              <MatchRow key={i} match={m} format="4-over" />
            ))}
          </div>
        </div>

        {/* Break */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <span style={{ color: MUTED, fontSize: 11, fontStyle: 'italic', whiteSpace: 'nowrap' }}>15 mins break before playoffs</span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        {/* Knockouts */}
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: GOLD, fontSize: 9 }}>•</span> Knockouts
          </p>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* Match list */}
            <div style={{ flex: '0 0 55%', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', background: SURFACE }}>
              {KNOCKOUTS.map((k, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < KNOCKOUTS.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  <span style={{ color: MUTED, fontFamily: 'ui-monospace, Cascadia Code, Consolas, monospace', fontSize: 13, fontVariantNumeric: 'tabular-nums', minWidth: 110, flexShrink: 0 }}>
                    {k.start} – {k.end}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: HEADING, fontSize: 14, fontWeight: 700 }}>{k.name}</div>
                    <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{k.desc}</div>
                  </div>
                  <span style={{ color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>{k.format}</span>
                </div>
              ))}
            </div>

            {/* Qualification rules */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ color: MUTED, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: ACCENT, fontSize: 9 }}>•</span> Qualification rules
              </p>
              {[
                { label: 'Q1',    rule: 'Top 2 teams play. Winner goes straight to the Final.' },
                { label: 'Elim',  rule: '3rd and 4th play. Loser is eliminated.' },
                { label: 'Q2',    rule: 'Loser of Q1 vs Winner of Elim. Winner goes to the Final.' },
                { label: 'Final', rule: 'Winner of Q1 vs Winner of Q2.' },
              ].map(({ label, rule }) => (
                <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: ACCENT, fontSize: 11, fontWeight: 700, minWidth: 36, flexShrink: 0 }}>{label}</span>
                  <span style={{ color: MUTED, fontSize: 12, lineHeight: 1.5 }}>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Export button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ background: exporting ? SURFACE : '#4d8eff', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1 }}
        >
          {exporting ? 'Exporting…' : '↓ Export PNG'}
        </button>
      </div>
    </div>
  )
}

// ─── LiveAuctionTab ───────────────────────────────────────────────────────────

const MAX_SLOTS = 8
const MAX_PURCHASES = 7 // captain fills 1 of 8 slots
const BID_INCREMENT = { A: 500, B: 300, C: 200, D: 100 }

// Shape X = 1A·3B·3C·1D  Shape Y = 2A·2B·2C·2D  (captain pre-counts as 1B)
const CAT_MAX = {
  null: { A: 2, B: 3, C: 3, D: 2 },
  X:    { A: 1, B: 3, C: 3, D: 1 },
  Y:    { A: 2, B: 2, C: 2, D: 2 },
}

// Round avg to nearest increment — half-down (floor of avg + inc/2)
// e.g. avg=3950, inc=300 → floor(4100/300)*300 = 3900
const roundToNearest = (avg, inc) => Math.floor((avg + inc / 2) / inc) * inc

// Compact stat display for the player card
function LiveStatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{ color: 'var(--color-text)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function LiveStatBlock({ title, rows, emptyMsg }) {
  return (
    <div className="themed-card" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-card-border)', borderRadius: 8, padding: '10px 12px', flex: 1, minWidth: 0 }}>
      <p style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--color-accent)', fontSize: 9 }}>•</span>{title}
      </p>
      {emptyMsg
        ? <p style={{ color: 'var(--color-text)', fontSize: 12, fontStyle: 'italic', margin: 0 }}>{emptyMsg}</p>
        : rows.map(r => <LiveStatRow key={r.label} label={r.label} value={r.value} />)
      }
    </div>
  )
}

function LiveStatBlockSkeleton({ rows }) {
  return (
    <div className="themed-card" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-card-border)', borderRadius: 8, padding: '10px 12px', flex: 1, minWidth: 0 }}>
      <div style={{ height: 9, width: 44, background: 'var(--color-border)', borderRadius: 3, marginBottom: 10 }} className="animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <div style={{ height: 7, width: 38, background: 'var(--color-border)', borderRadius: 3 }} className="animate-pulse" />
          <div style={{ height: 11, width: 26, background: 'var(--color-border)', borderRadius: 3 }} className="animate-pulse" />
        </div>
      ))}
    </div>
  )
}

const TAG_PALETTE = {
  run:    { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', border: 'rgba(59,130,246,0.4)'  },
  wicket: { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', border: 'rgba(239,68,68,0.4)'   },
  hs:     { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.4)'  },
  bb:     { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c', border: 'rgba(251,146,60,0.4)'  },
  final:  { bg: 'rgba(192,132,252,0.15)', color: '#c084fc', border: 'rgba(192,132,252,0.4)' },
  catch:  { bg: 'rgba(52,211,153,0.15)',  color: '#34d399', border: 'rgba(52,211,153,0.4)'  },
}
function tagPalette(label) {
  if (/run|scorer/i.test(label))   return TAG_PALETTE.run
  if (/wicket/i.test(label))       return TAG_PALETTE.wicket
  if (/score|Highest/i.test(label)) return TAG_PALETTE.hs
  if (/bowling/i.test(label))      return TAG_PALETTE.bb
  if (/final/i.test(label))        return TAG_PALETTE.final
  if (/catch/i.test(label))        return TAG_PALETTE.catch
  return TAG_PALETTE.run
}

function PlayerStatCard({ player, stats, statsLoading, tags }) {
  const pal = CAT_PALETTE[player.category]

  const battingRows = stats && [
    { label: 'Matches',     value: stats.matches },
    { label: 'Innings',     value: stats.bat_innings },
    { label: 'Runs',        value: stats.runs },
    { label: 'Avg',         value: fmtNum(stats.avg_num) },
    { label: 'SR',          value: fmtNum(stats.sr_num) },
    { label: 'HS',          value: stats.hs_display },
    { label: '4s',          value: stats.fours },
    { label: '6s',          value: stats.sixes },
    { label: '30+ / 50+',   value: `${stats.thirties} / ${stats.fifties}` },
  ]

  const bowlingRows = stats && [
    { label: 'Innings',     value: stats.bowl_innings },
    { label: 'Overs',       value: ballsToOvers(stats.balls_bowled) },
    { label: 'Wickets',     value: stats.wickets },
    { label: 'BB',          value: stats.bb_display },
    { label: 'Avg',         value: fmtNum(stats.bowl_avg_num) },
    { label: 'Eco',         value: fmtNum(stats.eco_num) },
    { label: 'Dot%',        value: fmtNum(stats.dot_pct_num, 1) },
  ]

  const fieldingRows = stats && [
    { label: 'Catches',     value: stats.catches },
    { label: 'Stumpings',   value: stats.stumpings },
    { label: 'Run Outs',    value: stats.run_outs },
  ]

  return (
    <div className="themed-card" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Name + pills */}
      <div>
        <h2 style={{ color: 'var(--color-heading)', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>{player.name}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {player.is_debut && (
            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.45)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
              Debut
            </span>
          )}
          {(tags || []).map(tag => {
            const tp = tagPalette(tag)
            return (
              <span key={tag} style={{ background: tp.bg, color: tp.color, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}>
                {tag}
              </span>
            )
          })}
        </div>
      </div>

      {/* Stats body — container height is always reserved to prevent reflow */}
      {player.is_debut ? (
        <p style={{ color: 'var(--color-text)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
          Debut player — no historical record
        </p>
      ) : (
        <>
          {/* Captaincy strip — compact secondary row above stat blocks */}
          {!statsLoading && stats?.times_captained > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
                👑 Captained {stats.times_captained}
              </span>
              <span style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
                Win% {fmtNum(stats.capt_win_pct_num, 1)}
              </span>
              <span style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
                {stats.final_appearances} final{stats.final_appearances !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Fixed-height stat block container: skeleton → data, never reflowing */}
          <div style={{ display: 'flex', gap: 8, minHeight: 280 }}>
            {statsLoading ? (
              <>
                <LiveStatBlockSkeleton rows={9} />
                <LiveStatBlockSkeleton rows={7} />
                <LiveStatBlockSkeleton rows={3} />
              </>
            ) : !stats ? (
              <>
                <LiveStatBlock title="Batting"  rows={Array.from({ length: 9 }, () => ({ label: '—', value: '—' }))} />
                <LiveStatBlock title="Bowling"  rows={Array.from({ length: 7 }, () => ({ label: '—', value: '—' }))} />
                <LiveStatBlock title="Fielding" rows={Array.from({ length: 3 }, () => ({ label: '—', value: '—' }))} />
              </>
            ) : (
              <>
                <LiveStatBlock title="Batting"  rows={battingRows}  emptyMsg={stats.bat_innings  === 0 ? 'Did not bat'  : null} />
                <LiveStatBlock title="Bowling"  rows={bowlingRows}  emptyMsg={stats.bowl_innings === 0 ? 'Did not bowl' : null} />
                <LiveStatBlock title="Fielding" rows={fieldingRows} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CategoryRosterPanel({ category, players, activeId, soldIds, salesMap, teamInfo }) {
  const pal = CAT_PALETTE[category]
  const left = players.filter(p => !soldIds.has(p.id)).length
  const teamById = Object.fromEntries(teamInfo.map(t => [t.id, t]))
  return (
    <div className="themed-card" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: 12, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ background: pal.bg, borderBottom: `1px solid ${pal.border}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ color: pal.label, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
          Category {category}
        </span>
        <span style={{ color: pal.label, background: 'transparent', border: `1px solid ${pal.border.replace('0.35', '0.6')}`, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {left} / {players.length} LEFT
        </span>
      </div>
      <div style={{ padding: '6px 0', overflowY: 'auto', flex: 1, minHeight: 0, scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
        {players.map(p => {
          const isSold = soldIds.has(p.id)
          const isActive = p.id === activeId
          const sale = salesMap[p.id]
          const saleTeam = sale ? teamById[sale.s6_team_id] : null
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px',
              background: isActive ? 'rgba(255,200,64,0.07)' : 'transparent',
              borderLeft: isActive ? '3px solid #FFC940' : '3px solid transparent',
            }}>
              <span style={{
                color: isSold ? 'var(--color-text)' : isActive ? '#FFC940' : 'var(--color-heading)',
                fontSize: 18, fontWeight: isActive ? 700 : 500,
                textDecoration: isSold ? 'line-through' : 'none',
                flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {p.name}
              </span>
              {isActive && !isSold && (
                <span style={{ color: '#FFC940', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>● Ongoing</span>
              )}
              {isSold && saleTeam && (
                <span style={{ color: 'var(--color-text)', fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  → {saleTeam.name} · {Number(sale.price).toLocaleString()}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LiveAuctionTab({ selected, setSelected, currentBid, setCurrentBid, highBidder, setHighBidder }) {
  // ── data ──────────────────────────────────────────────────────────────────
  const [s6Players, setS6Players] = useState([])
  const [s6Teams,   setS6Teams]   = useState([])
  const [sales,     setSales]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  // ── player selection + stats ───────────────────────────────────────────────
  // selected / currentBid / highBidder are lifted to AuctionApp (persist across tab switches)
  const [stats,        setStats]        = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statTags,     setStatTags]     = useState(null) // { [mapped_player_id]: string[] }

  // ── search ────────────────────────────────────────────────────────────────
  const [searchQuery,       setSearchQuery]       = useState('')
  const [searchOpen,        setSearchOpen]        = useState(false)
  const [showBiddingSearch, setShowBiddingSearch] = useState(false)
  const selecting = useRef(false)

  // ── bidding ───────────────────────────────────────────────────────────────
  const [displayBid,      setDisplayBid]      = useState(currentBid) // init from prop on mount
  const [pulsePaddle,     setPulsePaddle]     = useState(null)
  const [paddleWinningId, setPaddleWinningId] = useState(null)
  const bidAnimRef           = useRef(null)
  const paddleWinningTimerRef = useRef(null)

  // ── selling ───────────────────────────────────────────────────────────────
  const [selling,  setSelling]  = useState(false)
  const [lastSale, setLastSale] = useState(null) // { saleId, playerName, teamName, price, teamColor }

  // ── celebration overlay ───────────────────────────────────────────────────
  const [soldOverlay,    setSoldOverlay]    = useState(null)
  const [searchBarVisible, setSearchBarVisible] = useState(true)
  const soldOverlayRef = useRef(null)

  // ── manual bid ────────────────────────────────────────────────────────────
  const [showManualBid,  setShowManualBid]  = useState(false)
  const [manualBidInput, setManualBidInput] = useState('')
  const [manualBidTeamId,setManualBidTeamId]= useState('')

  // ── undo confirm ──────────────────────────────────────────────────────────
  const [undoConfirm, setUndoConfirm] = useState(false)

  // ── manual override ───────────────────────────────────────────────────────
  const [showOverride,  setShowOverride]  = useState(false)
  const [avgOverrides,  setAvgOverrides]  = useState({ A: null, B: null, C: null, D: null })
  const [draftOverrides, setDraftOverrides] = useState({ A: '', B: '', C: '', D: '' })
  const [forceAllowTeamId, setForceAllowTeamId] = useState(null)

  // ── budget warning ────────────────────────────────────────────────────────
  const [showBudgetWarn, setShowBudgetWarn] = useState(null) // { teamId, teamName, remaining, bid }

  // ── random allocation ─────────────────────────────────────────────────────
  const [showRandomAlloc,   setShowRandomAlloc]   = useState(false)
  const [randomAllocPlayer, setRandomAllocPlayer] = useState('')
  const [randomAllocTeam,   setRandomAllocTeam]   = useState('')

  // ── toast ─────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState('')

  // ── reset auction ─────────────────────────────────────────────────────────
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  const searchRef = useRef(null)

  // ── initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [pRes, tRes, sRes] = await Promise.all([
          supabase.from('s6_players').select('*').order('name'),
          supabase.from('s6_teams').select('*').order('name'),
          supabase.from('auction_sales').select('*'),
        ])
        if (pRes.error) throw pRes.error
        if (tRes.error) throw tRes.error
        if (sRes.error) throw sRes.error
        setS6Players(pRes.data)
        setS6Teams(tRes.data)
        setSales(sRes.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── compute stat-ranking tags once after s6Players loads ────────────────────

  useEffect(() => {
    if (!s6Players.length || statTags !== null) return
    const mappedIds = s6Players.map(p => p.mapped_player_id).filter(Boolean)
    if (!mappedIds.length) { setStatTags({}); return }

    async function computeStatTags() {
      const [batRes, bowlRes, fieldRes, squadRes] = await Promise.all([
        supabase.from('batting_records').select('player_id, runs').in('player_id', mappedIds),
        supabase.from('bowling_records').select('player_id, wickets, runs_conceded').in('player_id', mappedIds),
        supabase.from('fielding_credits').select('player_id, kind').in('player_id', mappedIds),
        supabase.from('match_squads').select('player_id, matches!inner(match_type, abandoned)').in('player_id', mappedIds),
      ])
      const totRuns = {}, hs = {}, totWick = {}, bestBowl = {}, finCt = {}, catchCt = {}

      for (const r of batRes.data || []) {
        totRuns[r.player_id] = (totRuns[r.player_id] || 0) + r.runs
        hs[r.player_id] = Math.max(hs[r.player_id] || 0, r.runs)
      }
      for (const r of bowlRes.data || []) {
        totWick[r.player_id] = (totWick[r.player_id] || 0) + r.wickets
        const p = bestBowl[r.player_id]
        if (!p || r.wickets > p.w || (r.wickets === p.w && r.runs_conceded < p.r))
          bestBowl[r.player_id] = { w: r.wickets, r: r.runs_conceded }
      }
      for (const r of fieldRes.data || []) {
        if (r.kind === 'catch' || r.kind === 'wk_catch')
          catchCt[r.player_id] = (catchCt[r.player_id] || 0) + 1
      }
      for (const r of squadRes.data || []) {
        const m = r.matches
        if (m && !m.abandoned && m.match_type?.toLowerCase() === 'final')
          finCt[r.player_id] = (finCt[r.player_id] || 0) + 1
      }

      const tags = {}
      function top3(scoreMap, labels) {
        Object.entries(scoreMap)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .forEach(([pid], i) => { tags[pid] = [...(tags[pid] || []), labels[i]] })
      }
      top3(totRuns, ['Highest run-scorer', '2nd highest run-scorer', '3rd highest run-scorer'])
      top3(totWick, ['Highest wicket-taker', '2nd highest wicket-taker', '3rd highest wicket-taker'])
      top3(hs,      ['Highest individual score', '2nd highest individual score', '3rd highest individual score'])
      top3(finCt,   ['Most finals played', '2nd most finals played', '3rd most finals played'])
      top3(catchCt, ['Most catches taken', '2nd most catches taken', '3rd most catches taken'])
      // Best bowling: sort wickets desc, runs asc
      Object.entries(bestBowl)
        .filter(([, v]) => v.w > 0)
        .sort((a, b) => b[1].w !== a[1].w ? b[1].w - a[1].w : a[1].r - b[1].r)
        .slice(0, 3)
        .forEach(([pid], i) => {
          tags[pid] = [...(tags[pid] || []), ['Best bowling figures', '2nd best bowling figures', '3rd best bowling figures'][i]]
        })
      setStatTags(tags)
    }
    computeStatTags()
  }, [s6Players, statTags])

  // ── fetch historical stats when player selected ──────────────────────────────

  useEffect(() => {
    if (!selected || selected.is_debut || !selected.mapped_player_id) {
      setStats(null)
      return
    }
    const pid = selected.mapped_player_id
    setStatsLoading(true)
    setStats(null)
    Promise.all([
      supabase.from('players').select('id, canonical_name').eq('id', pid).single(),
      supabase.from('match_squads').select('match_id, team_id, is_captain, is_wk, teams!inner(name), matches!inner(id, date, match_type, file_name, season_id, winner_team_id, abandoned, team_a_id, team_b_id)').eq('player_id', pid),
      supabase.from('batting_records').select('innings_id, runs, balls, fours, sixes, not_out, innings!inner(match_id)').eq('player_id', pid),
      supabase.from('bowling_records').select('innings_id, balls_bowled, runs_conceded, wickets, dot_balls, innings!inner(match_id)').eq('player_id', pid),
      supabase.from('fielding_credits').select('innings_id, kind, innings!inner(match_id)').eq('player_id', pid),
      supabase.from('seasons').select('id, number'),
    ]).then(([pRes, sqRes, batRes, bowlRes, fieldRes, sRes]) => {
      if (pRes.error || sqRes.error || batRes.error || bowlRes.error || fieldRes.error || sRes.error) { setStats(null); return }
      const seasonNumById = {}
      for (const s of sRes.data) seasonNumById[s.id] = s.number
      setStats(computePlayerStats(pRes.data, sqRes.data, batRes.data, bowlRes.data, fieldRes.data, seasonNumById))
    }).catch(() => setStats(null)).finally(() => setStatsLoading(false))
  }, [selected])

  // ── sync soldOverlay to ref so keydown handler can read without stale closure ──
  useEffect(() => { soldOverlayRef.current = soldOverlay }, [soldOverlay])

  // ── keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
      if (soldOverlayRef.current) {
        if (e.key === '/' || e.key === 'Escape') {
          e.preventDefault()
          dismissOverlay()
        }
        return
      }
      if (e.key === '/') {
        if (inInput) return
        e.preventDefault()
        if (selected) {
          setShowBiddingSearch(true)
          setTimeout(() => searchRef.current?.focus(), 50)
        } else {
          searchRef.current?.focus()
        }
      }
      if (e.key === 'Escape') {
        if (selected && highBidder) {
          if (window.confirm(`Abandon bidding for ${selected.name}?`)) clearPlayer()
        } else if (selected) {
          clearPlayer()
        }
      }
      if (e.key === 'Enter' && !inInput && selected && highBidder && !selling) {
        handleSell()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, highBidder, selling]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── utilities ─────────────────────────────────────────────────────────────

  function animateBid(from, to) {
    if (bidAnimRef.current) cancelAnimationFrame(bidAnimRef.current)
    const start = performance.now()
    const duration = 250
    function tick(now) {
      const t = Math.min((now - start) / duration, 1)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      const v = from + (to - from) * ease
      setDisplayBid(Math.round(v))
      if (t < 1) bidAnimRef.current = requestAnimationFrame(tick)
      else setDisplayBid(to)
    }
    bidAnimRef.current = requestAnimationFrame(tick)
  }

  function toast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  function clearPlayer() {
    setSelected(null); setStats(null)
    setSearchQuery(''); setSearchOpen(false); setShowBiddingSearch(false)
    setCurrentBid(0); setDisplayBid(0); setHighBidder(null)
    setShowManualBid(false); setManualBidInput(''); setManualBidTeamId('')
    if (bidAnimRef.current) cancelAnimationFrame(bidAnimRef.current)
  }

  function selectPlayer(p) {
    setSelected(p)
    setSearchQuery(''); setSearchOpen(false); setShowBiddingSearch(false)
    setCurrentBid(p.base_price); setDisplayBid(p.base_price)
    setHighBidder(null); setShowManualBid(false)
    // Show skeleton immediately before the fetch useEffect fires
    if (!p.is_debut && p.mapped_player_id) {
      setStats(null)
      setStatsLoading(true)
    }
  }

  function handlePaddleClick(teamId) {
    if (!selected) return
    if (teamId === highBidder) {
      clearTimeout(paddleWinningTimerRef.current)
      setPaddleWinningId(teamId)
      paddleWinningTimerRef.current = setTimeout(() => setPaddleWinningId(null), 800)
      return
    }
    const inc = BID_INCREMENT[selected.category]
    const newBid = highBidder === null ? currentBid : currentBid + inc
    animateBid(currentBid, newBid)
    setCurrentBid(newBid); setHighBidder(teamId)
    setPulsePaddle(teamId)
    setTimeout(() => setPulsePaddle(null), 300)
  }

  function applyManualBid(e) {
    e.preventDefault()
    const val = parseFloat(manualBidInput)
    if (!val || val <= 0 || !manualBidTeamId) return
    animateBid(currentBid, val)
    setCurrentBid(val); setHighBidder(manualBidTeamId)
    setShowManualBid(false); setManualBidInput(''); setManualBidTeamId('')
  }

  function triggerCelebration(playerName, teamName, price, teamColor) {
    setSearchBarVisible(false)
    setSoldOverlay({ playerName, teamName, price, teamColor })
    confetti({ particleCount: 180, spread: 90, origin: { y: 0.45 }, colors: [teamColor || '#3b82f6', '#f59e0b', '#fff', '#34d399'], disableForReducedMotion: true })
  }

  function dismissOverlay() {
    setSoldOverlay(null)
    setSearchBarVisible(true)
    setTimeout(() => searchRef.current?.focus(), 80)
  }

  // ── sell / undo ────────────────────────────────────────────────────────────

  async function handleSell() {
    if (!selected || !highBidder || selling) return
    const team = teamInfo.find(t => t.id === highBidder)
    if (!team || team.slotsLeft <= 0) return
    if (team.remaining < currentBid) {
      setShowBudgetWarn({ teamId: highBidder, teamName: team.name, remaining: team.remaining, bid: currentBid })
      return
    }
    setSelling(true)
    const tempId = `opt-${Date.now()}`
    const salePayload = { s6_player_id: selected.id, s6_team_id: highBidder, price: currentBid }
    setSales(prev => [...prev, { id: tempId, ...salePayload, voided: false, sold_at: new Date().toISOString() }])
    const captured = { playerName: selected.name, teamName: team.name, price: currentBid, teamColor: team.color }
    triggerCelebration(captured.playerName, captured.teamName, captured.price, captured.teamColor)
    clearPlayer()
    const { data, error: insertErr } = await supabase.from('auction_sales').insert(salePayload).select().single()
    if (insertErr) {
      setSales(prev => prev.filter(s => s.id !== tempId))
      setSoldOverlay(null)
      setSearchBarVisible(true)
      setSelling(false)
      toast('Sale failed — please retry')
      return
    }
    setSales(prev => prev.map(s => s.id === tempId ? data : s))
    setLastSale({ saleId: data.id, ...captured })
    setSelling(false)
  }

  async function handleUndo() {
    if (!lastNonVoidedSale?.id) return
    const { error: updErr } = await supabase.from('auction_sales').update({ voided: true }).eq('id', lastNonVoidedSale.id)
    if (updErr) { toast('Undo failed'); return }
    setSales(prev => prev.map(s => s.id === lastNonVoidedSale.id ? { ...s, voided: true } : s))
    setUndoConfirm(false)
    toast('Undone')
  }

  async function voidSale(saleId) {
    const sale = sales.find(s => s.id === saleId)
    if (!sale) return
    const player = s6Players.find(p => p.id === sale.s6_player_id)
    const team   = s6Teams.find(t => t.id === sale.s6_team_id)
    const msg = `Undo: ${player?.name ?? '?'} → ${team?.name ?? '?'} for ${Number(sale.price).toLocaleString()}?`
    if (!window.confirm(msg)) return
    const { error: updErr } = await supabase.from('auction_sales').update({ voided: true }).eq('id', saleId)
    if (updErr) { toast('Undo failed'); return }
    setSales(prev => prev.map(s => s.id === saleId ? { ...s, voided: true } : s))
    toast('Undone')
  }

  async function handleReset() {
    const activeSales = sales.filter(s => !s.voided)
    if (!activeSales.length) { setShowResetConfirm(false); return }
    setResetting(true)
    const ids = activeSales.map(s => s.id)
    const { error: updErr } = await supabase.from('auction_sales').update({ voided: true }).in('id', ids)
    if (updErr) { toast('Reset failed'); setResetting(false); return }
    setSales(prev => prev.map(s => ({ ...s, voided: true })))
    setShowResetConfirm(false)
    setResetting(false)
    setSelected(null); setCurrentBid(0); setHighBidder(null)
    toast('Auction reset — all sales voided')
  }

  async function handleAutoAlloc() {
    if (!selected || !autoAllocTeam || selling) return
    const price = autoAllocPrice
    setSelling(true)
    const tempId = `opt-${Date.now()}`
    const salePayload = { s6_player_id: selected.id, s6_team_id: autoAllocTeam.id, price }
    setSales(prev => [...prev, { id: tempId, ...salePayload, voided: false, sold_at: new Date().toISOString() }])
    const captured = { playerName: selected.name, teamName: autoAllocTeam.name, price, teamColor: autoAllocTeam.color }
    setForceAllowTeamId(null)
    triggerCelebration(captured.playerName, captured.teamName, captured.price, captured.teamColor)
    clearPlayer()
    const { data, error: insertErr } = await supabase.from('auction_sales').insert(salePayload).select().single()
    if (insertErr) {
      setSales(prev => prev.filter(s => s.id !== tempId))
      setSoldOverlay(null)
      setSearchBarVisible(true)
      setSelling(false)
      toast('Auto-alloc failed — please retry')
      return
    }
    setSales(prev => prev.map(s => s.id === tempId ? data : s))
    setSelling(false)
  }

  async function handleRandomAlloc() {
    if (!randomAllocPlayer || !randomAllocTeam || selling) return
    const player = s6Players.find(p => p.id === randomAllocPlayer)
    const team   = s6Teams.find(t => t.id === randomAllocTeam)
    if (!player || !team) return
    const cat    = player.category
    const catInc = BID_INCREMENT[cat]
    const avg    = catAverages[cat]
    const price  = avg !== null ? Math.max(player.base_price, roundToNearest(avg, catInc)) : player.base_price
    setSelling(true)
    const tempId = `opt-${Date.now()}`
    const salePayload = { s6_player_id: player.id, s6_team_id: team.id, price }
    setSales(prev => [...prev, { id: tempId, ...salePayload, voided: false, sold_at: new Date().toISOString() }])
    setShowRandomAlloc(false)
    setRandomAllocPlayer('')
    setRandomAllocTeam('')
    triggerCelebration(player.name, team.name, price, team.color)
    const { data, error: insertErr } = await supabase.from('auction_sales').insert(salePayload).select().single()
    if (insertErr) {
      setSales(prev => prev.filter(s => s.id !== tempId))
      setSoldOverlay(null)
      setSearchBarVisible(true)
      setSelling(false)
      toast('Random alloc failed — please retry')
      return
    }
    setSales(prev => prev.map(s => s.id === tempId ? data : s))
    setSelling(false)
  }

  // ── derived state ──────────────────────────────────────────────────────────

  const captainIds = useMemo(
    () => new Set(s6Teams.map(t => t.captain_s6_player_id).filter(Boolean)),
    [s6Teams]
  )
  const soldIds = useMemo(
    () => new Set(sales.filter(s => !s.voided).map(s => s.s6_player_id)),
    [sales]
  )
  const available = useMemo(
    () => s6Players.filter(p => !captainIds.has(p.id) && !soldIds.has(p.id)),
    [s6Players, captainIds, soldIds]
  )
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (q) return available.filter(p => p.name.toLowerCase().includes(q)).slice(0, 12)
    // No query: show unsold players from the lowest-letter category that still has any
    const defaultCat = CATEGORIES.find(cat => available.some(p => p.category === cat))
    return defaultCat ? available.filter(p => p.category === defaultCat).slice(0, 12) : []
  }, [available, searchQuery])

  const teamInfo = useMemo(() => {
    // Pass 1 — per-team base info and own lock state
    const base = s6Teams.map(team => {
      const ts = sales.filter(s => !s.voided && s.s6_team_id === team.id)
      const spent = ts.reduce((sum, s) => sum + s.price, 0)
      const catCounts = { A: 0, B: team.captain_s6_player_id ? 1 : 0, C: 0, D: 0 }
      for (const sale of ts) {
        const p = s6Players.find(px => px.id === sale.s6_player_id)
        if (p) catCounts[p.category] = (catCounts[p.category] || 0) + 1
      }
      let lockedShape = null
      if (catCounts.A >= 2 || catCounts.D >= 2) lockedShape = 'Y'
      else if (catCounts.B >= 3 || catCounts.C >= 3) lockedShape = 'X'
      return { ...team, spent, remaining: team.budget_total - spent,
        slotsUsed: ts.length, slotsLeft: MAX_PURCHASES - ts.length,
        catCounts, lockedShape }
    })
    // Pass 2 — global enforcement: 3 Ys → remaining must be X; 2 Xs → remaining must be Y
    const lockedY = base.filter(t => t.lockedShape === 'Y').length
    const lockedX = base.filter(t => t.lockedShape === 'X').length
    return base.map(t => {
      let forcedShape = t.lockedShape
      if (!forcedShape) {
        if (lockedY >= 3) forcedShape = 'X'
        else if (lockedX >= 2) forcedShape = 'Y'
      }
      return { ...t, forcedShape }
    })
  }, [s6Teams, sales, s6Players])

  // Is a specific team eligible to bid for a player in cat?
  function teamCatEligible(team, cat) {
    if (team.id === forceAllowTeamId) return true
    if (team.slotsLeft <= 0) return false
    const max = (CAT_MAX[team.forcedShape] ?? CAT_MAX[null])[cat]
    return team.catCounts[cat] < max
  }

  const footerStats = useMemo(() => {
    const r = {}
    for (const cat of CATEGORIES) {
      const pool = s6Players.filter(p => p.category === cat && !captainIds.has(p.id))
      r[cat] = { total: pool.length, left: pool.filter(p => !soldIds.has(p.id)).length }
    }
    return r
  }, [s6Players, captainIds, soldIds])

  const totalSold = sales.filter(s => !s.voided).length

  const categoryRoster = useMemo(() => {
    if (!selected) return []
    return s6Players
      .filter(p => p.category === selected.category && !captainIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [s6Players, selected, captainIds])

  const salesBySixPlayer = useMemo(() => {
    const m = {}
    for (const sale of sales) if (!sale.voided) m[sale.s6_player_id] = sale
    return m
  }, [sales])

  const lastNonVoidedSale = useMemo(() => {
    const active = sales.filter(s => !s.voided)
    if (!active.length) return null
    const latest = active.reduce((a, b) => new Date(a.sold_at) >= new Date(b.sold_at) ? a : b)
    const player = s6Players.find(p => p.id === latest.s6_player_id)
    const team = s6Teams.find(t => t.id === latest.s6_team_id)
    return { ...latest, playerName: player?.name ?? '—', teamName: team?.name ?? '—' }
  }, [sales, s6Players, s6Teams])

  const inc = selected ? BID_INCREMENT[selected.category] : 0
  const nextBidPrice = selected ? (highBidder === null ? currentBid : currentBid + inc) : 0
  const highBidderTeam = highBidder ? teamInfo.find(t => t.id === highBidder) : null

  // Category-eligible teams for selected player
  const eligibleTeams = useMemo(() =>
    selected ? teamInfo.filter(t => teamCatEligible(t, selected.category)) : [],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [selected, teamInfo, forceAllowTeamId])

  const autoAllocMode = selected && eligibleTeams.length === 1
  const autoAllocTeam = autoAllocMode ? eligibleTeams[0] : null

  // ── shape-lock console logging (leave in until dry run complete) ───────────
  useEffect(() => {
    if (!selected || !teamInfo.length) return
    const lockedY = teamInfo.filter(t => t.lockedShape === 'Y').length
    const lockedX = teamInfo.filter(t => t.lockedShape === 'X').length
    const unlocked = teamInfo.filter(t => !t.lockedShape).length
    console.log(`[shape-lock] Player loaded: ${selected.name} (Cat ${selected.category})`)
    console.log(`[shape-lock] Global: lockedY=${lockedY}, lockedX=${lockedX}, unlocked=${unlocked}`)
    console.log('[shape-lock] Per-team eligibility:')
    teamInfo.forEach(t => {
      const eligible = teamCatEligible(t, selected.category)
      console.log(
        `  ${t.name.padEnd(28)} own=${t.lockedShape ?? 'none '} forced=${t.forcedShape ?? 'none '}` +
        ` ${selected.category}=${t.catCounts[selected.category]}` +
        ` → ${selected.category} paddle ${eligible ? 'ENABLED ✓' : 'DISABLED ✗'}`
      )
    })
    const eligCount = eligibleTeams.length
    console.log(`[shape-lock] Eligible in Cat ${selected.category}: ${eligCount}`)
    if (eligCount === 1) console.log(`[shape-lock] → AUTO-ALLOCATE to ${eligibleTeams[0]?.name}`)
    else if (eligCount === 0) console.log('[shape-lock] → NO ELIGIBLE TEAM — skip this player')
    else console.log('[shape-lock] → normal bidding')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, teamInfo])

  // Running averages per category (rounded to nearest increment), overrideable
  const catAverages = useMemo(() => {
    const r = {}
    for (const cat of CATEGORIES) {
      if (avgOverrides[cat] !== null) { r[cat] = avgOverrides[cat]; continue }
      const catInc = BID_INCREMENT[cat]
      const soldInCat = sales.filter(s => {
        if (s.voided) return false
        const p = s6Players.find(px => px.id === s.s6_player_id)
        return p?.category === cat
      })
      if (!soldInCat.length) { r[cat] = null; continue }
      const avg = soldInCat.reduce((sum, s) => sum + Number(s.price), 0) / soldInCat.length
      r[cat] = Math.round(avg / catInc) * catInc
    }
    return r
  }, [sales, s6Players, avgOverrides])

  // Auto-alloc price: uses catAverages (which respects overrides), min base_price
  const autoAllocPrice = useMemo(() => {
    if (!selected) return 0
    const cat = selected.category
    const catInc = BID_INCREMENT[cat]
    const avg = catAverages[cat]
    if (avg === null) return selected.base_price
    return Math.max(selected.base_price, roundToNearest(avg, catInc))
  }, [selected, catAverages, s6Players]) // eslint-disable-line react-hooks/exhaustive-deps

  const allTeamsBroke = selected && !autoAllocMode && teamInfo.length > 0 &&
    teamInfo.every(t => t.id === highBidder || !teamCatEligible(t, selected.category) || t.remaining < nextBidPrice)

  function fmtBid(n) {
    if (Number.isInteger(n)) return n.toLocaleString()
    return Number(n.toFixed(1)).toLocaleString()
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <span style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading…</span>
    </div>
  )
  if (error) return <p style={{ color: '#f87171' }} className="text-sm">{error}</p>

  return (
    <div style={{ position: 'relative', minHeight: '55vh', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1c1917', color: '#fbbf24', border: '1px solid #92400e', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 200, pointerEvents: 'none' }}>
          {toastMsg}
        </div>
      )}

      {/* SOLD overlay — Portal under <body>. Search bar is conditionally hidden via
          searchBarVisible so it cannot leak through the overlay regardless of z-index. */}
      {soldOverlay && createPortal(
        <div
          onClick={dismissOverlay}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer', animation: 'fadeIn 0.15s ease' }}
          data-sold-overlay="1"
        >
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 10, animation: 'slideUp 0.2s ease both' }}>SOLD TO</div>
            <div style={{ fontSize: 56, fontWeight: 900, color: readableTeamColor(soldOverlay.teamColor || '#f59e0b'), lineHeight: 1, marginBottom: 6, animation: 'slideUp 0.2s ease 0.06s both' }}>{soldOverlay.teamName}</div>
            <div style={{ fontSize: 88, fontWeight: 900, color: '#fbbf24', lineHeight: 1, marginBottom: 14, fontVariantNumeric: 'tabular-nums', animation: 'slideUp 0.25s ease 0.12s both' }}>{Number(soldOverlay.price).toLocaleString()}</div>
            <div style={{ fontSize: 22, color: '#d1d5db', fontWeight: 500, animation: 'slideUp 0.25s ease 0.18s both' }}>{soldOverlay.playerName}</div>
            <div style={{ marginTop: 28, color: '#6b7280', fontSize: 12 }}>tap or press / to continue</div>
          </div>
        </div>,
        document.body
      )}

      {/* Undo confirm dialog */}
      {undoConfirm && lastNonVoidedSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 28, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>Undo sale?</p>
            <p style={{ color: 'var(--color-text)', fontSize: 13, margin: '0 0 20px' }}>
              {lastNonVoidedSale.playerName} → {lastNonVoidedSale.teamName} for {Number(lastNonVoidedSale.price).toLocaleString()}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={handleUndo} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Yes, undo</button>
              <button onClick={() => setUndoConfirm(false)} style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar: undo + running averages + manual override */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {/* Running averages */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>Avg</span>
          {CATEGORIES.map((cat, i) => {
            const avg = catAverages[cat]
            const pal = CAT_PALETTE[cat]
            return (
              <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>}
                <span style={{ background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 4, padding: '1px 7px', fontSize: 11, display: 'inline-flex', gap: 3 }}>
                  <span style={{ color: pal.label, fontWeight: 700 }}>{cat}</span>
                  <span style={{ color: avg !== null ? pal.text : '#6b7280', fontWeight: avg !== null ? 600 : 400 }}>
                    {avg !== null ? avg.toLocaleString() : '—'}
                  </span>
                </span>
              </span>
            )
          })}
          <button onClick={() => {
            setDraftOverrides({
              A: String(avgOverrides.A ?? catAverages.A ?? ''),
              B: String(avgOverrides.B ?? catAverages.B ?? ''),
              C: String(avgOverrides.C ?? catAverages.C ?? ''),
              D: String(avgOverrides.D ?? catAverages.D ?? ''),
            })
            setShowOverride(true)
          }} style={{ color: '#6b7280', background: 'transparent', border: 'none', padding: '1px 4px', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}>
            Manual override
          </button>
          <button onClick={() => setShowRandomAlloc(true)} style={{ color: '#6b7280', background: 'transparent', border: 'none', padding: '1px 4px', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}>
            Random allocate
          </button>
        </div>
        {/* Undo last sale */}
        {lastNonVoidedSale && !soldOverlay && (
          <button
            onClick={() => setUndoConfirm(true)}
            style={{ color: '#6b7280', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
          >
            ↶ Undo last sale
          </button>
        )}
        {/* Reset auction — dry-run only */}
        <button
          onClick={() => setShowResetConfirm(true)}
          style={{ color: '#f87171', background: 'transparent', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
        >
          ↺ Reset auction
        </button>
      </div>

      {/* Reset confirm modal */}
      {showResetConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(248,113,113,0.5)', borderRadius: 14, padding: 28, maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <p style={{ color: '#f87171', fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Reset the entire auction?</p>
            <p style={{ color: 'var(--color-text)', fontSize: 13, margin: '0 0 22px', lineHeight: 1.5 }}>
              This will void all sales and clear all team rosters.<br />This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 22px', fontSize: 13, fontWeight: 700, cursor: resetting ? 'default' : 'pointer', opacity: resetting ? 0.6 : 1 }}
              >
                {resetting ? 'Resetting…' : 'Yes, reset'}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual override modal */}
      {showOverride && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, maxWidth: 360, width: '92%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 700 }}>Set running averages</span>
              <button onClick={() => setShowOverride(false)} style={{ color: '#6b7280', background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {CATEGORIES.map(cat => {
                const pal = CAT_PALETTE[cat]
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: pal.bg, color: pal.label, border: `1px solid ${pal.border}`, borderRadius: 4, padding: '2px 9px', fontSize: 12, fontWeight: 700, width: 28, textAlign: 'center', flexShrink: 0 }}>{cat}</span>
                    <input
                      type="number"
                      value={draftOverrides[cat]}
                      onChange={e => setDraftOverrides(prev => ({ ...prev, [cat]: e.target.value }))}
                      placeholder={String(catAverages[cat] ?? '')}
                      style={{ flex: 1, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 7, padding: '7px 11px', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  const next = { A: null, B: null, C: null, D: null }
                  for (const cat of CATEGORIES) {
                    const v = Number(draftOverrides[cat])
                    if (!isNaN(v) && v > 0) next[cat] = v
                  }
                  setAvgOverrides(next)
                  setShowOverride(false)
                }}
                style={{ flex: 1, background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Save
              </button>
              <button
                onClick={() => { setAvgOverrides({ A: null, B: null, C: null, D: null }); setShowOverride(false) }}
                style={{ flex: 1, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 0', fontSize: 13, cursor: 'pointer' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget warning modal */}
      {showBudgetWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, maxWidth: 360, width: '92%', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 600, margin: '0 0 10px' }}>Over budget</p>
            <p style={{ color: 'var(--color-text)', fontSize: 13, margin: '0 0 6px' }}>
              <strong style={{ color: 'var(--color-heading)' }}>{showBudgetWarn.teamName}</strong> only has{' '}
              <strong style={{ color: GOLD }}>{showBudgetWarn.remaining.toLocaleString()}</strong> remaining.
            </p>
            <p style={{ color: 'var(--color-text)', fontSize: 13, margin: '0 0 20px' }}>
              Bid is <strong style={{ color: '#f87171' }}>{showBudgetWarn.bid.toLocaleString()}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={async () => {
                  setShowBudgetWarn(null)
                  const team = teamInfo.find(t => t.id === showBudgetWarn.teamId)
                  if (!team) return
                  setSelling(true)
                  const tempId = `opt-${Date.now()}`
                  const salePayload = { s6_player_id: selected.id, s6_team_id: highBidder, price: currentBid }
                  setSales(prev => [...prev, { id: tempId, ...salePayload, voided: false, sold_at: new Date().toISOString() }])
                  const captured = { playerName: selected.name, teamName: team.name, price: currentBid, teamColor: team.color }
                  triggerCelebration(captured.playerName, captured.teamName, captured.price, captured.teamColor)
                  clearPlayer()
                  const { data, error: insertErr } = await supabase.from('auction_sales').insert(salePayload).select().single()
                  if (insertErr) {
                    setSales(prev => prev.filter(s => s.id !== tempId))
                    setSoldOverlay(null)
                    setSearchBarVisible(true)
                    setSelling(false)
                    toast('Sale failed — please retry')
                    return
                  }
                  setSales(prev => prev.map(s => s.id === tempId ? data : s))
                  setLastSale({ saleId: data.id, ...captured })
                  setSelling(false)
                }}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Override and continue
              </button>
              <button onClick={() => setShowBudgetWarn(null)} style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Random allocate modal */}
      {showRandomAlloc && (() => {
        const unsoldPlayers = s6Players.filter(p => !soldIds.has(p.id)).sort((a, b) => {
          if (a.category !== b.category) return CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)
          return a.name.localeCompare(b.name)
        })
        const teamsWithSlots = teamInfo.filter(t => t.slotsLeft > 0)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, maxWidth: 380, width: '92%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <span style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 700 }}>Random allocate</span>
                <button onClick={() => setShowRandomAlloc(false)} style={{ color: '#6b7280', background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div>
                  <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Player</p>
                  <select
                    value={randomAllocPlayer}
                    onChange={e => setRandomAllocPlayer(e.target.value)}
                    style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none' }}
                  >
                    <option value="">Select player…</option>
                    {unsoldPlayers.map(p => (
                      <option key={p.id} value={p.id}>[{p.category}] {p.name} — {p.base_price.toLocaleString()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>Team</p>
                  <select
                    value={randomAllocTeam}
                    onChange={e => setRandomAllocTeam(e.target.value)}
                    style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none' }}
                  >
                    <option value="">Select team…</option>
                    {teamsWithSlots.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.slotsLeft} slot{t.slotsLeft !== 1 ? 's' : ''})</option>
                    ))}
                  </select>
                </div>
                {randomAllocPlayer && randomAllocTeam && (() => {
                  const p = s6Players.find(px => px.id === randomAllocPlayer)
                  const avg = p ? catAverages[p.category] : null
                  const catInc = p ? BID_INCREMENT[p.category] : 1
                  const price = p && avg !== null ? Math.max(p.base_price, roundToNearest(avg, catInc)) : p?.base_price
                  return price !== undefined ? (
                    <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>
                      Sale price: <strong style={{ color: 'var(--color-heading)' }}>{price?.toLocaleString()}</strong>
                    </p>
                  ) : null
                })()}
              </div>
              <button
                onClick={handleRandomAlloc}
                disabled={!randomAllocPlayer || !randomAllocTeam || selling}
                style={{ width: '100%', background: randomAllocPlayer && randomAllocTeam ? ACCENT : 'var(--color-border)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: randomAllocPlayer && randomAllocTeam ? 'pointer' : 'not-allowed', opacity: selling ? 0.6 : 1 }}
              >
                Allocate
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── IDLE STATE ────────────────────────────────────────────────────── */}
      {!selected && !soldOverlay && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '42vh', paddingTop: 48, paddingBottom: 24, gap: 20 }}>
          {available.length === 0 ? (
            <p style={{ color: 'var(--color-heading)', fontSize: 22, fontWeight: 700 }}>🎉 All players auctioned!</p>
          ) : (
            <>
              <div style={{ width: '100%', maxWidth: 540, position: 'relative' }}>
                {searchBarVisible && <input
                  ref={searchRef}
                  type="search"
                  autoFocus
                  placeholder="Search player… (press / to focus)"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => { if (!selecting.current) setSearchOpen(false) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchResults.length > 0) selectPlayer(searchResults[0])
                    if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false) }
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 12, padding: '16px 20px', fontSize: 20, outline: 'none' }}
                />}
                {searchBarVisible && searchOpen && searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginTop: 4, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
                    {searchResults.map(p => (
                      <div key={p.id} onMouseDown={() => { selecting.current = true }} onClick={() => { selecting.current = false; selectPlayer(p) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }} className="hover:bg-blue-500/10">
                        <span style={{ background: CAT_PALETTE[p.category].bg, color: CAT_PALETTE[p.category].label, border: `1px solid ${CAT_PALETTE[p.category].border}`, borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{p.category}</span>
                        <span style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 500 }}>{p.name}</span>
                        <span style={{ color: 'var(--color-text)', fontSize: 13, marginLeft: 'auto', flexShrink: 0 }}>{p.base_price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p style={{ color: 'var(--color-text)', fontSize: 13, margin: 0 }}>
                {'Players left to auction: '}
                {CATEGORIES.map((cat, i) => {
                  const { left, total } = footerStats[cat] ?? { left: 0, total: 0 }
                  return (
                    <span key={cat}>
                      {i > 0 && <span style={{ color: 'var(--color-border)', margin: '0 6px' }}>·</span>}
                      <span style={{ color: left === 0 ? '#34d399' : CAT_PALETTE[cat].label, fontWeight: 600 }}>{cat}: {left}/{total}</span>
                    </span>
                  )
                })}
                <span style={{ color: 'var(--color-border)', margin: '0 6px' }}>·</span>
                <span>{totalSold} sold</span>
              </p>
            </>
          )}
        </div>
      )}

      {/* ── BIDDING STATE ─────────────────────────────────────────────────── */}
      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>

          {/* Change-player escape hatch */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {showBiddingSearch ? (
              <div style={{ position: 'relative', width: 300 }}>
                <input
                  ref={searchRef}
                  autoFocus
                  type="search"
                  placeholder="Change player…"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => { if (!selecting.current) { setSearchOpen(false); setShowBiddingSearch(false) } }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchResults.length > 0) selectPlayer(searchResults[0])
                    if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false); setShowBiddingSearch(false) }
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }}
                />
                {searchOpen && searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                    {searchResults.map(p => (
                      <div key={p.id} onMouseDown={() => { selecting.current = true }} onClick={() => { selecting.current = false; selectPlayer(p) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }} className="hover:bg-blue-500/10">
                        <span style={{ background: CAT_PALETTE[p.category].bg, color: CAT_PALETTE[p.category].label, border: `1px solid ${CAT_PALETTE[p.category].border}`, borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{p.category}</span>
                        <span style={{ color: 'var(--color-heading)', fontSize: 13 }}>{p.name}</span>
                        <span style={{ color: 'var(--color-text)', fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>{p.base_price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowBiddingSearch(true)}
                style={{ color: '#6b7280', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                title="Change player (or press /)"
              >
                🔍 Change player
              </button>
            )}
          </div>

          {/* Stat card + category roster — stretch so roster fills stat card height */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            <div style={{ flex: '0 0 60%', minWidth: 0, animation: 'slideUp 0.2s ease both' }}>
              <PlayerStatCard player={selected} stats={stats} statsLoading={statsLoading} tags={selected.mapped_player_id && statTags ? (statTags[selected.mapped_player_id] ?? []) : []} />
            </div>
            <div style={{ flex: '0 0 40%', minWidth: 0, minHeight: 0, animation: 'slideUp 0.2s ease 0.06s both', display: 'flex', flexDirection: 'column' }}>
              <CategoryRosterPanel category={selected.category} players={categoryRoster} activeId={selected.id} soldIds={soldIds} salesMap={salesBySixPlayer} teamInfo={teamInfo} />
            </div>
          </div>

          {/* Auto-allocation panel OR normal bid strip */}
          {autoAllocMode ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10, padding: '14px 18px', animation: 'fadeIn 0.3s ease both' }}>
              <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Auto-allocation — forced sale
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--color-heading)', fontSize: 15 }}>
                  Only eligible team: <strong style={{ color: readableTeamColor(autoAllocTeam.color) }}>{autoAllocTeam.name}</strong>
                </span>
                <span style={{ color: 'var(--color-border)' }}>·</span>
                <span style={{ color: 'var(--color-text)', fontSize: 13 }}>
                  Calculated price: <strong style={{ color: 'var(--color-heading)' }}>{autoAllocPrice.toLocaleString()}</strong>
                  {autoAllocTeam.remaining < autoAllocPrice && (
                    <span style={{ color: '#f87171', marginLeft: 8, fontSize: 11 }}>(over budget — will go negative)</span>
                  )}
                </span>
              </div>
              {eligibleTeams.length === 0 && (
                <p style={{ color: '#f87171', fontSize: 12, margin: '8px 0 0' }}>⚠ No eligible team — all full in this category. Skip this player.</p>
              )}
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '5px 14px', animation: 'slideUp 0.2s ease 0.1s both' }}>
              {/* Single compact row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36 }}>
                {highBidder ? (
                  <>
                    <span style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>Bid</span>
                    <span style={{ color: 'var(--color-heading)', fontSize: 28, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', display: 'inline-block', minWidth: '4.5ch', textAlign: 'right' }}>{fmtBid(displayBid)}</span>
                    <span style={{ color: 'var(--color-border)', flexShrink: 0 }}>·</span>
                    <span style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>Held by</span>
                    <span style={{ background: highBidderTeam?.color || 'var(--color-accent)', color: captainTextColor(highBidderTeam?.color || '#3b82f6'), borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700, display: 'inline-block', animation: 'slideInRight 0.2s ease both', flexShrink: 0 }}>
                      {highBidderTeam?.name}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--color-text)', fontSize: 13 }}>Awaiting first bid</span>
                    <span style={{ color: 'var(--color-border)' }}>·</span>
                    <span style={{ color: 'var(--color-heading)', fontSize: 13, fontWeight: 700 }}>Base {selected.base_price.toLocaleString()}</span>
                  </>
                )}
                <button
                  onClick={() => setShowManualBid(v => !v)}
                  style={{ marginLeft: 'auto', color: '#6b7280', background: 'transparent', border: 'none', padding: '2px 6px', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  {showManualBid ? 'close' : 'set manually'}
                </button>
              </div>

              {/* Manual bid form */}
              {showManualBid && (
                <form onSubmit={applyManualBid} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text)', fontSize: 12 }}>Set bid to:</span>
                  <input type="number" value={manualBidInput} onChange={e => setManualBidInput(e.target.value)} step="0.5" placeholder="price" style={{ width: 70, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 6, padding: '4px 8px', fontSize: 13, outline: 'none' }} />
                  <span style={{ color: 'var(--color-text)', fontSize: 12 }}>for:</span>
                  <select value={manualBidTeamId} onChange={e => setManualBidTeamId(e.target.value)} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none' }}>
                    <option value="">Team…</option>
                    {teamInfo.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button type="submit" style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Set</button>
                </form>
              )}

              {highBidder && allTeamsBroke && (
                <p style={{ color: '#34d399', fontSize: 11, margin: '6px 0 0' }}>No other team can outbid — ready to sell to {highBidderTeam?.name}.</p>
              )}
              {!highBidder && allTeamsBroke && (
                <p style={{ color: '#f59e0b', fontSize: 11, margin: '6px 0 0' }}>No team can bid at this base price. Adjust manually or pass.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PADDLES + SOLD ROW (always rendered) ────────────────────────── */}
      <div style={{ marginTop: selected ? 14 : 28 }}>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
        {/* Team paddles */}
        {teamInfo.map(team => {
          const isHighBidder = team.id === highBidder
          const canAffordNext = team.remaining >= nextBidPrice
          const hasSlots = team.slotsLeft > 0
          const catOk = !selected || teamCatEligible(team, selected.category)
          const disabled = !selected || !hasSlots || !canAffordNext || !catOk || autoAllocMode
          const isPulsing = pulsePaddle === team.id
          const paddleActive = selected && !autoAllocMode && (isHighBidder || !disabled)
          const btnTextColor = paddleActive ? captainTextColor(team.color) : (!selected ? 'var(--color-border)' : 'var(--color-text)')
          const tooltipMsg = !selected ? undefined
            : autoAllocMode ? 'Auto-allocation active'
            : !hasSlots ? 'No slots left'
            : !catOk ? 'Cat full'
            : !canAffordNext ? 'Out of budget'
            : undefined
          return (
            <div key={team.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 3 }}>
              <span style={{ color: selected ? readableTeamColor(team.color) : 'var(--color-border)', fontSize: 11, fontWeight: isHighBidder ? 700 : 400, fontVariantNumeric: 'tabular-nums', opacity: selected ? (isHighBidder ? 1 : 0.7) : 1, textAlign: 'center' }}>
                {team.spent.toLocaleString()} / {team.budget_total.toLocaleString()}
              </span>
              <button
                onClick={() => handlePaddleClick(team.id)}
                disabled={disabled && !isHighBidder}
                title={tooltipMsg}
                style={{
                  width: '100%', flex: 1,
                  background: !selected || autoAllocMode ? 'var(--color-surface)' : isHighBidder ? team.color : disabled ? 'rgba(255,255,255,0.04)' : team.color,
                  color: btnTextColor,
                  border: isHighBidder && !autoAllocMode
                    ? '2px solid rgba(255,255,255,0.85)'
                    : paddleActive ? '2px solid rgba(255,255,255,0.35)'
                    : `2px solid ${!selected ? 'var(--color-border)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '13px 8px', fontSize: 14, fontWeight: 700,
                  cursor: (!selected || (disabled && !isHighBidder)) ? 'default' : 'pointer',
                  opacity: !selected || autoAllocMode ? 0.3 : (disabled && !isHighBidder) ? 0.25 : 1,
                  transform: isPulsing ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 0.15s, opacity 0.2s, background 0.15s, border-color 0.15s',
                  boxShadow: isHighBidder && !autoAllocMode ? `0 0 22px ${team.color}66` : 'none',
                  position: 'relative',
                }}
              >
                {team.name}
                {selected && !catOk && !autoAllocMode && (
                  <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontWeight: 400 }}>Cat full</span>
                )}
                {paddleWinningId === team.id && (
                  <span style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, background: '#1c1917', color: '#fbbf24', border: '1px solid #92400e', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10 }}>
                    Already winning
                  </span>
                )}
              </button>
            </div>
          )
        })}

        {/* SOLD / Confirm allocation button */}
        {(() => {
          const soldActive = !!(selected && highBidder && !selling && !autoAllocMode)
          const allocActive = !!(autoAllocMode && autoAllocTeam && !selling)
          const anyActive = soldActive || allocActive
          return (
            <div style={{ flexShrink: 0, width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: 'transparent', userSelect: 'none' }}>·</span>
              <button
                onClick={allocActive ? handleAutoAlloc : handleSell}
                disabled={!anyActive}
                style={{
                  width: '100%', flex: 1,
                  background: anyActive ? '#F2C033' : 'rgba(255,255,255,0.04)',
                  color: anyActive ? '#1a1200' : '#6b7280',
                  border: `2px solid ${anyActive ? '#F2C033' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 30,
                  padding: '13px 10px',
                  fontSize: allocActive ? 13 : 18, fontWeight: 900,
                  cursor: anyActive ? 'pointer' : 'default',
                  opacity: anyActive ? 1 : 0.35,
                  transition: 'background 0.15s, opacity 0.2s',
                  letterSpacing: '0.04em',
                  animation: anyActive ? 'soldPulse 1.5s ease-in-out infinite' : 'none',
                  lineHeight: 1.2,
                }}
              >
                {selling ? '…' : allocActive ? '✓ Confirm' : '🔨 SOLD'}
              </button>
            </div>
          )
        })()}
      </div>
      </div>
    </div>
  )
}

// ─── shared hooks ─────────────────────────────────────────────────────────────

const SHAPE_DETAIL = { X: '1A/3B/3C/1D', Y: '2A/2B/2C/2D' }

// Pure computation: aggregates auction_sales into per-team roster objects
function useTeamRosters(s6Players, s6Teams, sales) {
  return useMemo(() => {
    const base = s6Teams.map(team => {
      const ts = sales
        .filter(s => !s.voided && s.s6_team_id === team.id)
        .sort((a, b) => new Date(a.sold_at) - new Date(b.sold_at))
      const spent = ts.reduce((sum, s) => sum + Number(s.price), 0)
      const captainPlayer = s6Players.find(p => p.id === team.captain_s6_player_id) ?? null
      const catCounts = { A: 0, B: captainPlayer ? 1 : 0, C: 0, D: 0 }
      for (const sale of ts) {
        const p = s6Players.find(px => px.id === sale.s6_player_id)
        if (p) catCounts[p.category] = (catCounts[p.category] || 0) + 1
      }
      let lockedShape = null
      if (catCounts.A >= 2 || catCounts.D >= 2) lockedShape = 'Y'
      else if (catCounts.B >= 3 || catCounts.C >= 3) lockedShape = 'X'
      const players = ts
        .map(sale => {
          const player = s6Players.find(p => p.id === sale.s6_player_id)
          return player ? { ...player, salePrice: Number(sale.price), saleId: sale.id } : null
        })
        .filter(Boolean)
      return {
        ...team, captainPlayer, players, spent,
        remaining: team.budget_total - spent,
        catCounts, lockedShape,
        slotsFilledTotal: (captainPlayer ? 1 : 0) + players.length,
      }
    })
    const lockedY = base.filter(t => t.lockedShape === 'Y').length
    const lockedX = base.filter(t => t.lockedShape === 'X').length
    return base.map(t => {
      let forcedShape = t.lockedShape
      if (!forcedShape) {
        if (lockedY >= 3) forcedShape = 'X'
        else if (lockedX >= 2) forcedShape = 'Y'
      }
      return { ...t, forcedShape }
    })
  }, [s6Players, s6Teams, sales])
}

// Loads auction data + wires a realtime subscription; returns live state
function useAuctionRealtimeData(channelName) {
  const [s6Players,          setS6Players]          = useState([])
  const [s6Teams,            setS6Teams]             = useState([])
  const [sales,              setSales]               = useState([])
  const [loading,            setLoading]             = useState(true)
  const [error,              setError]               = useState(null)
  const [lastUpdatedTeamId,  setLastUpdatedTeamId]   = useState(null)
  const clearPulseRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const [pRes, tRes, sRes] = await Promise.all([
          supabase.from('s6_players').select('*').order('name'),
          supabase.from('s6_teams').select('*').order('name'),
          supabase.from('auction_sales').select('*'),
        ])
        if (pRes.error) throw pRes.error
        if (tRes.error) throw tRes.error
        if (sRes.error) throw sRes.error
        setS6Players(pRes.data)
        setS6Teams(tRes.data)
        setSales(sRes.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()

    function pulse(teamId) {
      if (!teamId) return
      setLastUpdatedTeamId(teamId)
      clearTimeout(clearPulseRef.current)
      clearPulseRef.current = setTimeout(() => setLastUpdatedTeamId(null), 500)
    }

    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_sales' }, payload => {
        if (payload.eventType === 'INSERT') {
          setSales(prev => [...prev, payload.new])
          pulse(payload.new.s6_team_id)
        } else if (payload.eventType === 'UPDATE') {
          setSales(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
          pulse(payload.new.s6_team_id)
        } else if (payload.eventType === 'DELETE') {
          setSales(prev => prev.filter(s => s.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      clearTimeout(clearPulseRef.current)
      supabase.removeChannel(channel)
    }
  }, [channelName])

  return { s6Players, s6Teams, sales, loading, error, lastUpdatedTeamId }
}

// ─── TeamCard ─────────────────────────────────────────────────────────────────

function TeamCard({ team, isPulsing }) {
  return (
    <div
      className="themed-card"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-card-border)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: isPulsing ? 'cardPulse 0.4s ease' : 'none',
      }}
    >
      {/* Header strip */}
      <div style={{ background: team.color, minHeight: 64, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
        <TeamLogo teamName={team.name} size={48} />
        <h3 style={{ color: captainTextColor(team.color), fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '0.02em', lineHeight: 1.2 }}>
          {team.name}
        </h3>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {/* Captain row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.025)', borderLeft: `3px solid ${team.color}`, borderRadius: '0 6px 6px 0' }}>
          <span style={{ fontSize: 15 }}>👑</span>
          <span style={{ color: 'var(--color-heading)', fontSize: 18, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {team.captainPlayer?.name ?? <em style={{ color: '#6b7280', fontWeight: 400 }}>No captain</em>}
          </span>
          <span style={{ color: team.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', flexShrink: 0 }}>CAPTAIN</span>
        </div>

        {/* Bought players */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {team.players.length === 0
            ? <p style={{ color: '#6b7280', fontSize: 12, fontStyle: 'italic', margin: '2px 0 0' }}>No players bought yet</p>
            : team.players.map(player => {
                const pal = CAT_PALETTE[player.category]
                return (
                  <div key={player.saleId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', animation: 'slideUp 0.2s ease both' }}>
                    <span style={{ color: 'var(--color-heading)', fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.name}
                    </span>
                    <span style={{ background: pal.bg, color: pal.label, border: `1px solid ${pal.border}`, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {player.category}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: 11, flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right' }}>
                      {player.salePrice.toLocaleString()}
                    </span>
                  </div>
                )
              })
          }
        </div>

        {/* Footer: slot tracker + budget — pinned to bottom because players list above has flex:1 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Slot tracker — 8 segmented boxes */}
          <div>
            <span style={{ color: 'var(--color-text)', fontSize: 11, display: 'block', marginBottom: 5 }}>
              {team.slotsFilledTotal} / {MAX_SLOTS} filled
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: MAX_SLOTS }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < team.slotsFilledTotal ? readableTeamColor(team.color) : 'var(--color-border)', transition: 'background 0.3s ease' }} />
              ))}
            </div>
          </div>

          {/* Budget */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ color: 'var(--color-text)', fontSize: 11 }}>Remaining</span>
              {team.remaining < 0 && (
                <span style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', display: 'inline-block' }}>
                  BUDGET EXCEEDED
                </span>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: team.remaining < 0 ? '#f87171' : 'var(--color-heading)', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {team.remaining.toLocaleString()}
              </div>
              <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>of {team.budget_total.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TeamDashboardView ────────────────────────────────────────────────────────

export function TeamDashboardView() {
  const { s6Players, s6Teams, sales, loading, error, lastUpdatedTeamId } = useAuctionRealtimeData('team-dashboard')
  const rosters = useTeamRosters(s6Players, s6Teams, sales)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <span style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading…</span>
    </div>
  )
  if (error) return <p style={{ color: '#f87171' }} className="text-sm">{error}</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {rosters.map(team => (
        <TeamCard key={team.id} team={team} isPulsing={lastUpdatedTeamId === team.id} />
      ))}
    </div>
  )
}

// ─── Export helpers ────────────────────────────────────────────────────────────

function teamSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function TeamCardExportContent({ team }) {
  const emptySlots = Math.max(0, MAX_PURCHASES - team.players.length)
  const fg = captainTextColor(team.color)
  return (
    <div style={{ width: 1080, background: BG, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Colour header strip */}
      <div style={{ background: team.color, padding: '40px 60px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <img src="/spl-logo.svg" alt="SPL" style={{ height: 36, width: 'auto', opacity: 0.85 }} />
          <span style={{ color: fg, opacity: 0.72, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Superball Premier League — Season 6
          </span>
        </div>
        <TeamLogoInline teamName={team.name} size={140} />
        <h1 style={{ color: fg, fontSize: 52, fontWeight: 900, margin: 0, letterSpacing: '0.01em', textAlign: 'center', lineHeight: 1.1 }}>
          {team.name}
        </h1>
      </div>

      {/* Player list */}
      <div style={{ padding: '40px 60px' }}>
        {/* Captain row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '22px 28px', background: 'rgba(255,200,64,0.07)', border: '1px solid rgba(255,200,64,0.3)', borderRadius: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>👑</span>
          <span style={{ color: HEADING, fontSize: 32, fontWeight: 800, flex: 1 }}>{team.captainPlayer?.name ?? '—'}</span>
          <span style={{ color: GOLD, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Captain</span>
        </div>

        {/* Bought players */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {team.players.map(p => (
            <div key={p.saleId} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 28px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
              <span style={{ color: MUTED, fontSize: 14, fontWeight: 700, width: 20, textAlign: 'center', flexShrink: 0 }}>{p.category}</span>
              <span style={{ color: HEADING, fontSize: 28, fontWeight: 500 }}>{p.name}</span>
            </div>
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`e${i}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 28px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, opacity: 0.35 }}>
              <span style={{ color: MUTED, fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>—</span>
              <span style={{ color: MUTED, fontSize: 28 }}>Empty slot</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '0 60px 40px', textAlign: 'center' }}>
        <span style={{ color: MUTED, fontSize: 14 }}>Tournament: June 13th, 2026</span>
      </div>
    </div>
  )
}

function MobileExportContent({ rosters }) {
  return (
    <div style={{ width: 1080, background: BG, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '40px 40px 60px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <img src="/spl-logo.svg" alt="SPL" style={{ height: 80, width: 'auto', flexShrink: 0 }} />
        <div>
          <h1 style={{ color: HEADING, fontSize: 30, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>Superball Premier League</h1>
          <p style={{ color: MUTED, fontSize: 18, margin: '6px 0 0' }}>Season 6 Team List · June 13th, 2026</p>
        </div>
      </div>
      <div style={{ height: 1, background: BORDER }} />

      {/* Teams stacked vertically */}
      {rosters.map(team => {
        const emptySlots = Math.max(0, MAX_PURCHASES - team.players.length)
        return (
          <div key={team.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ background: team.color, padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 20 }}>
              <TeamLogoInline teamName={team.name} size={64} />
              <h3 style={{ color: captainTextColor(team.color), fontSize: 28, fontWeight: 900, margin: 0 }}>{team.name}</h3>
            </div>
            <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Captain */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0 12px', borderBottom: `1px solid ${BORDER}`, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>👑</span>
                <span style={{ color: HEADING, fontSize: 22, fontWeight: 700, flex: 1 }}>{team.captainPlayer?.name ?? '—'}</span>
                <span style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Captain</span>
              </div>
              {team.players.map(p => (
                <div key={p.saleId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: MUTED, fontSize: 14, width: 18, flexShrink: 0 }}>{p.category}</span>
                  <span style={{ color: HEADING, fontSize: 20 }}>{p.name}</span>
                </div>
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div key={`e${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.35 }}>
                  <span style={{ color: MUTED, fontSize: 14, width: 18, flexShrink: 0 }}>—</span>
                  <span style={{ color: MUTED, fontSize: 20 }}>Empty slot</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

async function renderOffscreen(Component, props, filename, pixelRatio = 2) {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;'
  document.body.appendChild(container)
  const root = createRoot(container)
  await new Promise(resolve => { root.render(<Component {...props} />); setTimeout(resolve, 80) })
  try {
    const el = container.firstElementChild
    const dataUrl = await toPng(el, { pixelRatio, backgroundColor: BG, skipFonts: false })
    const a = document.createElement('a')
    a.download = filename
    a.href = dataUrl
    a.click()
  } finally {
    root.unmount()
    document.body.removeChild(container)
  }
}

// ─── FinalTeamListView ────────────────────────────────────────────────────────

export function FinalTeamListView() {
  const [s6Players, setS6Players] = useState([])
  const [s6Teams,   setS6Teams]   = useState([])
  const [sales,     setSales]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportingMobile, setExportingMobile] = useState(false)
  const [exportingTeamId, setExportingTeamId] = useState(null)
  const captureRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const [pRes, tRes, sRes] = await Promise.all([
          supabase.from('s6_players').select('*').order('name'),
          supabase.from('s6_teams').select('*').order('name'),
          supabase.from('auction_sales').select('*'),
        ])
        if (pRes.error) throw pRes.error
        if (tRes.error) throw tRes.error
        if (sRes.error) throw sRes.error
        setS6Players(pRes.data)
        setS6Teams(tRes.data)
        setSales(sRes.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const rosters = useTeamRosters(s6Players, s6Teams, sales)

  async function handleExport() {
    if (!captureRef.current || exporting) return
    setExporting(true)
    try {
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2, backgroundColor: BG, skipFonts: false,
        filter: node => !node.dataset?.exportExclude,
      })
      const a = document.createElement('a')
      a.download = 'spl-s6-team-list.png'
      a.href = dataUrl
      a.click()
    } catch (err) {
      console.error('export failed', err)
    } finally {
      setExporting(false)
    }
  }

  async function handleMobileExport() {
    if (exportingMobile) return
    setExportingMobile(true)
    try {
      await renderOffscreen(MobileExportContent, { rosters }, 'spl-s6-team-list-mobile.png', 1)
    } catch (err) {
      console.error('mobile export failed', err)
    } finally {
      setExportingMobile(false)
    }
  }

  async function handleTeamExport(team) {
    if (exportingTeamId) return
    setExportingTeamId(team.id)
    try {
      await renderOffscreen(TeamCardExportContent, { team }, `spl-s6-${teamSlug(team.name)}.png`, 1)
    } catch (err) {
      console.error('team export failed', err)
    } finally {
      setExportingTeamId(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <span style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading…</span>
    </div>
  )
  if (error) return <p style={{ color: '#f87171' }} className="text-sm">{error}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Capture area — per-team download buttons have data-export-exclude so they're stripped from PNG */}
      <div ref={captureRef} style={{ background: BG, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src="/spl-logo.svg" alt="SPL" style={{ height: 64, width: 'auto', flexShrink: 0 }} />
          <div>
            <h1 style={{ color: HEADING, fontSize: 20, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
              Superball Premier League — Season 6 Team List
            </h1>
            <p style={{ color: MUTED, fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              Tournament Date: June 13th, 2026
            </p>
          </div>
        </div>
        <div style={{ height: 1, background: BORDER }} />

        {/* Team grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
          {rosters.map(team => {
            const emptySlots = Math.max(0, MAX_PURCHASES - team.players.length)
            const isExportingThis = exportingTeamId === team.id
            return (
              <div key={team.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                {/* Per-team download button — excluded from PNG via filter */}
                <button
                  data-export-exclude="1"
                  onClick={() => handleTeamExport(team)}
                  disabled={!!exportingTeamId}
                  title={`Download ${team.name} share card`}
                  style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: 'rgba(0,0,0,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: exportingTeamId ? 'default' : 'pointer', opacity: isExportingThis ? 0.5 : 0.85, lineHeight: 1.4 }}
                >
                  {isExportingThis ? '…' : '↓'}
                </button>
                {/* Card header */}
                <div style={{ background: team.color, minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px' }}>
                  <TeamLogoInline teamName={team.name} size={40} />
                  <h3 style={{ color: captainTextColor(team.color), fontSize: 14, fontWeight: 800, margin: 0, letterSpacing: '0.02em' }}>
                    {team.name}
                  </h3>
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Captain */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 5px', borderBottom: `1px solid ${BORDER}`, marginBottom: 2, lineHeight: 1.4 }}>
                    <span style={{ fontSize: 11, flexShrink: 0 }}>👑</span>
                    <span style={{ color: HEADING, fontSize: 12, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {team.captainPlayer?.name ?? '—'}
                    </span>
                    <span style={{ color: MUTED, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>CAPTAIN</span>
                  </div>
                  {team.players.map(p => (
                    <div key={p.saleId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: MUTED, fontSize: 10, width: 12, flexShrink: 0 }}>{p.category}</span>
                      <span style={{ color: HEADING, fontSize: 14 }}>{p.name}</span>
                    </div>
                  ))}
                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <div key={`e${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: BORDER, fontSize: 10, width: 12, flexShrink: 0 }}>—</span>
                      <span style={{ color: BORDER, fontSize: 14 }}>Empty slot</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ background: exporting ? 'var(--color-surface)' : 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1 }}
        >
          {exporting ? 'Exporting…' : '↓ Export PNG'}
        </button>
        <button
          onClick={handleMobileExport}
          disabled={exportingMobile}
          style={{ background: exportingMobile ? 'var(--color-surface)' : 'var(--color-surface)', color: exportingMobile ? 'var(--color-text)' : 'var(--color-heading)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: exportingMobile ? 'default' : 'pointer', opacity: exportingMobile ? 0.6 : 1 }}
        >
          {exportingMobile ? 'Exporting…' : '↓ Export for Mobile'}
        </button>
      </div>
    </div>
  )
}

// ─── AuctionTeamsPublic ───────────────────────────────────────────────────────
// Standalone page — no passcode, no tab nav. Captains open this on phones.

export function AuctionTeamsPublic() {
  const { s6Players, s6Teams, sales, loading, error, lastUpdatedTeamId } = useAuctionRealtimeData('teams-public')
  const rosters = useTeamRosters(s6Players, s6Teams, sales)

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
      {/* Minimal header */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/spl-logo.svg" alt="SPL" style={{ height: 32, width: 'auto' }} />
        <span style={{ color: 'var(--color-heading)', fontWeight: 700, fontSize: 15 }}>SPL S6 Auction</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#34d399', fontSize: 12, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'soldPulse 2s ease-in-out infinite' }} />
          Live
        </span>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading…</span>
          </div>
        ) : error ? (
          <p style={{ color: '#f87171' }} className="text-sm">{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rosters.map(team => (
              <TeamCard key={team.id} team={team} isPulsing={lastUpdatedTeamId === team.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AuctionApp ───────────────────────────────────────────────────────────────

const ADMIN_TABS = new Set(['Setup', 'Live Auction'])

function AuctionApp() {
  const [searchParams] = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'
  const visibleTabs = TABS.filter(t => !ADMIN_TABS.has(t) || isAdmin)
  const [activeTab,   setActiveTab]   = useState(() => isAdmin ? 'Setup' : 'Categories')
  // Lifted so Live Auction state survives tab switches
  const [selected,    setSelected]    = useState(null)
  const [currentBid,  setCurrentBid]  = useState(0)
  const [highBidder,  setHighBidder]  = useState(null)

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
      <div
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
        className="px-4 sm:px-6 overflow-x-auto"
      >
        <div className="flex gap-1 min-w-max">
          {visibleTabs.map(tab => {
            const active = tab === activeTab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  color: active ? 'var(--color-heading)' : 'var(--color-text)',
                  borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                }}
                className="px-4 py-3 text-sm font-medium whitespace-nowrap hover:opacity-80 transition-opacity"
              >
                {tab}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'Setup'           && <SetupTab />}
        {activeTab === 'Categories'      && <CategoriesTab />}
        {activeTab === 'Live Auction'    && (
          <LiveAuctionTab
            selected={selected}       setSelected={setSelected}
            currentBid={currentBid}   setCurrentBid={setCurrentBid}
            highBidder={highBidder}   setHighBidder={setHighBidder}
          />
        )}
        {activeTab === 'Team Dashboard'  && <TeamDashboardView />}
        {activeTab === 'Final Team List' && <FinalTeamListView />}
        {activeTab === 'Schedule'        && <ScheduleTab />}
      </div>
    </div>
  )
}

// ─── default export ───────────────────────────────────────────────────────────

export default function Auction() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  )
  if (!authed) return <PasscodeGate onSuccess={() => setAuthed(true)} />
  return <AuctionApp />
}
