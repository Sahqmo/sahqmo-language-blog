import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { ready, configured, loggedIn, login, setup } = useAuth()
  const navigate = useNavigate()
  const from = useLocation().state?.from || '/'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!ready) return <p className="state">불러오는 중…</p>
  if (loggedIn) return <Navigate to={from} replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!configured && password !== confirm) return setError('비밀번호가 서로 달라요.')
    setBusy(true)
    try {
      await (configured ? login(password) : setup(password))
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>{configured ? '로그인' : '처음 오셨네요'}</h1>
      <p>
        {configured
          ? '글을 쓰고 고치려면 로그인이 필요해요.'
          : '관리자 비밀번호를 정해 주세요. (8자 이상)'}
      </p>
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={configured ? 'current-password' : 'new-password'}
        autoFocus
      />
      {!configured && (
        <input
          type="password"
          placeholder="비밀번호 확인"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      )}
      {error && <div className="status">{error}</div>}
      <button className="btn" disabled={busy || !password}>
        {configured ? '로그인' : '비밀번호 설정'}
      </button>
    </form>
  )
}
