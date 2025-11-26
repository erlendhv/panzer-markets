import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { GroupProvider } from './contexts/GroupContext'
import { MarketsPage } from './pages/MarketsPage'
import { MarketDetailPage } from './pages/MarketDetailPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { ProposePage } from './pages/ProposePage'
import { AdminPage } from './pages/AdminPage'
import { ResolvedPage } from './pages/ResolvedPage'
import { CreateGroupPage } from './pages/CreateGroupPage'
import { GroupDetailPage } from './pages/GroupDetailPage'

function App() {
  return (
    <Router>
      <GroupProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<MarketsPage />} />
            <Route path="/market/:marketId" element={<MarketDetailPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/propose" element={<ProposePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/resolved" element={<ResolvedPage />} />
            <Route path="/groups/create" element={<CreateGroupPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
          </Routes>
        </Layout>
      </GroupProvider>
    </Router>
  )
}

export default App
