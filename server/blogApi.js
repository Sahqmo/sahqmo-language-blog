// 로컬 파일 기반 저장소 API (Vite dev/preview 서버에 붙는 미들웨어)
//   content/posts/<slug>.md   글 (frontmatter + markdown 본문)
//   content/images/<file>     업로드된 이미지/첨부 파일
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { handleAuth, isAuthed } from './auth.js'

const ROOT = path.resolve(process.cwd(), 'content')
const POSTS = path.join(ROOT, 'posts')
const IMAGES = path.join(ROOT, 'images')
const MAX_UPLOAD = 20 * 1024 * 1024

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
}

// ---------- frontmatter ----------
function parseFile(raw) {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const meta = {}
  let body = text
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (m) {
    body = text.slice(m[0].length)
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i < 0) continue
      const key = line.slice(0, i).trim()
      const val = line.slice(i + 1).trim()
      try {
        meta[key] = JSON.parse(val)
      } catch {
        meta[key] = val
      }
    }
  }
  return { meta, body }
}

function serializeFile(meta, body) {
  const lines = Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  return `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`
}

// ---------- helpers ----------
function validName(name) {
  return typeof name === 'string' && name.length > 0 && !/[\\/:*?"<>|]/.test(name) && !name.startsWith('.')
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function readBody(req, limit = MAX_UPLOAD) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 })
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}

async function readJson(req) {
  const buf = await readBody(req, 5 * 1024 * 1024)
  return buf.length ? JSON.parse(buf.toString('utf8')) : {}
}

function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function summarize(slug, meta, body) {
  const excerpt = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#>*_`~\[\]()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
  return {
    id: meta.id,
    private: meta.private === true,
    slug,
    title: meta.title || slug,
    date: meta.date || '',
    updated: meta.updated || '',
    category: typeof meta.category === 'string' ? meta.category : '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    excerpt,
  }
}

// ---------- 글 번호(id) ----------
// 파일명(slug)은 사람이 알아보기 위한 이름일 뿐이고, 글의 식별자는 frontmatter 의 id 입니다.
// id 는 무작위 16진수 5자리 코드(예: "a3f9c")입니다.
const isCode = (id) => typeof id === 'string' && /^[0-9a-f]{5}$/.test(id)
let queue = Promise.resolve()
const locked = (fn) => {
  const run = queue.then(fn)
  queue = run.catch(() => {})
  return run
}

const newId = (taken) => {
  let id
  do id = crypto.randomBytes(3).toString('hex').slice(0, 5)
  while (taken.has(id))
  return id
}

// 파일별 파싱 결과 캐시: 수정 시각/크기가 같으면 다시 읽지 않음
const fileCache = new Map() // 파일명 → { stamp, meta, body }

async function loadAll() {
  const files = (await fs.readdir(POSTS)).filter((f) => f.endsWith('.md'))
  for (const f of fileCache.keys()) if (!files.includes(f)) fileCache.delete(f)
  return Promise.all(
    files.map(async (f) => {
      const file = path.join(POSTS, f)
      const st = await fs.stat(file)
      const stamp = `${st.mtimeMs}:${st.size}`
      let hit = fileCache.get(f)
      if (!hit || hit.stamp !== stamp) {
        hit = { stamp, ...parseFile(await fs.readFile(file, 'utf8')) }
        fileCache.set(f, hit)
      }
      return { slug: f.slice(0, -3), meta: hit.meta, body: hit.body }
    }),
  )
}

// 코드 형식이 아닌 id(없음/예전 순번)를 가진 글에 새 코드를 부여하고, 전체 글 목록을 돌려줌 (반드시 locked 안에서 호출)
async function loadWithIds() {
  const all = await loadAll()
  const taken = new Set(all.map((p) => p.meta.id).filter(isCode))
  for (const p of all) {
    if (isCode(p.meta.id)) continue
    const id = newId(taken)
    taken.add(id)
    p.meta = { ...p.meta, id }
    await fs.writeFile(path.join(POSTS, `${p.slug}.md`), serializeFile({ id, ...p.meta }, p.body))
  }
  for (const p of all) {
    // 파일명은 글 코드로 통일 (예전 제목 기반 이름은 바꿔 줌)
    if (p.slug === p.meta.id) continue
    const target = path.join(POSTS, `${p.meta.id}.md`)
    if (await exists(target)) continue
    await fs.rename(path.join(POSTS, `${p.slug}.md`), target)
    p.slug = p.meta.id
  }
  await migrateImages(all)
  return { all, taken }
}

