import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from './api.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, configured: true, loggedIn: false })

  useEffect(() => {
    api.authStatus().then((s) => setState({ ready: true, ...s })).catch(() => setState((p) => ({ ...p, ready: true })))
  }, [])

  const apply = useCallback((s) => setState({ ready: true, ...s }), [])
  const value = {
    ...state,
    login: async (password) => apply(await api.login(password)),
    setup: async (password) => apply(await api.setupPassword(password)),
    logout: async () => apply(await api.logout()),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function RequireAuth({ children }) {
  const { ready, loggedIn } = useAuth()
  const location = useLocation()
  if (!ready) return <p className="state">불러오는 중…</p>
  if (!loggedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
