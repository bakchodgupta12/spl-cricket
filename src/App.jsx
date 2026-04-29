import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Players from './pages/Players'
import PlayerProfile from './pages/PlayerProfile'
import SeasonView from './pages/SeasonView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/players" element={<Players />} />
      <Route path="/players/:id" element={<PlayerProfile />} />
      <Route path="/seasons/:n" element={<SeasonView />} />
    </Routes>
  )
}
