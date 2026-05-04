import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FinalTeamListView, ScheduleTab } from './Auction'

const BG       = '#060608'
const SURFACE  = '#0e0e10'
const BORDER   = 'rgba(255,255,255,0.07)'
const MUTED    = 'rgba(250,250,250,0.52)'
const HEADING  = '#f5f5f5'
const ACCENT   = '#4d8eff'
const GOLD     = '#FFC940'

const TABS = [
  { key: 'teams',    label: 'Teams' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'rules',    label: 'Rules' },
]

const VALID_TABS = new Set(TABS.map(t => t.key))

export default function SplS6() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const activeTab = VALID_TABS.has(requested) ? requested : 'teams'

  function setTab(key) {
    const next = new URLSearchParams(searchParams)
    if (key === 'teams') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  return (
    <div style={{ background: BG, minHeight: '100dvh' }}>
      {/* Page header */}
      <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: '14px 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/spl-logo.svg" alt="SPL" style={{ height: 32, width: 'auto' }} />
            <span style={{ color: HEADING, fontWeight: 700, fontSize: 15, letterSpacing: '0.01em' }}>
              Superball Premier League — Season 6
            </span>
          </Link>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 4, overflowX: 'auto' }}>
          {TABS.map(({ key, label }) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  background: 'transparent',
                  color: active ? HEADING : MUTED,
                  border: 'none',
                  borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                  padding: '12px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 16px' }}>
        {activeTab === 'teams'    && <FinalTeamListView />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'rules'    && <RulesTab />}
      </div>
    </div>
  )
}

// ─── RulesTab ─────────────────────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <p style={{
      color: MUTED, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', margin: '0 0 10px',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ color: ACCENT, fontSize: 9 }}>•</span> {children}
    </p>
  )
}

function Para({ children, dim = false }) {
  return (
    <p style={{
      color: dim ? MUTED : HEADING,
      fontSize: 14, lineHeight: 1.65, margin: '0 0 12px',
    }}>
      {children}
    </p>
  )
}

