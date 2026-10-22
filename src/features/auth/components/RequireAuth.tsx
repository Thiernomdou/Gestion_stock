import { Navigate, Outlet } from 'react-router-dom'
import { FullPageLoader } from '@/components/full-page-loader'
import { useAuth } from '../store'

export function RequireAuth() {
  const { session, ready } = useAuth()
  if (!ready) return <FullPageLoader />
  if (!session) return <Navigate to="/connexion" replace />
  return <Outlet />
}
