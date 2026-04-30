import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toPng } from 'html-to-image'
import confetti from 'canvas-confetti'
import { ballsToOvers, fmtNum, fmtHalf, computePlayerStats } from '../lib/cricketStats'

// ─── constants ────────────────────────────────────────────────────────────────

const PASSCODE = import.meta.env.VITE_AUCTION_PASSCODE ?? 'spl2026'
const SESSION_KEY = 'spl_auction_auth'
const TABS = ['Setup', 'Categories', 'Live Auction', 'Team Dashboard', 'Final Team List']
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
const BG       = '#0f1117'
const SURFACE  = '#1a1d27'
const BORDER   = '#2a2d3a'
const MUTED    = '#6b7280'
const HEADING  = '#f3f4f6'

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

function CategoryColumn({ category, players }) {
  const pal = CAT_PALETTE[category]
  const bid = COLUMN_BIDDING[category]
  return (
    <div style={{
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
            <span style={{ color: HEADING, fontSize: 13, whiteSpace: 'nowrap' }}>{p.name}</span>
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
            <p style={{ color: MUTED, fontSize: 13, marginTop: 6, marginBottom: 0 }}>
              Auction date: 2nd May, 9 PM (Bangkok time)
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: BORDER }} />

        {/* Captains strip */}
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
                  <span style={{ position: 'absolute', top: 7, right: 9, fontSize: 13, lineHeight: 1 }}>👑</span>
                  <div style={{ color: fg, fontSize: 14, fontWeight: 700, paddingRight: 22, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                    {card.captainName}
                  </div>
                  <div style={{ color: fg, fontSize: 11, opacity: 0.72, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {card.teamName}
                  </div>
                </div>
              )
            })}
          </div>
        )}

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

// ─── LiveAuctionTab ───────────────────────────────────────────────────────────

const MAX_SLOTS = 8
const BID_INCREMENT = { A: 500, B: 300, C: 200, D: 100 }

// Compact stat display for the player card
function LiveStatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ color: 'var(--color-text)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function LiveStatBlock({ title, rows, emptyMsg }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', flex: 1, minWidth: 0 }}>
      <p style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>{title}</p>
      {emptyMsg
        ? <p style={{ color: 'var(--color-text)', fontSize: 12, fontStyle: 'italic', margin: 0 }}>{emptyMsg}</p>
        : rows.map(r => <LiveStatRow key={r.label} label={r.label} value={r.value} />)
      }
    </div>
  )
}

