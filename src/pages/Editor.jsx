import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RichEditor from '../components/RichEditor.jsx'
import { api } from '../api.js'

export default function Editor() {
  const { ref } = useParams() // 있으면 수정, 없으면 새 글
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState('')
  const [known, setKnown] = useState([])
  const [content, setContent] = useState('') // 불러온 원본 (에디터 초기값)
  const getMarkdown = useRef(() => '')
  const [loading, setLoading] = useState(!!ref)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    api.list().then((ps) => setKnown([...new Set(ps.map((p) => p.category).filter(Boolean))])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!ref) return
    api
      .get(ref)
      .then((p) => {
        setTitle(p.title)
        setTags(p.tags.join(', '))
        setCategory(p.category || '')
        setContent(p.content)
      })
      .catch((e) => setStatus(e.message))
      .finally(() => setLoading(false))
  }, [ref])

  async function save() {
    if (!title.trim()) return setStatus('제목을 입력해 주세요.')
    setSaving(true)
    setStatus('')
    const payload = {
      title,
      content: getMarkdown.current(),
      category,
      tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
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
      <input
        className="title-input"
        placeholder="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <input
        className="cat-input"
        list="known-categories"
        placeholder="카테고리 (언어: 영어, 일본어, 독일어 …)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <datalist id="known-categories">
        {known.map((c) => <option key={c} value={c} />)}
      </datalist>
      <input
        className="tags-input"
        placeholder="태그 (쉼표로 구분: 음운론, 형태론)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <RichEditor key={ref || 'new'} defaultValue={content} getMarkdownRef={getMarkdown} onError={setStatus} />
      <div className="editor-bar">
        <span className="status">{status}</span>
        <button className="btn ghost" onClick={() => navigate(-1)}>취소</button>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? '저장 중…' : ref ? '수정 저장' : '발행'}
        </button>
      </div>
    </section>
  )
}
