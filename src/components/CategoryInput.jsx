import { useState } from 'react'

// 카테고리 입력 + 포커스하면 뜨는 "기존 카테고리" 팝업 (입력한 글자로 걸러짐, 클릭하면 선택)
export default function CategoryInput({ value, onChange, known }) {
  const [open, setOpen] = useState(false)
  const q = value.trim().toLowerCase()
  const options = known.filter((c) => c.toLowerCase().includes(q))

  return (
    <div className="cat-field">
      <input
        className="cat-input"
        placeholder="카테고리 (언어: 영어, 일본어, 독일어 …)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      {open && options.length > 0 && (
        <div className="cat-pop" onMouseDown={(e) => e.preventDefault()}>
          <span className="cat-pop-label">기존 카테고리</span>
          <div className="cat-pop-list">
            {options.map((c) => (
              <button
                type="button"
                key={c}
                className={`cat-opt${c === value ? ' on' : ''}`}
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
