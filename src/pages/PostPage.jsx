import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkBr from '../remarkBr.js'
import { api, formatDateTime } from '../api.js'
import { embedUrl, parseYouTube } from '../youtube.js'
import { useAuth } from '../auth.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

// 혼자 한 줄에 있는 유튜브 링크 문단은 영상 플레이어로, 나머지는 평소처럼 렌더링
function Paragraph({ node, children, ...props }) {
  const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()))
  const yt = kids.length === 1 && kids[0].tagName === 'a' ? parseYouTube(kids[0].properties.href) : null
  if (!yt) return <p {...props}>{children}</p>
  return (
    <div className="yt-embed">
      <iframe
        src={embedUrl(yt)}
        title="YouTube 영상"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )
}
const mdComponents = { p: Paragraph }
const remarkPlugins = [remarkGfm, remarkBreaks, remarkBr]

export default function PostPage() {
  const { ref } = useParams()
  const navigate = useNavigate()
  const { loggedIn } = useAuth()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const closeConfirm = useCallback(() => {
    setConfirming(false)
    setDeleteError('')
  }, [])

  useEffect(() => {
    let stale = false // 다른 글로 이동한 뒤 늦게 도착한 응답은 무시
    setPost(null)
    setError('')
    api.get(ref).then((p) => {
      if (stale) return
      setPost(p)
      // 예전 주소(제목 기반)로 들어오면 번호 주소로 교체
      if (String(p.id) !== ref) navigate(`/post/${p.id}`, { replace: true })
    }).catch((e) => !stale && setError(e.message))
    return () => {
      stale = true
    }
  }, [ref])

  async function remove() {
    setDeleting(true)
    setDeleteError('')
    try {
      await api.remove(post.id)
      navigate('/')
    } catch (e) {
      setDeleteError(e.message)
      setDeleting(false)
    }
  }

  if (error) return <p className="state error">글을 찾을 수 없어요.</p>
  if (!post) return <p className="state">불러오는 중…</p>

  return (
    <article className="post">
      <Link to="/posts" className="back">← 글 목록</Link>
      <header>
        <h1>{post.title}</h1>
        <div className="meta">
          {post.private && <span className="lock">🔒 비공개</span>}
          {post.category && <span className="cat">{post.category}</span>}
          <time>{formatDateTime(post.date)}</time>
          {post.updated && <span>· {formatDateTime(post.updated)} 수정</span>}
          {loggedIn && (
            <div className="icon-actions">
              <Link to={`/edit/${post.id}`} className="icon-btn" title="수정" aria-label="수정">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </Link>
              <button className="icon-btn danger" onClick={() => setConfirming(true)} title="삭제" aria-label="삭제">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
              </button>
            </div>
          )}
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
        <ReactMarkdown remarkPlugins={remarkPlugins} components={mdComponents}>{post.content}</ReactMarkdown>
      </div>
      {loggedIn && (
        <footer className="post-actions">
          <Link to={`/edit/${post.id}`} className="btn">수정</Link>
          <button className="btn ghost danger" onClick={() => setConfirming(true)}>삭제</button>
        </footer>
      )}
      {confirming && (
        <ConfirmDialog
          title="이 글을 삭제할까요?"
          message={`‘${post.title}’ 글이 완전히 삭제되며, 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          busy={deleting}
          error={deleteError}
          onConfirm={remove}
          onCancel={closeConfirm}
        />
      )}
    </article>
  )
}
