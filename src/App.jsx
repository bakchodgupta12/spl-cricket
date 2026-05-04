import { Routes, Route, useLocation } from 'react-router-dom'
import SiteNav from './components/layout/SiteNav'
import Landing from './pages/Landing'
import Players from './pages/Players'
import PlayerProfile from './pages/PlayerProfile'
import SeasonView from './pages/SeasonView'
import Auction, { AuctionTeamsPublic } from './pages/Auction'
import SplS6 from './pages/SplS6'

export default function App() {
  const loc = useLocation()
  const isPublicTeams = loc.pathname === '/auction/teams-public'
  const isSplS6 = loc.pathname === '/spl-s6'

  if (isPublicTeams) {
    return (
      <Routes>
        <Route path="/auction/teams-public" element={<AuctionTeamsPublic />} />
      </Routes>
    )
  }

  if (isSplS6) {
    return (
      <Routes>
        <Route path="/spl-s6" element={<SplS6 />} />
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
