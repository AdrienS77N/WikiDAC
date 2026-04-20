import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Territorial from './pages/Territorial'
import Connaissances from './pages/Connaissances'
import Procedures from './pages/Procedures'
import Liens from './pages/Liens'
import AdminTerritorial from './pages/AdminTerritorial'
import AdminUsers from './pages/AdminUsers'
import Dashboard from './pages/Dashboard'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="territorial" element={<Territorial />} />
            <Route path="connaissances" element={<Connaissances />} />
            <Route path="procedures" element={<Procedures />} />
            <Route path="liens" element={<Liens />} />
            <Route path="admin/territorial" element={<AdminTerritorial />} />
            <Route path="admin/users" element={<AdminUsers />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function LoginRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <Login />
}
