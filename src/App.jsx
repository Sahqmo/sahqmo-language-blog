import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth, useAuth } from './auth.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import TagPage from './pages/TagPage.jsx'
import PostList from './pages/PostList.jsx'

// 에디터(Milkdown)와 글 보기(마크다운 렌더링)는 용량이 커서 필요할 때만 불러옴
const Editor = lazy(() => import('./pages/Editor.jsx'))
const PostPage = lazy(() => import('./pages/PostPage.jsx'))

// 마크다운 에디터가 시스템 다크/라이트 설정을 따르도록 동기화
function useColorMode() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => (document.documentElement.dataset.colorMode = mq.matches ? 'dark' : 'light')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
}

// 스크롤을 내리면 고정 헤더에 경계선/그림자 표시
function useScrolled() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return scrolled
}

export default function App() {
  useColorMode()
  const scrolled = useScrolled()
  const { ready, loggedIn, logout } = useAuth()
  const onHome = useLocation().pathname === '/'
  return (
    <div className="shell">
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <Link
          to="/"
          className="brand"
          onClick={() => {
            // 메인에서 로고를 누르면 맨 위로 부드럽게 올림 (카테고리 필터가 걸려 있으면 링크 이동으로 필터도 해제됨)
            if (!onHome) return
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <span className="brand-mark">言</span>
          <span>
            <strong>Sahqmo</strong>
            <small>언어학 노트</small>
          </span>
        </Link>
        <nav>
          {/* 메인에서는 아래 '최근 게시된 글'로 스크롤, 다른 페이지에서는 글 목록 페이지로 이동 */}
          <NavLink
            to={onHome ? '/' : '/posts'}
            end
            onClick={(e) => {
              if (!onHome) return
              e.preventDefault()
              document.getElementById('recent')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            글 목록
          </NavLink>
          {ready && loggedIn && (
            <>
              <NavLink to="/write" className="btn-write">새 글 쓰기</NavLink>
              <button className="link-btn" onClick={logout}>로그아웃</button>
            </>
          )}
          {ready && !loggedIn && <NavLink to="/login">로그인</NavLink>}
        </nav>
      </header>
      <main>
        <Suspense fallback={<p className="state">불러오는 중…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts" element={<PostList />} />
          <Route path="/post/:ref" element={<PostPage />} />
          <Route path="/tag/:tag" element={<TagPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/write" element={<RequireAuth><Editor /></RequireAuth>} />
          <Route path="/edit/:ref" element={<RequireAuth><Editor /></RequireAuth>} />
          <Route path="*" element={<p className="state">페이지를 찾을 수 없어요.</p>} />
        </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">조용히 쌓아 가는 언어의 기록</footer>
    </div>
  )
}
