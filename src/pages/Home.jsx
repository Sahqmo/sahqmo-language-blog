import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, formatDate } from '../api.js'
import { useAuth } from '../auth.jsx'
import Reveal from '../components/Reveal.jsx'
import PostCard from '../components/PostCard.jsx'
import CategoryDonut, { UNCATEGORIZED, countCategories } from '../components/CategoryDonut.jsx'

// 새로고침(첫 진입) 때만 첫 화면 섹션들을 순서대로 등장시킴. 이후 SPA 내 이동에서는 생략
let heroPlayed = false

export default function Home() {
  const { loggedIn } = useAuth()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const listRef = useRef(null)
  const [intro] = useState(() => !heroPlayed)
  useEffect(() => {
    heroPlayed = true
  }, [])

  useEffect(() => {
    api.list().then(setPosts).catch((e) => setError(e.message))
  }, [])

  // 카테고리를 고르면(차트 범례·카드·칩) 아래쪽 목록으로 부드럽게 이동
  useEffect(() => {
    if (category && posts) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [category, posts])

  const cats = useMemo(() => (posts ? countCategories(posts) : []), [posts])

  const filtered = useMemo(() => {
    if (!posts) return []
    const q = query.trim().toLowerCase()
    return posts.filter(
      (p) =>
        (!category || (p.category || UNCATEGORIZED) === category) &&
        (!q || [p.title, p.excerpt, p.category, ...p.tags].some((s) => (s || '').toLowerCase().includes(q))),
    )
  }, [posts, query, category])

  if (error) return <p className="state error">{error}</p>
  if (!posts) return <p className="state">불러오는 중…</p>

  const latest = posts[0]
  const hasPosts = posts.length > 0
  // 글이 없어도 형식은 채워 두기 위해 빈 카테고리 노트 3장을 보여 줌
  const topCats = hasPosts ? cats.slice(0, 3) : [null, null, null]
  const setCategory = (c) => setParams(c ? { category: c } : {})

  return (
    <>
      <div className="hero-screen">
      <section className="top-grid">
        {latest ? (
          <Link to={`/post/${latest.id}`} className={`panel latest ${intro ? 'enter' : ''}`} style={intro ? { '--i': 0 } : undefined}>
            <h3 className="panel-title">가장 최근 글</h3>
            <div className="card-meta">
              <time>{formatDate(latest.date)}</time>
              {latest.category && <span className="cat">{latest.category}</span>}
            </div>
            <h2>{latest.title}</h2>
            <p>{latest.excerpt}</p>
            <span className="more">이어 읽기 →</span>
          </Link>
        ) : (
          <div className={`panel latest is-empty ${intro ? 'enter' : ''}`} style={intro ? { '--i': 0 } : undefined}>
            <h3 className="panel-title">가장 최근 글</h3>
            <h2>아직 작성된 글이 없어요</h2>
            <p>첫 글을 쓰면 가장 최근 글의 미리보기가 이곳에 나타나요.</p>
            {loggedIn ? <Link to="/write" className="btn start-btn">첫 글 쓰기</Link> : <Link to="/login" className="more">로그인하고 시작하기 →</Link>}
          </div>
        )}
        <div className={`panel ${intro ? 'enter' : ''}`} style={intro ? { '--i': 1 } : undefined}>
          <h3 className="panel-title">언어별 글 비율</h3>
          <CategoryDonut data={cats} total={posts.length} />
        </div>
      </section>

      {(
        <section className="block">
          <h3 className={`section-title ${intro ? 'enter' : ''}`} style={intro ? { '--i': 2 } : undefined}>많이 쓴 카테고리</h3>
          <div className="cat-grid">
            {topCats.map((c, i) => (
              <div key={c ? c.name : `empty-${i}`} className={`panel cat-panel ${c ? '' : 'is-empty'} ${intro ? 'enter' : ''}`} style={intro ? { '--i': 3 + i } : undefined}>
                {c ? (
                  <button className="cat-head" onClick={() => setCategory(c.name)}>
                    <i style={{ background: c.color }} />
                    <strong>{c.name}</strong>
                    <span>{c.count}편</span>
                  </button>
                ) : (
                  <div className="cat-head">
                    <i />
                    <strong>카테고리</strong>
                    <span>0편</span>
                  </div>
                )}
                <ul>
                  {c &&
                    posts
                      .filter((p) => (p.category || UNCATEGORIZED) === c.name)
                      .slice(0, 5)
                      .map((p) => (
                        <li key={p.id}>
                          <Link to={`/post/${p.id}`}><span>{p.title}</span></Link>
                        </li>
                      ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <a href="#recent" className={`scroll-hint ${intro ? 'enter-fade' : ''}`} aria-label="아래로 스크롤" style={intro ? { '--i': 6 } : undefined} onClick={(e) => { e.preventDefault(); listRef.current?.scrollIntoView({ behavior: 'smooth' }) }}>
        <span>글 목록</span>
        <i>↓</i>
      </a>
      </div>

      <section className="block list-section" id="recent" ref={listRef}>
        <h3 className="section-title">{category ? `${category} 글` : '최근 게시된 글'}</h3>
        <div className="filters">
          <button className={`chip ${!category ? 'on' : ''}`} onClick={() => setCategory('')}>전체</button>
          {cats.map((c) => (
            <button key={c.name} className={`chip ${category === c.name ? 'on' : ''}`} onClick={() => setCategory(c.name)}>
              {c.name}
            </button>
          ))}
        </div>
        <input
          className="search"
          type="search"
          placeholder="제목, 내용, 태그 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length === 0 ? (
          <p className="state">{hasPosts ? '해당하는 글이 없어요.' : '아직 작성된 글이 없어요.'}</p>
        ) : (
          <ul className="post-list">
            {(category || query ? filtered : filtered.slice(0, 8)).map((p, i) => (
              <Reveal as="li" key={p.id} delay={(i % 4) * 60}><PostCard p={p} /></Reveal>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
