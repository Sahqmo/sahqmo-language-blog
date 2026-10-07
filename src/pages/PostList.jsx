import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import PostBrowser from '../components/PostBrowser.jsx'
import { countCategories } from '../components/CategoryDonut.jsx'

export const PAGE_SIZES = [5, 10, 20, 50, 100]
const SIZE_KEY = 'postListPageSize'

function loadSize() {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY))
    return PAGE_SIZES.includes(n) ? n : 10
  } catch {
    return 10
  }
}

// 헤더 '글 목록' 메뉴로 들어오는 전체 글 목록 페이지
export default function PostList() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const page = Math.max(1, parseInt(params.get('page'), 10) || 1)
  const [size, setSize] = useState(loadSize)
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stale = false
    api.list().then((p) => !stale && setPosts(p)).catch((e) => !stale && setError(e.message))
    return () => {
      stale = true
    }
  }, [])

  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k)
    setParams(next, { replace: true })
  }

  const cats = useMemo(() => (posts ? countCategories(posts) : []), [posts])

  if (error) return <p className="state error">{error}</p>
  if (!posts) return <p className="state">불러오는 중…</p>

  return (
    <PostBrowser
      posts={posts}
      cats={cats}
      category={category}
      onCategory={(c) => setParams(c ? { category: c } : {})}
      paging={{
        size,
        sizes: PAGE_SIZES,
        page,
        onSize: (n) => {
          setSize(n)
          try {
            localStorage.setItem(SIZE_KEY, String(n))
          } catch {}
          update({ page: null })
        },
        onPage: (n) => {
          update({ page: n > 1 ? n : null })
          if (n !== page) window.scrollTo({ top: 0 })
        },
      }}
      title="전체 글"
    />
  )
}
