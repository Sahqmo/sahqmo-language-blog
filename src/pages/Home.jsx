import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, formatDate } from '../api.js'
import { useAuth } from '../auth.jsx'
import PostBrowser from '../components/PostBrowser.jsx'
import CategoryDonut, { countCategories } from '../components/CategoryDonut.jsx'
import CategoryCarousel from '../components/CategoryCarousel.jsx'

// 새로고침(첫 진입) 때만 첫 화면 섹션들을 순서대로 등장시킴. 이후 SPA 내 이동에서는 생략
let heroPlayed = false

export default function Home() {
  const { loggedIn } = useAuth()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const [intro] = useState(() => !heroPlayed)
  useEffect(() => {
    heroPlayed = true
  }, [])

  useEffect(() => {
    let stale = false
    api.list().then((p) => !stale && setPosts(p)).catch((e) => !stale && setError(e.message))
    return () => {
      stale = true
    }
  }, [])

  // 카테고리를 고르면(차트 범례·카드·칩) 아래쪽 목록으로 부드럽게 이동
  useEffect(() => {
    if (category && posts) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [category, posts])

  const cats = useMemo(() => (posts ? countCategories(posts) : []), [posts])

  if (error) return <p className="state error">{error}</p>
  if (!posts) return <p className="state">불러오는 중…</p>

  const latest = posts[0]
  const hasPosts = posts.length > 0
  const topCats = cats.slice(0, 5)
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
              {latest.private && <span className="lock">🔒 비공개</span>}
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

      <section className="block">
        <h3 className={`section-title cat-title ${intro ? 'enter' : ''}`} style={intro ? { '--i': 2 } : undefined}>많이 쓴 카테고리</h3>
        {hasPosts ? (
          <CategoryCarousel cats={topCats} posts={posts} onSelect={setCategory} intro={intro} />
        ) : (
          // 글이 없어도 형식은 채워 두기 위해 빈 카테고리 노트 한 장을 보여 줌
          <div className="cat-viewport">
            <div className="cat-slide">
              <div className={`panel cat-panel is-empty ${intro ? 'enter' : ''}`} style={intro ? { '--i': 3 } : undefined}>
                <div className="cat-head">
                  <i />
                  <strong>카테고리</strong>
                  <span>0편</span>
                </div>
                <ul />
              </div>
            </div>
          </div>
        )}
      </section>

      <a href="#recent" className={`scroll-hint ${intro ? 'enter-fade' : ''}`} aria-label="아래로 스크롤" style={intro ? { '--i': 6 } : undefined} onClick={(e) => { e.preventDefault(); listRef.current?.scrollIntoView({ behavior: 'smooth' }) }}>
        <span>글 목록</span>
        <i>↓</i>
      </a>
      </div>

      <PostBrowser
        ref={listRef}
        posts={posts}
        cats={cats}
        category={category}
        onCategory={setCategory}
        title="최근 게시된 글"
        limit={8}
      />
    </>
  )
}
