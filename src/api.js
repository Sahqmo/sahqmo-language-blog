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

// 글 목록은 여러 화면(홈/태그/에디터)이 쓰므로 잠시 재사용. 글·로그인 상태가 바뀌면 비움
const LIST_TTL = 30_000
let listCache = null // { promise, at }
const changed = (data) => {
  listCache = null
  return data
}

export const api = {
  authStatus: () => request('/api/auth/status'),
  login: (password) => request('/api/auth/login', json('POST', { password })).then(changed),
  setupPassword: (password) => request('/api/auth/setup', json('POST', { password })).then(changed),
  logout: () => request('/api/auth/logout', { method: 'POST' }).then(changed),
  list: () => {
    if (!listCache || Date.now() - listCache.at > LIST_TTL) {
      const promise = request('/api/posts')
      const entry = { promise, at: Date.now() }
      listCache = entry
      promise.catch(() => listCache === entry && (listCache = null))
    }
    return listCache.promise
  },
  get: (ref) => request(`/api/posts/${encodeURIComponent(ref)}`),
  create: (post) => request('/api/posts', json('POST', post)).then(changed),
  update: (ref, post) => request(`/api/posts/${encodeURIComponent(ref)}`, json('PUT', post)).then(changed),
  remove: (ref) => request(`/api/posts/${encodeURIComponent(ref)}`, { method: 'DELETE' }).then(changed),
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
