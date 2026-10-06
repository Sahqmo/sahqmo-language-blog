// 단일 관리자 비밀번호 인증. 상태 비저장(HMAC 서명) 쿠키를 사용합니다.
//   data/auth.json  { salt, hash, secret }  — 최초 접속 시 비밀번호 설정 후 생성 (git 제외)
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const DATA = path.resolve(process.cwd(), 'data')
const AUTH_FILE = path.join(DATA, 'auth.json')
const COOKIE = 'blog_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000
const MIN_PASSWORD = 8

let cache = null
async function loadAuth() {
  if (cache) return cache
  try {
    cache = JSON.parse(await fs.readFile(AUTH_FILE, 'utf8'))
  } catch {
    cache = null
  }
  return cache
}

const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, 64).toString('hex')

const sign = (value, secret) =>
  crypto.createHmac('sha256', secret).update(value).digest('hex')

function parseCookies(req) {
  const out = {}
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function setCookie(res, value, maxAgeSec) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}`,
  )
}

export async function isAuthed(req) {
  const auth = await loadAuth()
  const token = parseCookies(req)[COOKIE]
  if (!auth || !token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const expected = sign(exp, auth.secret)
  return (
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
}

function issueSession(res, auth) {
  const exp = String(Date.now() + SESSION_MS)
  setCookie(res, `${exp}.${sign(exp, auth.secret)}`, SESSION_MS / 1000)
}

// 로그인 무차별 대입 방지: 실패가 누적되면 잠시 차단
const failures = { count: 0, until: 0 }

export async function handleAuth(action, req, res, { send, readJson }) {
  const auth = await loadAuth()

  if (action === 'status' && req.method === 'GET') {
    return send(res, 200, { configured: !!auth, loggedIn: await isAuthed(req) })
  }

  if (action === 'setup' && req.method === 'POST') {
    if (auth) return send(res, 403, { error: '이미 비밀번호가 설정되어 있어요.' })
    const { password = '' } = await readJson(req)
    if (password.length < MIN_PASSWORD) {
      return send(res, 400, { error: `비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.` })
    }
    const salt = crypto.randomBytes(16).toString('hex')
    cache = { salt, hash: hashPassword(password, salt), secret: crypto.randomBytes(32).toString('hex') }
    await fs.mkdir(DATA, { recursive: true })
    await fs.writeFile(AUTH_FILE, JSON.stringify(cache, null, 2))
    issueSession(res, cache)
    return send(res, 200, { configured: true, loggedIn: true })
  }

  if (action === 'login' && req.method === 'POST') {
    if (!auth) return send(res, 400, { error: '먼저 비밀번호를 설정해 주세요.' })
    if (Date.now() < failures.until) {
      return send(res, 429, { error: '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.' })
    }
    const { password = '' } = await readJson(req)
    const a = Buffer.from(hashPassword(password, auth.salt))
    const b = Buffer.from(auth.hash)
    if (!crypto.timingSafeEqual(a, b)) {
      if (++failures.count >= 5) {
        failures.count = 0
        failures.until = Date.now() + 30_000
      }
      return send(res, 401, { error: '비밀번호가 올바르지 않아요.' })
    }
    failures.count = 0
    issueSession(res, auth)
    return send(res, 200, { configured: true, loggedIn: true })
  }

  if (action === 'logout' && req.method === 'POST') {
    setCookie(res, '', 0)
    return send(res, 200, { configured: !!auth, loggedIn: false })
  }

  return send(res, 404, { error: 'Not found' })
}
