async function request(url, options) {
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`)
  return data
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  authStatus: () => request('/api/auth/status'),
  login: (password) => request('/api/auth/login', json('POST', { password })),
  setupPassword: (password) => request('/api/auth/setup', json('POST', { password })),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  list: () => request('/api/posts'),
  get: (ref) => request(`/api/posts/${encodeURIComponent(ref)}`),
  create: (post) => request('/api/posts', json('POST', post)),
  update: (ref, post) => request(`/api/posts/${encodeURIComponent(ref)}`, json('PUT', post)),
  remove: (ref) => request(`/api/posts/${encodeURIComponent(ref)}`, { method: 'DELETE' }),
  upload: (file) =>
    request(`/api/upload?name=${encodeURIComponent(file.name || 'image.png')}`, {
      method: 'POST',
      body: file,
    }),
}

export const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : ''