// 본문에서 쓰인 업로드 이미지 파일명들
function imagesIn(body) {
  const names = new Set()
  for (const m of body.matchAll(/\/content\/images\/([^\s)"'\]]+)/g)) {
    try {
      names.add(decodeURIComponent(m[1]))
    } catch {
      names.add(m[1])
    }
  }
  return names
}

// 삭제한 글에서만 쓰던 이미지 파일을 함께 지움 (다른 글이 쓰는 이미지는 남김)
async function removeUnusedImages(deleted, remaining) {
  const stillUsed = new Set(remaining.flatMap((p) => [...imagesIn(p.body)]))
  for (const name of imagesIn(deleted.body)) {
    if (stillUsed.has(name) || !validName(name) || name !== path.basename(name) || !MIME[path.extname(name).toLowerCase()]) continue
    await fs.unlink(path.join(IMAGES, name)).catch(() => {})
  }
}

// ---------- 안 쓰는 이미지 청소 ----------
// 하루에 한 번(자정을 넘길 때, 그리고 그날 첫 서버 시작 시) 어떤 글에서도 쓰이지 않는 이미지를 지움.
// 안전 원칙: 글 파일 어디에서든(비공개 글, frontmatter 포함) 파일명이 한 번이라도 보이면 절대 지우지 않음.
//   글을 읽는 데 하나라도 실패하거나 글이 0개로 보이면(저장소 이상 가능성) 아무것도 지우지 않음.
//   방금 올려서 아직 글에 저장 전일 수 있는 최근 파일(48시간 이내)은 건드리지 않음.
const DATA = path.resolve(process.cwd(), 'data')
const CLEANUP_FILE = path.join(DATA, 'cleanup.json')
const IMAGE_GRACE_MS = 48 * 60 * 60 * 1000
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function cleanupImages() {
  return locked(async () => {
    await fs.mkdir(POSTS, { recursive: true })
    await fs.mkdir(IMAGES, { recursive: true })
    const files = (await fs.readdir(POSTS)).filter((f) => f.endsWith('.md'))
    if (!files.length) return { deleted: [], skipped: '글이 없어 건너뜀' }
    const texts = await Promise.all(files.map((f) => fs.readFile(path.join(POSTS, f), 'utf8'))) // 하나라도 실패하면 예외 → 중단
    const haystack = texts.join('\n')
    const deleted = []
    for (const name of await fs.readdir(IMAGES)) {
      if (!validName(name) || !MIME[path.extname(name).toLowerCase()]) continue
      if (haystack.includes(name) || haystack.includes(encodeURIComponent(name))) continue
      const file = path.join(IMAGES, name)
      const st = await fs.stat(file)
      if (!st.isFile() || Date.now() - st.mtimeMs < IMAGE_GRACE_MS) continue
      await fs.unlink(file)
      deleted.push(name)
    }
    return { deleted }
  })
}

async function cleanupIfDue() {
  try {
    const today = dayKey()
    const last = JSON.parse(await fs.readFile(CLEANUP_FILE, 'utf8').catch(() => '{}')).lastRun
    if (last === today) return
    const { deleted, skipped } = await cleanupImages()
    // 건너뛴 경우(글 0개 등)는 기록하지 않아 다음 기회에 다시 시도
    if (skipped) return console.log(`[blogApi] 이미지 청소: ${skipped}`)
    await fs.mkdir(DATA, { recursive: true })
    await fs.writeFile(CLEANUP_FILE, JSON.stringify({ lastRun: today }))
    if (deleted.length) console.log(`[blogApi] 안 쓰는 이미지 ${deleted.length}개 삭제`)
  } catch (err) {
    console.error('[blogApi] 이미지 청소 실패 (아무것도 지우지 않았을 수 있음)', err)
  }
}

// 서버가 켜져 있는 동안 자정마다 청소 실행, 시작할 때도 오늘 분을 아직 안 돌렸으면 실행
function scheduleCleanup() {
  let timer
  const arm = () => {
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0)
    timer = setTimeout(async () => {
      await cleanupIfDue()
      arm()
    }, nextMidnight - now)
    timer.unref?.()
  }
  cleanupIfDue()
  arm()
  return () => clearTimeout(timer)
}

// ---------- 이미지 파일명 ----------
// 업로드 이미지는 `YYYYMMDD-HHmmss-xxxx.확장자` 형식으로 저장 (원본 파일명은 보관하지 않음)
const IMAGE_NAME = /^\d{8}-\d{6}-[0-9a-f]{4}\.[a-z0-9]+$/
const pad = (n) => String(n).padStart(2, '0')

async function newImageName(date, ext) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  let name
  do name = `${stamp}-${crypto.randomBytes(2).toString('hex')}${ext}`
  while (await exists(path.join(IMAGES, name)))
  return name
}

