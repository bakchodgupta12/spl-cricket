import { Routes, Route } from 'react-router-dom'
import SiteNav from './components/layout/SiteNav'
import Landing from './pages/Landing'
import Players from './pages/Players'
import PlayerProfile from './pages/PlayerProfile'
import SeasonView from './pages/SeasonView'
import Auction, { TeamDashboardView } from './pages/Auction'

export default function App() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <SiteNav />
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerProfile />} />
          <Route path="/seasons/:n" element={<SeasonView />} />
          <Route path="/auction" element={<Auction />} />
          <Route path="/auction/teams-public" element={
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
              <h1 style={{ color: 'var(--color-heading)' }} className="text-xl font-bold mb-6">
                SPL Season 6 — Team Dashboard
              </h1>
              <TeamDashboardView />
            </div>
          } />
        </Routes>
      </div>
    </div>
  )
}
