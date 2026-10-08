import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RichEditor from '../components/RichEditor.jsx'
import CategoryInput from '../components/CategoryInput.jsx'
import TagInput from '../components/TagInput.jsx'
import { api } from '../api.js'
import { DIGRAPH_END, digraphReplacement } from '../digraphs.js'

// 이 카테고리의 글을 쓸 때는 특수문자 입력 장치(kh→x, th→θ …)가 자동으로 켜짐
const DIGRAPH_CATEGORY = 'knortonaa'

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
  // 특수문자 입력 장치(kh→x, th→θ …): 영어 글을 망가뜨릴 수 있어서, 카테고리가 Knortonaa 일 때만 자동으로 켜짐.
  // 스위치로 직접 켜고 끈 값(override)이 있으면 그걸 따르고, 카테고리를 바꾸면 다시 자동으로 돌아감
  const [override, setOverride] = useState(null)
  const digraphs = override ?? category.trim().toLowerCase() === DIGRAPH_CATEGORY
  const digraphRef = useRef(digraphs)
  digraphRef.current = digraphs
  useEffect(() => setOverride(null), [category])
  // 제목 입력칸: 두 글자를 막 쳤을 때만 바꿈 (글자를 지우거나 한글 조합 중에는 건드리지 않음)
  const onTitleChange = (e) => {
    const el = e.target
    let value = el.value
    const caret = el.selectionStart
    const type = e.nativeEvent.inputType || ''
    if (digraphs && type === 'insertText' && !e.nativeEvent.isComposing && caret === el.selectionEnd) {
      const rep = DIGRAPH_END.test(value.slice(0, caret)) && digraphReplacement(value.slice(caret - 2, caret))
      if (rep) {
        value = value.slice(0, caret - 2) + rep + value.slice(caret)
        requestAnimationFrame(() => el.setSelectionRange(caret - 1, caret - 1))
      }
    }
    setTitle(value)
  }
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
          onChange={onTitleChange}
          autoFocus
        />
        <label className="switch" title="비공개 글은 로그인한 나에게만 보여요">
          <input type="checkbox" role="switch" checked={!isPrivate} onChange={(e) => setIsPrivate(!e.target.checked)} />
          <span className="switch-track" />
          <span className="switch-label">{isPrivate ? '비공개' : '공개'}</span>
        </label>
      </div>
      <CategoryInput value={category} onChange={setCategory} known={known} />
      <TagInput tags={tags} onChange={setTags} />
      <RichEditor key={ref || 'new'} defaultValue={content} getMarkdownRef={getMarkdown} digraphRef={digraphRef} onError={setStatus} onNotice={setStatus} />
      <div className="editor-bar">
        {status && <span className="status">{status}</span>}
        <label className="switch" title="Knortonaa 카테고리에서는 자동으로 켜져요. 켜면 kh→x, gh→ř, th→θ, dh→ð, sh→š, dg→ĝ, lh→ł, ch→č 로 바로 바뀌어요. 바뀐 직후 Backspace 를 누르면 친 글자로 돌아가요.">
          <input type="checkbox" role="switch" checked={digraphs} onChange={(e) => setOverride(e.target.checked)} />
          <span className="switch-track" />
          <span className="switch-label">특수문자</span>
        </label>
        <button className="btn ghost" onClick={() => navigate(-1)}>취소</button>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? '저장 중…' : ref ? '수정 저장' : '발행'}
        </button>
      </div>
    </section>
  )
}
