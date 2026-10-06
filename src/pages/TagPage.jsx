import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import PostCard from '../components/PostCard.jsx'

export default function TagPage() {
  const { tag } = useParams()
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setPosts(null)
    api.list().then(setPosts).catch((e) => setError(e.message))
  }, [tag])

  if (error) return <p className="state error">{error}</p>
  if (!posts) return <p className="state">불러오는 중…</p>

  const matched = posts.filter((p) => p.tags.includes(tag))
  return (
    <section>
      <Link to="/" className="back">← 글 목록</Link>
      <div className="tag-head">
        <h1>#{tag}</h1>
        <span>{matched.length}편</span>
      </div>
      {matched.length === 0 ? (
        <p className="state">이 태그가 달린 글이 없어요.</p>
      ) : (
        <ul className="post-list">
          {matched.map((p) => <li key={p.id}><PostCard p={p} /></li>)}
        </ul>
      )}
    </section>
  )
}
