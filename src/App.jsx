import { Routes, Route, useLocation } from 'react-router-dom'
import SiteNav from './components/layout/SiteNav'
import Landing from './pages/Landing'
import Players from './pages/Players'
import PlayerProfile from './pages/PlayerProfile'
import SeasonView from './pages/SeasonView'
import Auction, { AuctionTeamsPublic } from './pages/Auction'

export default function App() {
  const loc = useLocation()
  const isPublicTeams = loc.pathname === '/auction/teams-public'

  if (isPublicTeams) {
    return (
      <Routes>
        <Route path="/auction/teams-public" element={<AuctionTeamsPublic />} />
      </Routes>
    )
  }

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
        </Routes>
      </div>
    </div>
  )
}
