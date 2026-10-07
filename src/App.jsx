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

// 헤더 메뉴용 선 아이콘 (글 목록 / 로그인 / 로그아웃)
const ICONS = {
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  login: <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
}
const NavIcon = ({ name }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
)

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
        {/* 글 페이지에서 제목이 화면 밖으로 나가면 PostPage 가 여기에 제목을 띄움 */}
        <div id="header-title" className="header-title" />
        <nav>
          {/* 메인에서는 아래 '최근 게시된 글'로 스크롤, 다른 페이지에서는 글 목록 페이지로 이동 */}
          <NavLink
            to={onHome ? '/' : '/posts'}
            end
            className="nav-icon"
            aria-label="글 목록"
            title="글 목록"
            onClick={(e) => {
              if (!onHome) return
              e.preventDefault()
              document.getElementById('recent')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            <NavIcon name="list" />
          </NavLink>
          {ready && loggedIn && (
            <>
              <NavLink to="/write" className="btn-write">새 글 쓰기</NavLink>
              <button className="link-btn nav-icon" onClick={logout} aria-label="로그아웃" title="로그아웃"><NavIcon name="logout" /></button>
            </>
          )}
          {ready && !loggedIn && (
            <NavLink to="/login" className="nav-icon" aria-label="로그인" title="로그인"><NavIcon name="login" /></NavLink>
          )}
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