function PlayerStatCard({ player, stats, statsLoading }) {
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
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Name + pills */}
      <div>
        <h2 style={{ color: 'var(--color-heading)', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>{player.name}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ background: pal.bg, color: pal.label, border: `1px solid ${pal.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
            Cat {player.category}
          </span>
          <span style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>
            Base {player.base_price.toLocaleString()}
          </span>
          <span style={{
            background: player.is_debut ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
            color: player.is_debut ? '#6ee7b7' : '#93c5fd',
            border: `1px solid ${player.is_debut ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)'}`,
            borderRadius: 20, padding: '2px 10px', fontSize: 12,
          }}>
            {player.is_debut ? 'Debut' : 'Returning'}
          </span>
        </div>
      </div>

      {/* Stats body */}
      {player.is_debut ? (
        <p style={{ color: 'var(--color-text)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
          Debut player — no historical record
        </p>
      ) : statsLoading ? (
        <p style={{ color: 'var(--color-text)', fontSize: 13, margin: 0 }} className="animate-pulse">Loading stats…</p>
      ) : !stats ? (
        <p style={{ color: 'var(--color-text)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>No historical data found.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <LiveStatBlock title="Batting"  rows={battingRows}  emptyMsg={stats.bat_innings  === 0 ? 'Did not bat'  : null} />
            <LiveStatBlock title="Bowling"  rows={bowlingRows}  emptyMsg={stats.bowl_innings === 0 ? 'Did not bowl' : null} />
            <LiveStatBlock title="Fielding" rows={fieldingRows} />
          </div>

          {stats.times_captained > 0 && (
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#93c5fd', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>👑 Captained {stats.times_captained}</span>
              <span>Win% {fmtNum(stats.capt_win_pct_num, 1)}</span>
              <span>{stats.final_appearances} final{stats.final_appearances !== 1 ? 's' : ''}</span>
            </div>
          )}
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
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: pal.bg, borderBottom: `1px solid ${pal.border}`, padding: '10px 14px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: pal.label, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Category {category}
        </span>
        <span style={{ color: pal.text, fontSize: 12 }}>({left} / {players.length} left)</span>
      </div>
      <div style={{ padding: '4px 0', overflowY: 'auto', maxHeight: 400 }}>
        {players.map(p => {
          const isSold = soldIds.has(p.id)
          const isActive = p.id === activeId
          const sale = salesMap[p.id]
          const saleTeam = sale ? teamById[sale.s6_team_id] : null
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 12px',
              background: isActive ? pal.bg : 'transparent',
              borderLeft: isActive ? `3px solid ${pal.border.replace('0.35','0.8')}` : '3px solid transparent',
            }}>
              <span style={{
                color: isSold ? 'var(--color-border)' : isActive ? pal.label : 'var(--color-heading)',
                fontSize: 12, textDecoration: isSold ? 'line-through' : 'none',
                opacity: isSold ? 0.55 : 1, flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {p.name}
              </span>
              {isSold && saleTeam && (
                <span style={{ color: 'var(--color-text)', fontSize: 10, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  → {saleTeam.name} · ${sale.price}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LiveAuctionTab() {
  // ── data ──────────────────────────────────────────────────────────────────
  const [s6Players, setS6Players] = useState([])
  const [s6Teams,   setS6Teams]   = useState([])
  const [sales,     setSales]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  // ── player selection + stats ───────────────────────────────────────────────
  const [selected,     setSelected]     = useState(null)
  const [stats,        setStats]        = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // ── search ────────────────────────────────────────────────────────────────
  const [searchQuery,       setSearchQuery]       = useState('')
  const [searchOpen,        setSearchOpen]        = useState(false)
  const [showBiddingSearch, setShowBiddingSearch] = useState(false)
  const selecting = useRef(false)

  // ── bidding ───────────────────────────────────────────────────────────────
  const [currentBid,  setCurrentBid]  = useState(0)
  const [displayBid,  setDisplayBid]  = useState(0)
  const [highBidder,  setHighBidder]  = useState(null) // s6_team_id | null
  const [pulsePaddle, setPulsePaddle] = useState(null)
  const bidAnimRef = useRef(null)

  // ── selling ───────────────────────────────────────────────────────────────
  const [selling,  setSelling]  = useState(false)
  const [lastSale, setLastSale] = useState(null) // { saleId, playerName, teamName, price, teamColor }

  // ── celebration overlay ───────────────────────────────────────────────────
  const [soldOverlay,       setSoldOverlay]       = useState(null)
  const overlayAborted      = useRef(false)
  const overlayTimeoutRef   = useRef(null)

  // ── manual bid ────────────────────────────────────────────────────────────
  const [showManualBid,  setShowManualBid]  = useState(false)
  const [manualBidInput, setManualBidInput] = useState('')
  const [manualBidTeamId,setManualBidTeamId]= useState('')

  // ── undo confirm ──────────────────────────────────────────────────────────
  const [undoConfirm, setUndoConfirm] = useState(false)

  // ── toast ─────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState('')

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

  // ── keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
      if (e.key === '/') {
        if (inInput) return
        e.preventDefault()
        if (soldOverlay) { abortOverlay(); return }
        if (selected) {
          setShowBiddingSearch(true)
          setTimeout(() => searchRef.current?.focus(), 50)
        } else {
          searchRef.current?.focus()
        }
      }
      if (e.key === 'Escape') {
        if (soldOverlay) { abortOverlay(); return }
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
  }, [selected, highBidder, selling, soldOverlay]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── utilities ─────────────────────────────────────────────────────────────

  function animateBid(from, to) {
    if (bidAnimRef.current) cancelAnimationFrame(bidAnimRef.current)
    const start = performance.now()
    const duration = 250
    function tick(now) {
      const t = Math.min((now - start) / duration, 1)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      const v = from + (to - from) * ease
      setDisplayBid(v)
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
  }

  function handlePaddleClick(teamId) {
    if (!selected) return
    if (teamId === highBidder) { toast(`Already winning at $${currentBid}`); return }
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
    setSoldOverlay({ playerName, teamName, price, teamColor })
    overlayAborted.current = false
    confetti({ particleCount: 180, spread: 90, origin: { y: 0.45 }, colors: [teamColor || '#3b82f6', '#f59e0b', '#fff', '#34d399'], disableForReducedMotion: true })
    clearTimeout(overlayTimeoutRef.current)
    overlayTimeoutRef.current = setTimeout(() => {
      if (!overlayAborted.current) { setSoldOverlay(null); setTimeout(() => searchRef.current?.focus(), 50) }
    }, 2000)
  }

  function abortOverlay() {
    overlayAborted.current = true
    clearTimeout(overlayTimeoutRef.current)
    setSoldOverlay(null)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  // ── sell / undo ────────────────────────────────────────────────────────────

  async function handleSell() {
    if (!selected || !highBidder || selling) return
    const team = teamInfo.find(t => t.id === highBidder)
    if (!team || team.slotsLeft <= 0 || team.remaining < currentBid) return
    setSelling(true)
    const tempId = `opt-${Date.now()}`
    const salePayload = { s6_player_id: selected.id, s6_team_id: highBidder, price: currentBid }
    setSales(prev => [...prev, { id: tempId, ...salePayload, voided: false, sold_at: new Date().toISOString() }])
    const captured = { playerName: selected.name, teamName: team.name, price: currentBid, teamColor: team.color }
    clearPlayer()
    const { data, error: insertErr } = await supabase.from('auction_sales').insert(salePayload).select().single()
    if (insertErr) {
      setSales(prev => prev.filter(s => s.id !== tempId))
      setSelling(false)
      toast('Sale failed — please retry')
      return
    }
    setSales(prev => prev.map(s => s.id === tempId ? data : s))
    setLastSale({ saleId: data.id, ...captured })
    setSelling(false)
    triggerCelebration(captured.playerName, captured.teamName, captured.price, captured.teamColor)
  }

  async function handleUndo() {
    if (!lastSale?.saleId) return
    const { error: updErr } = await supabase.from('auction_sales').update({ voided: true }).eq('id', lastSale.saleId)
    if (updErr) { toast('Undo failed'); return }
    setSales(prev => prev.map(s => s.id === lastSale.saleId ? { ...s, voided: true } : s))
    setLastSale(null); setUndoConfirm(false)
    toast('Sale undone')
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
    const pool = q ? available.filter(p => p.name.toLowerCase().includes(q)) : available
    return pool.slice(0, 12)
  }, [available, searchQuery])

  const teamInfo = useMemo(() => s6Teams.map(team => {
    const ts = sales.filter(s => !s.voided && s.s6_team_id === team.id)
    const spent = ts.reduce((sum, s) => sum + s.price, 0)
    return { ...team, spent, remaining: team.budget_total - spent, slotsUsed: ts.length, slotsLeft: MAX_SLOTS - ts.length }
  }), [s6Teams, sales])

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

  const inc = selected ? BID_INCREMENT[selected.category] : 0
  const nextBidPrice = selected ? (highBidder === null ? currentBid : currentBid + inc) : 0
  const highBidderTeam = highBidder ? teamInfo.find(t => t.id === highBidder) : null
  const allTeamsBroke = selected && teamInfo.length > 0 &&
    teamInfo.every(t => t.id === highBidder || t.slotsLeft <= 0 || t.remaining < nextBidPrice)

  function fmtBid(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1) }

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

      {/* SOLD overlay */}
      {soldOverlay && (
        <div onClick={abortOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 150, cursor: 'pointer', animation: 'fadeIn 0.15s ease' }}>
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 10, animation: 'slideUp 0.2s ease both' }}>SOLD TO</div>
            <div style={{ fontSize: 56, fontWeight: 900, color: soldOverlay.teamColor || '#f59e0b', lineHeight: 1, marginBottom: 6, animation: 'slideUp 0.2s ease 0.06s both' }}>{soldOverlay.teamName}</div>
            <div style={{ fontSize: 88, fontWeight: 900, color: '#fbbf24', lineHeight: 1, marginBottom: 14, fontVariantNumeric: 'tabular-nums', animation: 'slideUp 0.25s ease 0.12s both' }}>${soldOverlay.price}</div>
            <div style={{ fontSize: 22, color: '#d1d5db', fontWeight: 500, animation: 'slideUp 0.25s ease 0.18s both' }}>{soldOverlay.playerName}</div>
            <div style={{ marginTop: 28, color: '#6b7280', fontSize: 12 }}>tap or press / to continue</div>
          </div>
        </div>
      )}

      {/* Undo confirm dialog */}
      {undoConfirm && lastSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 28, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>Undo sale?</p>
            <p style={{ color: 'var(--color-text)', fontSize: 13, margin: '0 0 20px' }}>{lastSale.playerName} → {lastSale.teamName} for ${lastSale.price}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={handleUndo} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Yes, undo</button>
              <button onClick={() => setUndoConfirm(false)} style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* (undo now lives above the paddle row) */}

      {/* ── IDLE STATE ────────────────────────────────────────────────────── */}
      {!selected && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '42vh', paddingTop: 48, paddingBottom: 24, gap: 20 }}>
          {available.length === 0 ? (
            <p style={{ color: 'var(--color-heading)', fontSize: 22, fontWeight: 700 }}>🎉 All players auctioned!</p>
          ) : (
            <>
              <div style={{ width: '100%', maxWidth: 540, position: 'relative' }}>
                <input
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
                />
                {searchOpen && searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginTop: 4, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
                    {searchResults.map(p => (
                      <div key={p.id} onMouseDown={() => { selecting.current = true }} onClick={() => { selecting.current = false; selectPlayer(p) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }} className="hover:bg-blue-500/10">
                        <span style={{ background: CAT_PALETTE[p.category].bg, color: CAT_PALETTE[p.category].label, border: `1px solid ${CAT_PALETTE[p.category].border}`, borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{p.category}</span>
                        <span style={{ color: 'var(--color-heading)', fontSize: 15, fontWeight: 500 }}>{p.name}</span>
                        <span style={{ color: 'var(--color-text)', fontSize: 13, marginLeft: 'auto', flexShrink: 0 }}>${p.base_price}</span>
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
                        <span style={{ color: 'var(--color-text)', fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>${p.base_price}</span>
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

          {/* Stat card + category roster */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 60%', minWidth: 0, animation: 'slideUp 0.2s ease both' }}>
              <PlayerStatCard player={selected} stats={stats} statsLoading={statsLoading} />
            </div>
            <div style={{ flex: '0 0 40%', minWidth: 0, animation: 'slideUp 0.2s ease 0.06s both' }}>
              <CategoryRosterPanel category={selected.category} players={categoryRoster} activeId={selected.id} soldIds={soldIds} salesMap={salesBySixPlayer} teamInfo={teamInfo} />
            </div>
          </div>

          {/* Current bid strip */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 18px', animation: 'slideUp 0.2s ease 0.1s both' }}>
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {highBidder ? (
                <>
                  <div>
                    <div style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 1 }}>Current Bid</div>
                    <div style={{ color: 'var(--color-heading)', fontSize: 52, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>${fmtBid(displayBid)}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Held by</div>
                    <span style={{ background: highBidderTeam?.color || 'var(--color-accent)', color: '#fff', borderRadius: 20, padding: '4px 16px', fontSize: 16, fontWeight: 700, display: 'inline-block', animation: 'slideInRight 0.2s ease both' }}>
                      {highBidderTeam?.name}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ color: 'var(--color-text)', fontSize: 18 }}>Awaiting first bid</span>
                  <span style={{ color: 'var(--color-border)' }}>·</span>
                  <span style={{ color: 'var(--color-heading)', fontSize: 18, fontWeight: 700 }}>Base ${selected.base_price}</span>
                </div>
              )}
              <button
                onClick={() => setShowManualBid(v => !v)}
                style={{ marginLeft: highBidder ? 12 : 'auto', color: '#6b7280', background: 'transparent', border: 'none', padding: '2px 6px', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0, whiteSpace: 'nowrap' }}
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
        </div>
      )}

      {/* ── PADDLES + SOLD ROW (always rendered) ────────────────────────── */}
      <div style={{ marginTop: selected ? 14 : 28 }}>

        {/* Undo strip — above paddles, right-aligned */}
        {lastSale && !soldOverlay && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              onClick={() => setUndoConfirm(true)}
              style={{ color: 'var(--color-text)', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              ↶ Undo last sale
            </button>
          </div>
        )}

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
        {/* Team paddles */}
        {teamInfo.map(team => {
          const isHighBidder = team.id === highBidder
          const canAffordNext = team.remaining >= nextBidPrice
          const hasSlots = team.slotsLeft > 0
          const disabled = !selected || !hasSlots || !canAffordNext
          const isPulsing = pulsePaddle === team.id
          return (
            <div key={team.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ color: selected ? (isHighBidder ? 'var(--color-heading)' : 'var(--color-text)') : 'var(--color-border)', fontSize: 11, fontWeight: isHighBidder ? 700 : 600, fontVariantNumeric: 'tabular-nums' }}>
                ${team.spent} / ${team.budget_total}
              </span>
              <button
                onClick={() => handlePaddleClick(team.id)}
                disabled={disabled && !isHighBidder}
                title={!hasSlots ? 'No slots left' : !canAffordNext && selected ? 'Out of budget' : undefined}
                style={{
                  width: '100%', flex: 1,
                  background: !selected ? 'var(--color-surface)' : isHighBidder ? team.color : disabled ? 'rgba(255,255,255,0.04)' : team.color,
                  color: !selected ? 'var(--color-border)' : (isHighBidder || !disabled) ? '#fff' : 'var(--color-text)',
                  border: isHighBidder
                    ? '2px solid rgba(255,255,255,0.85)'
                    : `2px solid ${!selected ? 'var(--color-border)' : disabled ? 'rgba(255,255,255,0.08)' : team.color}`,
                  borderRadius: 12, padding: '13px 8px', fontSize: 14, fontWeight: 700,
                  cursor: (!selected || (disabled && !isHighBidder)) ? 'default' : 'pointer',
                  opacity: !selected ? 0.4 : (disabled && !isHighBidder) ? 0.3 : 1,
                  transform: isPulsing ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 0.15s, opacity 0.2s, background 0.15s, border-color 0.15s',
                  boxShadow: isHighBidder ? `0 0 22px ${team.color}66` : 'none',
                }}
              >
                {team.name}
              </button>
            </div>
          )
        })}

        {/* SOLD — same height as paddles, distinct colour */}
        {(() => {
          const soldActive = !!(selected && highBidder && !selling)
          return (
            <div style={{ flexShrink: 0, width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: 'transparent', userSelect: 'none' }}>·</span>
              <button
                onClick={handleSell}
                disabled={!soldActive}
                style={{
                  width: '100%', flex: 1,
                  background: soldActive ? '#F2C033' : 'rgba(255,255,255,0.04)',
                  color: soldActive ? '#1a1200' : '#6b7280',
                  border: `2px solid ${soldActive ? '#F2C033' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 30,
                  padding: '13px 10px',
                  fontSize: 18, fontWeight: 900,
                  cursor: soldActive ? 'pointer' : 'default',
                  opacity: soldActive ? 1 : 0.35,
                  transition: 'background 0.15s, opacity 0.2s',
                  letterSpacing: '0.04em',
                  animation: soldActive ? 'soldPulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {selling ? '…' : '🔨 SOLD'}
              </button>
            </div>
          )
        })()}
      </div>
      </div>
    </div>
  )
}

// ─── AuctionApp ───────────────────────────────────────────────────────────────

function AuctionApp() {
  const [activeTab, setActiveTab] = useState('Setup')

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
      <div
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
        className="px-4 sm:px-6 overflow-x-auto"
      >
        <div className="flex gap-1 min-w-max">
          {TABS.map(tab => {
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
        {activeTab === 'Setup'        && <SetupTab />}
        {activeTab === 'Categories'   && <CategoriesTab />}
        {activeTab === 'Live Auction' && <LiveAuctionTab />}
        {!['Setup', 'Categories', 'Live Auction'].includes(activeTab) && (
          <div className="flex items-center justify-center py-20">
            <p style={{ color: 'var(--color-text)' }} className="text-sm italic">
              {activeTab} — coming soon
            </p>
          </div>
        )}
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
