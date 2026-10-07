import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RichEditor from '../components/RichEditor.jsx'
import CategoryInput from '../components/CategoryInput.jsx'
import TagInput from '../components/TagInput.jsx'
import { api } from '../api.js'

export default function Editor() {
  const { ref } = useParams() // 있으면 수정, 없으면 새 글
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState([])
  const [category, setCategory] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [known, setKnown] = useState([])
  const [content, setContent] = useState('') // 불러온 원본 (에디터 초기값)
  const getMarkdown = useRef(() => '')
  const [loading, setLoading] = useState(!!ref)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let stale = false
    api.list().then((ps) => !stale && setKnown([...new Set(ps.map((p) => p.category).filter(Boolean))])).catch(() => {})
    return () => {
      stale = true
    }
  }, [])

  useEffect(() => {
    if (!ref) return
    let stale = false
    api
      .get(ref)
      .then((p) => {
        if (stale) return
        setTitle(p.title)
        setTags(p.tags)
        setCategory(p.category || '')
        setIsPrivate(p.private)
        setContent(p.content)
      })
      .catch((e) => !stale && setStatus(e.message))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [ref])

  async function save() {
    if (!title.trim()) return setStatus('제목을 입력해 주세요.')
    setSaving(true)
    setStatus('')
    const payload = {
      title,
      content: getMarkdown.current(),
      category,
      private: isPrivate,
      tags,
    }
    try {
      const saved = ref ? await api.update(ref, payload) : await api.create(payload)
      navigate(`/post/${saved.id}`)
    } catch (e) {
      setStatus(e.message)
      setSaving(false)
    }
  }

  if (loading) return <p className="state">불러오는 중…</p>

  return (
    <section className="editor">
      <div className="title-row">
        <input
          className="title-input"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <label className="switch" title="비공개 글은 로그인한 나에게만 보여요">
          <input type="checkbox" role="switch" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          <span className="switch-track" />
          <span className="switch-label">{isPrivate ? '비공개' : '공개'}</span>
        </label>
      </div>
      <CategoryInput value={category} onChange={setCategory} known={known} />
      <TagInput tags={tags} onChange={setTags} />
      <RichEditor key={ref || 'new'} defaultValue={content} getMarkdownRef={getMarkdown} onError={setStatus} onNotice={setStatus} />
      <div className="editor-bar">
        {status && <span className="status">{status}</span>}
        <button className="btn ghost" onClick={() => navigate(-1)}>취소</button>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? '저장 중…' : ref ? '수정 저장' : '발행'}
        </button>
      </div>
    </section>
  )
}
