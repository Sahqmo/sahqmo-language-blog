import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkBr from '../remarkBr.js'
import { api, formatDateTime } from '../api.js'
import { useAuth } from '../auth.jsx'

export default function PostPage() {
  const { ref } = useParams()
  const navigate = useNavigate()
  const { loggedIn } = useAuth()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setPost(null)
    api.get(ref).then((p) => {
      setPost(p)
      // 예전 주소(제목 기반)로 들어오면 번호 주소로 교체
      if (String(p.id) !== ref) navigate(`/post/${p.id}`, { replace: true })
    }).catch((e) => setError(e.message))
  }, [ref])

  async function remove() {
    if (!window.confirm('이 글을 삭제할까요? 되돌릴 수 없어요.')) return
    try {
      await api.remove(post.id)
      navigate('/')
    } catch (e) {
      alert(e.message)
    }
  }

  if (error) return <p className="state error">글을 찾을 수 없어요.</p>
  if (!post) return <p className="state">불러오는 중…</p>

  return (
    <article className="post">
      <Link to="/" className="back">← 글 목록</Link>
      <header>
        <h1>{post.title}</h1>
        <div className="meta">
          {post.category && <span className="cat">{post.category}</span>}
          <time>{formatDateTime(post.date)}</time>
          {post.updated && <span>· {formatDateTime(post.updated)} 수정</span>}
        </div>
        {post.tags.length > 0 && (
          <div className="tags">
            {post.tags.map((t) => (
              <Link key={t} to={`/tag/${encodeURIComponent(t)}`} className="tag">#{t}</Link>
            ))}
          </div>
        )}
      </header>
      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks, remarkBr]}>{post.content}</ReactMarkdown>
      </div>
      {loggedIn && (
        <footer className="post-actions">
          <Link to={`/edit/${post.id}`} className="btn">수정</Link>
          <button className="btn ghost danger" onClick={remove}>삭제</button>
        </footer>
      )}
    </article>
  )
}
