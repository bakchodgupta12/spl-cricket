import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toPng } from 'html-to-image'
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

function CategoryColumn({ category, players, captainMap }) {
  const pal = CAT_PALETTE[category]
  return (
    <div style={{
      background: pal.bg,
      border: `1px solid ${pal.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      flex: 1,
      minWidth: 0,
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
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {players.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
            No players assigned
          </p>
        ) : players.map((p, i) => {
          const teamName = captainMap.get(p.id)
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 26, overflow: 'hidden' }}>
              <span style={{ color: MUTED, fontSize: 11, minWidth: 20, textAlign: 'right', flexShrink: 0 }}>
                {i + 1}.
              </span>
              <span style={{ color: HEADING, fontSize: 13, whiteSpace: 'nowrap' }}>{p.name}</span>
              {teamName && <span style={{ fontSize: 12, flexShrink: 0, lineHeight: 1 }}>👑</span>}
              {teamName && (
                <span style={{ color: pal.text, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {teamName}
                </span>
              )}
            </div>
          )
        })}
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
              Auction date: 2 May, 9 PM (Bangkok time)
            </p>
          </div>
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
              captainMap={captainMap}
            />
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: BORDER }} />

        {/* Footer */}
        <p style={{ color: MUTED, fontSize: 11, textAlign: 'center', margin: 0 }}>
          {s6Players.length} player{s6Players.length !== 1 ? 's' : ''} across {s6Teams.length} team{s6Teams.length !== 1 ? 's' : ''} · Auction budget: {budgetDisplay} per team
        </p>
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

function LiveAuctionTab() {
  const [s6Players, setS6Players]   = useState([])
  const [s6Teams,   setS6Teams]     = useState([])
  const [sales,     setSales]       = useState([])
  const [loading,   setLoading]     = useState(true)
  const [error,     setError]       = useState(null)

  const [selected,      setSelected]      = useState(null)
  const [stats,         setStats]         = useState(null)
  const [statsLoading,  setStatsLoading]  = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen,  setSearchOpen]  = useState(false)
  const selecting = useRef(false)

  const [salePrice,   setSalePrice]   = useState('')
  const [buyerTeamId, setBuyerTeamId] = useState('')
  const [selling,     setSelling]     = useState(false)
  const [lastSale,    setLastSale]    = useState(null)   // { saleId, playerName, teamName, price }
  const [toastMsg,    setToastMsg]    = useState('')

  const searchRef  = useRef(null)
  const priceRef   = useRef(null)

  // ── initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [pRes, tRes, sRes] = await Promise.all([
          supabase.from('s6_players').select('*').order('name'),
          supabase.from('s6_teams').select('*').order('name'),
          supabase.from('auction_sales').select('*').eq('voided', false),
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
      if (pRes.error || sqRes.error || batRes.error || bowlRes.error || fieldRes.error || sRes.error) {
        setStats(null)
        return
      }
      const seasonNumById = {}
      for (const s of sRes.data) seasonNumById[s.id] = s.number
      setStats(computePlayerStats(pRes.data, sqRes.data, batRes.data, bowlRes.data, fieldRes.data, seasonNumById))
    }).catch(() => setStats(null)).finally(() => setStatsLoading(false))
  }, [selected])

  // ── keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSelected(null); setStats(null)
        setSearchQuery(''); setSalePrice(''); setBuyerTeamId('')
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── toast helper ─────────────────────────────────────────────────────────────

  function toast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  // ── derived state ────────────────────────────────────────────────────────────

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
    return pool.slice(0, 15)
  }, [available, searchQuery])

  const teamInfo = useMemo(() => s6Teams.map(team => {
    const teamSales = sales.filter(s => !s.voided && s.s6_team_id === team.id)
    const spent = teamSales.reduce((sum, s) => sum + s.price, 0)
    return { ...team, spent, remaining: team.budget_total - spent, slotsUsed: teamSales.length, slotsLeft: MAX_SLOTS - teamSales.length }
  }), [s6Teams, sales])

  const priceNum = Number(salePrice) || 0
  const noEligibleBuyer = selected && priceNum > 0 &&
    teamInfo.every(t => t.slotsLeft <= 0 || t.remaining < priceNum)

  const footerStats = useMemo(() => {
    const r = {}
    for (const cat of CATEGORIES) {
      const catPool = s6Players.filter(p => p.category === cat && !captainIds.has(p.id))
      r[cat] = { total: catPool.length, left: catPool.filter(p => !soldIds.has(p.id)).length }
    }
    return r
  }, [s6Players, captainIds, soldIds])

  const totalSold = sales.filter(s => !s.voided).length

  // ── sell ─────────────────────────────────────────────────────────────────────

  async function handleSell() {
    if (!selected || !buyerTeamId || priceNum <= 0 || selling) return
    const team = teamInfo.find(t => t.id === buyerTeamId)
    if (!team || team.slotsLeft <= 0 || team.remaining < priceNum) return

    setSelling(true)
    const tempId = `opt-${Date.now()}`
    const optimistic = { id: tempId, s6_player_id: selected.id, s6_team_id: buyerTeamId, price: priceNum, voided: false, sold_at: new Date().toISOString() }
    setSales(prev => [...prev, optimistic])
    setLastSale({ saleId: null, playerName: selected.name, teamName: team.name, price: priceNum })
    const prevSelected = selected
    setSelected(null); setStats(null); setSearchQuery(''); setSalePrice(''); setBuyerTeamId('')
    setTimeout(() => searchRef.current?.focus(), 50)

    const { data, error: insertErr } = await supabase
      .from('auction_sales')
      .insert({ s6_player_id: prevSelected.id, s6_team_id: buyerTeamId, price: priceNum })
      .select().single()

    if (insertErr) {
      setSales(prev => prev.filter(s => s.id !== tempId))
      setLastSale(null)
      toast('Sale failed — please retry')
    } else {
      setSales(prev => prev.map(s => s.id === tempId ? data : s))
      setLastSale(prev => prev ? { ...prev, saleId: data.id } : null)
    }
    setSelling(false)
  }

  async function handleUndo() {
    if (!lastSale?.saleId) return
    const { error: updErr } = await supabase
      .from('auction_sales').update({ voided: true }).eq('id', lastSale.saleId)
    if (updErr) { toast('Undo failed'); return }
    setSales(prev => prev.map(s => s.id === lastSale.saleId ? { ...s, voided: true } : s))
    setLastSale(null)
  }

  function selectPlayer(p) {
    setSelected(p)
    setSalePrice(String(p.base_price))
    setBuyerTeamId('')
    setSearchQuery('')
    setSearchOpen(false)
    setTimeout(() => priceRef.current?.focus(), 50)
  }

  const sellDisabled = !selected || !buyerTeamId || priceNum <= 0 || selling ||
    (() => { const t = teamInfo.find(t => t.id === buyerTeamId); return t && (t.slotsLeft <= 0 || t.remaining < priceNum) })()

  const onSellKey = e => { if (e.key === 'Enter') handleSell() }

  // ── render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <span style={{ color: 'var(--color-text)' }} className="text-sm animate-pulse">Loading…</span>
    </div>
  )
  if (error) return <p style={{ color: '#f87171' }} className="text-sm">{error}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#7f1d1d', color: '#fca5a5', border: '1px solid #f87171',
          borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 100,
        }}>
          {toastMsg}
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Left panel (60%) ────────────────────────────────────────────── */}
        <div style={{ flex: '0 0 60%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {available.length === 0 && !loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <p style={{ color: 'var(--color-heading)', fontSize: 18, fontWeight: 600 }}>
                🎉 All players auctioned!
              </p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search player… (press / to focus)"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => { if (!selecting.current) setSearchOpen(false) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchResults.length > 0) selectPlayer(searchResults[0])
                    if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false) }
                  }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    color: 'var(--color-heading)', borderRadius: 10, padding: '12px 16px',
                    fontSize: 16, outline: 'none',
                  }}
                />
                {searchOpen && searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 10, marginTop: 4, overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}>
                    {searchResults.map(p => (
                      <div
                        key={p.id}
                        onMouseDown={() => { selecting.current = true }}
                        onClick={() => { selecting.current = false; selectPlayer(p) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                        className="hover:bg-blue-500/10"
                      >
                        <span style={{ background: CAT_PALETTE[p.category].bg, color: CAT_PALETTE[p.category].label, border: `1px solid ${CAT_PALETTE[p.category].border}`, borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {p.category}
                        </span>
                        <span style={{ color: 'var(--color-heading)', fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                        <span style={{ color: 'var(--color-text)', fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>{p.base_price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stat card */}
              {selected && (
                <PlayerStatCard player={selected} stats={stats} statsLoading={statsLoading} />
              )}
              {!selected && (
                <div style={{ border: '1px dashed var(--color-border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                  <p style={{ color: 'var(--color-text)', fontSize: 14 }}>Search and select a player to see their stats</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right panel (40%) ───────────────────────────────────────────── */}
        <div style={{ flex: '0 0 40%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Sale Price */}
            <div>
              <label style={{ color: 'var(--color-text)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                Sale Price
              </label>
              <input
                ref={priceRef}
                type="number"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                onKeyDown={onSellKey}
                placeholder="Enter price…"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 8, padding: '10px 12px', fontSize: 18, fontWeight: 700, outline: 'none' }}
              />
            </div>

            {/* Buyer Team */}
            <div>
              <label style={{ color: 'var(--color-text)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                Buyer Team
              </label>
              <select
                value={buyerTeamId}
                onChange={e => setBuyerTeamId(e.target.value)}
                onKeyDown={onSellKey}
                style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-heading)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none' }}
              >
                <option value="">Select team…</option>
                {teamInfo.map(t => {
                  const ineligible = t.slotsLeft <= 0 || t.remaining < priceNum
                  return (
                    <option key={t.id} value={t.id} disabled={ineligible}>
                      {t.name} · {t.slotsLeft}/{MAX_SLOTS} slots · {t.remaining.toLocaleString()} left
                    </option>
                  )
                })}
              </select>
              {noEligibleBuyer && (
                <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 6 }}>
                  No team can buy this player at {priceNum.toLocaleString()}
                </p>
              )}
            </div>

            {/* Sell button */}
            <button
              onClick={handleSell}
              disabled={sellDisabled}
              style={{
                background: sellDisabled ? 'var(--color-border)' : '#22c55e',
                color: sellDisabled ? 'var(--color-text)' : '#fff',
                border: 'none', borderRadius: 10, padding: '14px 0',
                fontSize: 16, fontWeight: 700, cursor: sellDisabled ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {selling ? 'Selling…' : 'Sell'}
            </button>

            {/* Last sale */}
            {lastSale && (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: '#86efac', fontSize: 12 }}>
                  {lastSale.playerName} → {lastSale.teamName} · {lastSale.price.toLocaleString()}
                </span>
                <button
                  onClick={handleUndo}
                  disabled={!lastSale.saleId}
                  style={{ color: '#f87171', background: 'transparent', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 6, padding: '2px 10px', fontSize: 12, cursor: lastSale.saleId ? 'pointer' : 'default', opacity: lastSale.saleId ? 1 : 0.4 }}
                >
                  Undo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer strip ────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <span style={{ color: 'var(--color-text)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Players left</span>
        {CATEGORIES.map(cat => {
          const { left, total } = footerStats[cat] ?? { left: 0, total: 0 }
          const pal = CAT_PALETTE[cat]
          return (
            <span key={cat} style={{ color: left === 0 ? '#34d399' : pal.label, fontSize: 13, fontWeight: 600 }}>
              {cat}: {left}/{total}
            </span>
          )
        })}
        <span style={{ color: 'var(--color-border)', fontSize: 12 }}>·</span>
        <span style={{ color: 'var(--color-text)', fontSize: 12 }}>
          {totalSold} sold
        </span>
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
