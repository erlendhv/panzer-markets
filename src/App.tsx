import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { MarketsPage } from './pages/MarketsPage'
import { MarketDetailPage } from './pages/MarketDetailPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { ProposePage } from './pages/ProposePage'
import { AdminPage } from './pages/AdminPage'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<MarketsPage />} />
          <Route path="/market/:marketId" element={<MarketDetailPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/propose" element={<ProposePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
