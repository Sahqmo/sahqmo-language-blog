import { useRef, useState } from 'react'

const clean = (s) => s.trim().replace(/^#/, '')

// 쉼표(또는 Enter)를 입력하면 태그 블록으로 바뀌고, 블록의 × 로 뺄 수 있는 태그 입력
export default function TagInput({ tags, onChange }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  // 입력 중인 글자들을 쉼표 기준으로 잘라 태그로 확정 (중복·빈 값 제외)
  function commit(text) {
    const added = text.split(',').map(clean).filter((t) => t && !tags.includes(t))
    if (added.length) onChange([...tags, ...new Set(added)])
    setDraft('')
  }

  function handleChange(e) {
    const v = e.target.value
    if (!v.includes(',')) return setDraft(v)
    // 쉼표 앞은 확정, 쉼표 뒤에 이어 쓴 글자는 다음 태그 입력으로 남김 (붙여넣기로 여러 개가 들어와도 처리)
    const parts = v.split(',')
    const rest = parts.pop()
    commit(parts.join(','))
    setDraft(rest.replace(/^\s+/, ''))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault() // 폼 전송/줄바꿈 방지
      if (draft.trim()) commit(draft)
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="tags-field" onClick={() => inputRef.current?.focus()}>
      {tags.map((t) => (
        <span className="tag tag-chip" key={t}>
          {t}
          <button
            type="button"
            aria-label={`태그 ${t} 제거`}
            title="태그 제거"
            onClick={(e) => {
              e.stopPropagation()
              onChange(tags.filter((x) => x !== t))
              inputRef.current?.focus()
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="tags-input"
        placeholder={tags.length ? '' : '태그 (쉼표로 구분: 음운론, 형태론)'}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => draft.trim() && commit(draft)}
      />
    </div>
  )
}
