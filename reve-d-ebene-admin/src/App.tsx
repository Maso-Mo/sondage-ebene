import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AdminAuthProvider from './contexts/AdminAuthProvider'
import AdminLayout from './layouts/AdminLayout'
import Administrators from './pages/Administrators'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import OwnerRoute from './routes/OwnerRoute'
import ProtectedRoute from './routes/ProtectedRoute'
import './styles/admin.css'

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="results" element={<Navigate to="/#results" replace />} />
            <Route path="responses" element={<Navigate to="/#responses" replace />} />
            <Route
              path="administrators"
              element={
                <OwnerRoute>
                  <Administrators />
                </OwnerRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  )
}