// 예전 형식 이미지의 이름을 새 형식으로 바꾸고, 글 본문의 이미지 주소도 함께 고침 (프로세스당 한 번)
let imagesMigrated = false
async function migrateImages(all) {
  if (imagesMigrated) return
  imagesMigrated = true
  const renames = []
  for (const f of await fs.readdir(IMAGES)) {
    const ext = path.extname(f).toLowerCase()
    if (f.startsWith('.') || !MIME[ext] || IMAGE_NAME.test(f)) continue
    const epoch = Number(f.match(/^(\d{13})-/)?.[1])
    const date = epoch ? new Date(epoch) : (await fs.stat(path.join(IMAGES, f))).mtime
    const name = await newImageName(date, ext)
    await fs.rename(path.join(IMAGES, f), path.join(IMAGES, name))
    renames.push([f, name])
  }
  if (!renames.length) return
  for (const p of all) {
    let body = p.body
    for (const [from, to] of renames) {
      for (const old of new Set([from, encodeURIComponent(from)])) {
        body = body.split(`/content/images/${old}`).join(`/content/images/${to}`)
      }
    }
    if (body === p.body) continue
    p.body = body
    await fs.writeFile(path.join(POSTS, `${p.slug}.md`), serializeFile(p.meta, body))
  }
}

// 주소의 식별자: id 코드, 아니면 (예전 주소) 파일명 slug
const findPost = (all, ref) => all.find((p) => p.meta.id === ref) || all.find((p) => p.slug === ref)

const toPost = (p) => ({ ...summarize(p.slug, p.meta, p.body), content: p.body })

const listPosts = (authed) =>
  locked(async () => {
    const { all } = await loadWithIds()
    return all
      .filter((p) => authed || p.meta.private !== true)
      .map((p) => summarize(p.slug, p.meta, p.body))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  })

function cleanTags(tags) {
  return (Array.isArray(tags) ? tags : []).map((t) => String(t).trim()).filter(Boolean)
}

