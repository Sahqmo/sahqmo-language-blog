import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import PostBrowser from '../components/PostBrowser.jsx'
import { countCategories } from '../components/CategoryDonut.jsx'

// 헤더 '글 목록' 메뉴로 들어오는 전체 글 목록 페이지
export default function PostList() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stale = false
    api.list().then((p) => !stale && setPosts(p)).catch((e) => !stale && setError(e.message))
    return () => {
      stale = true
    }
  }, [])

  const cats = useMemo(() => (posts ? countCategories(posts) : []), [posts])

  if (error) return <p className="state error">{error}</p>
  if (!posts) return <p className="state">불러오는 중…</p>

  return (
    <PostBrowser
      posts={posts}
      cats={cats}
      category={category}
      onCategory={(c) => setParams(c ? { category: c } : {})}
      title="전체 글"
    />
  )
}
