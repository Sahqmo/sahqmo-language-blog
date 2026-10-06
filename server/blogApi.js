// 로컬 파일 기반 저장소 API (Vite dev/preview 서버에 붙는 미들웨어)
//   content/posts/<slug>.md   글 (frontmatter + markdown 본문)
//   content/images/<file>     업로드된 이미지/첨부 파일
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
function slugify(title) {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || `post-${Date.now()}`
}

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
// 번호는 content/meta.json 의 nextId 로 관리해서 글을 삭제해도 재사용되지 않습니다.
const META_FILE = path.join(ROOT, 'meta.json')
let queue = Promise.resolve()
const locked = (fn) => {
  const run = queue.then(fn)
  queue = run.catch(() => {})
  return run
}

async function loadAll() {
  const files = (await fs.readdir(POSTS)).filter((f) => f.endsWith('.md'))
  return Promise.all(
    files.map(async (f) => {
      const { meta, body } = parseFile(await fs.readFile(path.join(POSTS, f), 'utf8'))
      return { slug: f.slice(0, -3), meta, body }
    }),
  )
}

async function readNextId() {
  try {
    return Number(JSON.parse(await fs.readFile(META_FILE, 'utf8')).nextId) || 1
  } catch {
    return 1
  }
}

// id 가 없는 기존 글에 오래된 순으로 번호를 매기고, 전체 글 목록을 돌려줌 (반드시 locked 안에서 호출)
async function loadWithIds() {
  const all = await loadAll()
  const maxId = Math.max(0, ...all.map((p) => Number(p.meta.id) || 0))
  let next = Math.max(await readNextId(), maxId + 1)
  const missing = all.filter((p) => !Number.isInteger(p.meta.id)).sort((a, b) => (a.meta.date || '').localeCompare(b.meta.date || ''))
  for (const p of missing) {
    p.meta = { id: next++, ...p.meta }
    await fs.writeFile(path.join(POSTS, `${p.slug}.md`), serializeFile(p.meta, p.body))
  }
  if (missing.length || next !== (await readNextId())) {
    await fs.writeFile(META_FILE, JSON.stringify({ nextId: next }, null, 2))
  }
  return { all, nextId: next }
}

// 주소의 식별자: 숫자면 id, 아니면 (예전 주소) 파일명 slug
const findPost = (all, ref) =>
  /^\d+$/.test(ref) ? all.find((p) => p.meta.id === Number(ref)) : all.find((p) => p.slug === ref)

const toPost = (p) => ({ ...summarize(p.slug, p.meta, p.body), content: p.body })

const listPosts = () =>
  locked(async () => {
    const { all } = await loadWithIds()
    return all
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

    if (!ref && req.method === 'GET') return send(res, 200, await listPosts())

    if (!ref && req.method === 'POST') {
      const { title = '', content = '', tags, category = '' } = await readJson(req)
      if (!title.trim()) return send(res, 400, { error: '제목을 입력해 주세요.' })
      const created = await locked(async () => {
        const { nextId } = await loadWithIds()
        const base = slugify(title)
        let s = base
        for (let n = 2; await exists(path.join(POSTS, `${s}.md`)); n++) s = `${base}-${n}`
        const meta = {
          id: nextId,
          title: title.trim(),
          date: new Date().toISOString(),
          category: String(category).trim(),
          tags: cleanTags(tags),
        }
        await fs.writeFile(path.join(POSTS, `${s}.md`), serializeFile(meta, content))
        await fs.writeFile(META_FILE, JSON.stringify({ nextId: nextId + 1 }, null, 2))
        return toPost({ slug: s, meta, body: content.replace(/^\n+/, '') })
      })
      return send(res, 201, created)
    }

    if (ref && req.method === 'GET') {
      const post = await locked(async () => {
        const found = findPost((await loadWithIds()).all, ref)
        return found && toPost(found)
      })
      return post ? send(res, 200, post) : send(res, 404, { error: 'Not found' })
    }

    if (ref && req.method === 'PUT') {
      const body = await readJson(req)
      const result = await locked(async () => {
        const old = findPost((await loadWithIds()).all, ref)
        if (!old) return { status: 404, data: { error: 'Not found' } }
        const { title = old.meta.title, content = old.body, tags = old.meta.tags, category = old.meta.category } = body
        if (!title.trim()) return { status: 400, data: { error: '제목을 입력해 주세요.' } }
        const meta = {
          id: old.meta.id,
          title: title.trim(),
          date: old.meta.date,
          updated: new Date().toISOString(),
          category: String(category ?? '').trim(),
          tags: cleanTags(tags),
        }
        await fs.writeFile(path.join(POSTS, `${old.slug}.md`), serializeFile(meta, content))
        return { status: 200, data: toPost({ slug: old.slug, meta, body: content.replace(/^\n+/, '') }) }
      })
      return send(res, result.status, result.data)
    }

    if (ref && req.method === 'DELETE') {
      const ok = await locked(async () => {
        const old = findPost((await loadWithIds()).all, ref)
        if (!old) return false
        await fs.unlink(path.join(POSTS, `${old.slug}.md`))
        return true
      })
      return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Not found' })
    }
  }

  if (parts[0] === 'upload' && req.method === 'POST') {
    const orig = path.basename(url.searchParams.get('name') || 'file')
    const ext = path.extname(orig).toLowerCase()
    if (!MIME[ext]) return send(res, 400, { error: '지원하지 않는 파일 형식입니다.' })
    const safe = path.basename(orig, ext).replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 50) || 'image'
    const filename = `${Date.now()}-${safe}${ext}`
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
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
