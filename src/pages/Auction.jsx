import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'Setup'
          ? <SetupTab />
          : (
            <div className="flex items-center justify-center py-20">
              <p style={{ color: 'var(--color-text)' }} className="text-sm italic">
                {activeTab} — coming soon
              </p>
            </div>
          )
        }
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
