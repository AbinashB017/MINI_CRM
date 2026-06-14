import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard      from './pages/Dashboard'
import Customers      from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Segments       from './pages/Segments'
import SegmentNew     from './pages/SegmentNew'
import Campaigns      from './pages/Campaigns'
import CampaignNew    from './pages/CampaignNew'
import CampaignDetail from './pages/CampaignDetail'
import Chat           from './pages/Chat'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"         element={<Dashboard />} />
          <Route path="customers"         element={<Customers />} />
          <Route path="customers/:id"     element={<CustomerDetail />} />
          <Route path="segments"          element={<Segments />} />
          <Route path="segments/new"      element={<SegmentNew />} />
          <Route path="campaigns"         element={<Campaigns />} />
          <Route path="campaigns/new"     element={<CampaignNew />} />
          <Route path="campaigns/:id"     element={<CampaignDetail />} />
          <Route path="chat"              element={<Chat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}