async function handle(req, res, url) {
  const parts = url.pathname.replace(/^\/api\//, '').split('/').map(decodeURIComponent)

  if (parts[0] === 'auth') return handleAuth(parts[1], req, res, { send, readJson })

  // 조회(GET) 외의 모든 요청은 로그인 필요
  if (req.method !== 'GET' && !(await isAuthed(req))) {
    return send(res, 401, { error: '로그인이 필요해요.' })
  }

  if (parts[0] === 'posts') {
    const ref = parts[1]

    if (!ref && req.method === 'GET') return send(res, 200, await listPosts(await isAuthed(req)))

    if (!ref && req.method === 'POST') {
      const { title = '', content = '', tags, category = '', private: isPrivate = false } = await readJson(req)
      if (!title.trim()) return send(res, 400, { error: '제목을 입력해 주세요.' })
      const created = await locked(async () => {
        const { taken } = await loadWithIds()
        const id = newId(taken)
        const s = id
        const meta = {
          id,
          title: title.trim(),
          date: new Date().toISOString(),
          category: String(category).trim(),
          tags: cleanTags(tags),
          ...(isPrivate === true && { private: true, firstPublish: true }),
        }
        await fs.writeFile(path.join(POSTS, `${s}.md`), serializeFile(meta, content))
        return toPost({ slug: s, meta, body: content.replace(/^\n+/, '') })
      })
      return send(res, 201, created)
    }

    if (ref && req.method === 'GET') {
      const authed = await isAuthed(req)
      const post = await locked(async () => {
        const found = findPost((await loadWithIds()).all, ref)
        // 비공개 글은 로그인한 사람에게만 보임 (없는 글과 똑같이 404)
        return found && (found.meta.private !== true || authed) ? toPost(found) : null
      })
      return post ? send(res, 200, post) : send(res, 404, { error: 'Not found' })
    }

    if (ref && req.method === 'PUT') {
      const body = await readJson(req)
      const result = await locked(async () => {
        const old = findPost((await loadWithIds()).all, ref)
        if (!old) return { status: 404, data: { error: 'Not found' } }
        const { title = old.meta.title, content = old.body, tags = old.meta.tags, category = old.meta.category, private: isPrivate = old.meta.private === true } = body
        if (!title.trim()) return { status: 400, data: { error: '제목을 입력해 주세요.' } }
        // 비공개로 만든 글을 처음 공개하는 순간만 '게시 시각'을 지금으로 갱신 (이후 비공개↔공개 전환에는 적용 안 함)
        const publishing = isPrivate !== true && old.meta.firstPublish === true
        const now = new Date().toISOString()
        const meta = {
          id: old.meta.id,
          title: title.trim(),
          date: publishing ? now : old.meta.date,
          ...((!publishing && { updated: now }) || (old.meta.updated && { updated: old.meta.updated })),
          category: String(category ?? '').trim(),
          tags: cleanTags(tags),
          ...(isPrivate === true && { private: true }),
          ...(isPrivate === true && old.meta.firstPublish === true && { firstPublish: true }),
        }
        await fs.writeFile(path.join(POSTS, `${old.slug}.md`), serializeFile(meta, content))
        return { status: 200, data: toPost({ slug: old.slug, meta, body: content.replace(/^\n+/, '') }) }
      })
      return send(res, result.status, result.data)
    }

    if (ref && req.method === 'DELETE') {
      const ok = await locked(async () => {
        const { all } = await loadWithIds()
        const old = findPost(all, ref)
        if (!old) return false
        await fs.unlink(path.join(POSTS, `${old.slug}.md`))
        await removeUnusedImages(old, all.filter((p) => p !== old))
        return true
      })
      return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Not found' })
    }
  }

  if (parts[0] === 'upload' && req.method === 'POST') {
    const orig = path.basename(url.searchParams.get('name') || 'file')
    const ext = path.extname(orig).toLowerCase()
    if (!MIME[ext]) return send(res, 400, { error: '지원하지 않는 파일 형식입니다.' })
    const filename = await newImageName(new Date(), ext)
    await fs.writeFile(path.join(IMAGES, filename), await readBody(req))
    return send(res, 201, { url: `/content/images/${encodeURIComponent(filename)}`, name: orig })
  }

  send(res, 404, { error: 'Not found' })
}

async function serveImage(req, res, url) {
  const name = decodeURIComponent(url.pathname.slice('/content/images/'.length))
  const file = path.join(IMAGES, name)
  if (!validName(name) || !(await exists(file))) {
    res.statusCode = 404
    return res.end('Not found')
  }
  res.setHeader('Content-Security-Policy', 'sandbox')
  res.setHeader('Content-Type', MIME[path.extname(name).toLowerCase()] || 'application/octet-stream')
  // 파일명에 업로드 시각이 들어 있어 내용이 바뀌지 않음 → 오래 캐시
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.end(await fs.readFile(file))
}

export default function blogApi() {
  const middleware = async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    try {
      if (url.pathname.startsWith('/api/')) {
        await fs.mkdir(POSTS, { recursive: true })
        await fs.mkdir(IMAGES, { recursive: true })
        return await handle(req, res, url)
      }
      if (url.pathname.startsWith('/content/images/') && req.method === 'GET') {
        return await serveImage(req, res, url)
      }
    } catch (err) {
      console.error('[blogApi]', err)
      return send(res, err.status || 500, { error: err.message || 'Server error' })
    }
    next()
  }
  return {
    name: 'blog-api',
    configureServer(server) {
      server.middlewares.use(middleware)
      const stop = scheduleCleanup()
      server.httpServer?.once('close', stop)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
      const stop = scheduleCleanup()
      server.httpServer?.once('close', stop)
    },
  }
}
