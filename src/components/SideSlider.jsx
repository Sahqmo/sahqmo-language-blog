import { useEffect, useRef, useState } from 'react'

const INTERVAL = 10000

// 한 칸 안에서 여러 내용을 10초마다 번갈아 보여 주는 슬라이드. slides: [{ key, title, node }]
// 모든 장이 같은 칸에 겹쳐 있어 높이는 가장 큰 장에 맞춰짐. 마우스를 올리거나 키보드 포커스가 있으면 멈춤.
// 장이 하나뿐이면 그냥 제목과 내용만 보여 줌.
export default function SideSlider({ slides }) {
  const n = slides.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useRef(false)
  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const cur = n ? index % n : 0
  // index 가 바뀔 때마다 타이머를 새로 걸어서, 직접 넘긴 뒤에는 다시 10초를 기다림
  useEffect(() => {
    if (n < 2 || paused || reduced.current) return
    const t = setTimeout(() => setIndex((i) => i + 1), INTERVAL)
    return () => clearTimeout(t)
  }, [index, n, paused])

  return (
    <div
      className="side-slider"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={(e) => e.target.matches(':focus-visible') && setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="side-stack">
        {slides.map((s, i) => (
          <div key={s.key} className={`side-slide ${i === cur ? 'on' : ''}`} aria-hidden={i !== cur} inert={i !== cur}>
            <h3 className="panel-title">{s.title}</h3>
            {s.node}
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="cat-dots side-dots">
          {slides.map((s, i) => (
            <button
              type="button"
              key={s.key}
              className={i === cur ? 'on' : ''}
              aria-label={`${s.title} 보기`}
              aria-current={i === cur}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
