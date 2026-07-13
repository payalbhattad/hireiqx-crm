import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import Pipeline from './pages/Pipeline'
import Tasks from './pages/Tasks'
import DealDetail from './pages/DealDetail'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/deals/:id" element={<DealDetail />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute adminOnly>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
