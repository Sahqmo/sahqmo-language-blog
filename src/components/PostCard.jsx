import { Link, useNavigate } from 'react-router-dom'
import { formatDate } from '../api.js'

export default function PostCard({ p }) {
  const navigate = useNavigate()
  // 카드 전체가 링크라서, 태그는 링크 중첩 대신 클릭 시 태그 페이지로 이동
  const openTag = (e, t) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/tag/${encodeURIComponent(t)}`)
  }
  return (
    <Link to={`/post/${p.id}`} className="post-card">
      <div className="card-meta">
        <time>{formatDate(p.date)}</time>
        {p.category && <span className="cat">{p.category}</span>}
      </div>
      <h2>{p.title}</h2>
      {p.excerpt && <p>{p.excerpt}</p>}
      {p.tags.length > 0 && (
        <div className="tags">
          {p.tags.map((t) => (
            <span key={t} className="tag clickable" role="link" onClick={(e) => openTag(e, t)}>#{t}</span>
          ))}
        </div>
      )}
    </Link>
  )
}