function NumberedList({ items }) {
  return (
    <ol style={{ margin: '0 0 14px', padding: 0, listStyle: 'none', counterReset: 'rule' }}>
      {items.map((item, i) => (
        <li key={i} style={{
          display: 'flex', gap: 12, padding: '8px 0',
          borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none',
        }}>
          <span style={{
            color: GOLD, fontSize: 12, fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 22, flexShrink: 0, paddingTop: 2,
          }}>
            {i + 1}.
          </span>
          <span style={{ color: HEADING, fontSize: 14, lineHeight: 1.6 }}>{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Bullet({ children }) {
  return (
    <li style={{ display: 'flex', gap: 10, padding: '4px 0', alignItems: 'flex-start' }}>
      <span style={{ color: ACCENT, fontSize: 9, flexShrink: 0, marginTop: 8 }}>•</span>
      <span style={{ color: HEADING, fontSize: 14, lineHeight: 1.6 }}>{children}</span>
    </li>
  )
}

function Bullets({ children }) {
  return <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none' }}>{children}</ul>
}

function Collapsible({ title, defaultOpen = false, forceOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const visible = open || forceOpen
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', padding: '14px 18px',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ color: GOLD, fontSize: 12, minWidth: 14 }}>
          {visible ? '▾' : '▸'}
        </span>
        <span style={{
          color: HEADING, fontSize: 13, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          {title}
        </span>
      </button>
      <div style={{
        display: 'grid',
        gridTemplateRows: visible ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.25s ease',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '4px 22px 22px',
            borderTop: visible ? `1px solid ${BORDER}` : 'none',
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function AuctionRulesContent() {
  return (
    <>
      <Para>
        40 players across 4 categories: 8 As · 12 Bs · 12 Cs · 8 Ds.
      </Para>
      <Para>
        5 captains pre-assigned (in Category B). All other 35 players go through
        the auction.
      </Para>

      <SectionHeading>Team composition</SectionHeading>
      <Para>
        Two valid team combinations, each totalling 8 players including the captain:
      </Para>
      <Bullets>
        <Bullet><strong style={{ color: HEADING }}>Combination 1:</strong> 2A · 2B · 2C · 2D</Bullet>
        <Bullet><strong style={{ color: HEADING }}>Combination 2:</strong> 1A · 3B · 3C · 1D</Bullet>
      </Bullets>
      <Para dim>
        3 teams will end up Combination 1, 2 teams will end up Combination 2.
        Determined by bidding behaviour during the auction, not pre-assigned.
      </Para>

      <SectionHeading>Budget</SectionHeading>
      <Para>Each team starts with a budget of 50,000.</Para>

      <SectionHeading>Bid increments</SectionHeading>
      <Bullets>
        <Bullet><strong style={{ color: HEADING }}>Category A:</strong> starts at 2,000, increments of 500</Bullet>
        <Bullet><strong style={{ color: HEADING }}>Category B:</strong> starts at 1,000, increments of 300</Bullet>
        <Bullet><strong style={{ color: HEADING }}>Category C:</strong> starts at 500, increments of 200</Bullet>
        <Bullet><strong style={{ color: HEADING }}>Category D:</strong> starts at 200, increments of 100</Bullet>
      </Bullets>

      <SectionHeading>Average rule</SectionHeading>
      <Para>
        If only one team is left eligible to buy in a category, the remaining
        player(s) are not auctioned. They are allocated automatically to that
        team at the average price of all players already sold in that category,
        rounded up to the next bid increment.
      </Para>

      <SectionHeading>Example</SectionHeading>
      <Para dim>
        Category A has 8 players. Suppose 3 teams have each bought 2 As, leaving
        2 players unsold and 2 teams still needing one A each.
      </Para>
      <Para dim>
        Player 7 goes to a normal auction between the remaining 2 teams. Player
        8 is automatically allocated to the final team at the average price of
        the 7 As already sold, rounded up to the next 500.
      </Para>

      <SectionHeading>Budget overflow</SectionHeading>
      <Para>
        If the allocated price exceeds your remaining budget, you still receive
        the player and your budget goes negative. You cannot bid further, but
        you remain eligible to receive any future auto-allocated players.
      </Para>
    </>
  )
}

function MatchRulesContent() {
  // Match rulebook — to be finalised. Update this list with the official rules.
  const rules = [
    'Group stage matches are played in two formats: 8-over matches in the morning, 4-over matches in the afternoon. Each team plays every other team once across the two formats.',
    'Standard cricket rules apply unless otherwise specified below.',
    'Each team fields all 8 players. Every player on the bowling side must bowl at least one over (subject to over limits below).',
    'In 8-over matches, no bowler may bowl more than 2 overs. In 4-over matches, no bowler may bowl more than 1 over.',
    'A no-ball or wide adds 1 run to the batting team and is re-bowled. Free hit applies on the delivery following a no-ball.',
    'LBW is not in effect. All other modes of dismissal apply.',
    'Group stage standings: 2 points for a win, 1 point for a tie or no-result, 0 for a loss. Standings are aggregated across both 8-over and 4-over results.',
    'Tiebreakers (in order): head-to-head result, net run rate, total wickets taken.',
    'Top 2 teams qualify directly for Qualifier 1. Teams placed 3rd and 4th play Eliminator 1.',
    'Knockout matches are 8 overs per side. In case of a tie, a Super Over decides the result.',
    'The winner of the Final is crowned SPL Season 6 champion.',
  ]
  return (
    <>
      <Para dim>
        The match rulebook below applies to all SPL Season 6 fixtures. Standard
        cricket rules apply except where stated.
      </Para>
      <NumberedList items={rules} />
    </>
  )
}

function RulesTab() {
  const captureRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  // Force-expand both sections during PDF capture so the export includes everything
  const [forceOpen, setForceOpen] = useState(false)

  async function handleExportPdf() {
    if (!captureRef.current || exporting) return
    setExporting(true)
    setForceOpen(true)
    // Wait for the DOM to commit the expanded sections before capture
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    try {
      const html2pdf = (await import('html2pdf.js')).default
      await html2pdf()
        .set({
          margin: [12, 12, 12, 12],
          filename: 'spl-s6-rules.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, backgroundColor: BG, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(captureRef.current)
        .save()
    } catch (err) {
      console.error('rules pdf export failed', err)
    } finally {
      setExporting(false)
      setForceOpen(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div ref={captureRef} style={{
        background: BG, borderRadius: 12, border: `1px solid ${BORDER}`,
        padding: 28, display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src="/spl-logo.svg" alt="SPL" style={{ height: 64, width: 'auto', flexShrink: 0 }} />
          <div>
            <h1 style={{ color: HEADING, fontSize: 20, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
              Superball Premier League — Season 6 Rulebook
            </h1>
            <p style={{ color: MUTED, fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              Auction & match rules
            </p>
          </div>
        </div>

        <div style={{ height: 1, background: BORDER }} />

        <Collapsible
          title="Auction Rules"
          defaultOpen={true}
          forceOpen={forceOpen}
        >
          <AuctionRulesContent />
        </Collapsible>

        <Collapsible
          title="Match Rules"
          defaultOpen={false}
          forceOpen={forceOpen}
        >
          <MatchRulesContent />
        </Collapsible>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          style={{
            background: exporting ? SURFACE : ACCENT,
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 13, fontWeight: 600,
            cursor: exporting ? 'default' : 'pointer',
            opacity: exporting ? 0.6 : 1,
            fontFamily: 'inherit',
          }}
        >
          {exporting ? 'Exporting…' : '↓ Export as PDF'}
        </button>
      </div>
    </div>
  )
}
