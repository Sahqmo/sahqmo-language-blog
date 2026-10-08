import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UNCATEGORIZED } from './CategoryDonut.jsx'
import { Rel } from './DateLabel.jsx'

const INTERVAL = 5000
const GAP = 20 // 카드 사이 간격(px)
const mod = (a, n) => ((a % n) + n) % n

// 카테고리 노트 한 장이 가운데 보이고, 5초마다 오른쪽에서 다음 장이 들어오는 슬라이드.
// 마우스를 올리거나 키보드 포커스가 있으면 멈추고, 점/화살표/좌우 밀기로 직접 넘길 수도 있음.
//
// 구조: 끝없이 이어지는 "트랙"을 가정하고, 지금 위치(pos, 계속 늘어나는 정수) 기준 좌우 몇 칸만 그림.
//   - 칸 번호 k = -(R+1) … R+1. 가운데가 0, 보이는 칸은 |k| ≤ R(최대 2), 바깥 한 칸(|k| = R+1)은 투명하게 대기.
//   - 각 칸의 React key 는 "트랙 위의 절대 위치(pos + k)" 라서, 넘기면 같은 DOM 요소가 한 칸씩 옆으로 미끄러지고
//     (CSS transition), 새 장은 바깥 대기 칸에서 이미 기다리고 있다가 자연스럽게 밀려 들어옴.
//   - 맨 끝에서 맨 앞으로 돌아가는 것도 트랙이 이어질 뿐이라 따로 순간이동하는 장이 없음.
export default function CategoryCarousel({ cats, posts, onSelect, intro }) {
  const n = cats.length
  // 카테고리별 최근 글 5개 (글/카테고리가 바뀔 때만 계산)
  const recent = useMemo(
    () => cats.map((c) => posts.filter((p) => (p.category || UNCATEGORIZED) === c.name).slice(0, 5)),
    [cats, posts],
  )
  const [pos, setPos] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useRef(false)
  const ready = useRef(false) // 첫 그리기가 끝난 뒤에 새로 생기는 칸만 페이드인
  const touchX = useRef(0)
  const shown = useRef(new Set()) // 이미 DOM 에 올라온 칸의 key

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ready.current = true
  }, [])

  const looping = n >= 3
  const index = n ? mod(pos, n) : 0
  // 한쪽에 보일 수 있는 장 수: 같은 장이 양옆에 겹쳐 보이지 않도록 n 에 맞춰 줄임 (n=3,4 → 1, n≥5 → 2)
  const R = looping ? Math.min(2, Math.floor((n - 1) / 2)) : 1

  // pos 가 바뀔 때마다 타이머를 새로 걸어서, 직접 넘긴 뒤에는 다시 5초를 기다림
  useEffect(() => {
    if (!looping || paused || reduced.current) return
    const t = setTimeout(() => setPos((p) => p + 1), INTERVAL)
    return () => clearTimeout(t)
  }, [pos, looping, paused])

  const step = (d) => setPos((p) => p + d)
  // 점을 눌러 이동할 때는 더 가까운 쪽 방향으로
  const goTo = (i) => {
    let d = mod(i - index, n)
    if (d > n / 2) d -= n
    step(d)
  }

  // 그릴 칸 목록: { key, i(카테고리 번호), k(칸 번호) }
  const slots = []
  if (looping) {
    for (let k = -(R + 1); k <= R + 1; k++) slots.push({ key: pos + k, i: mod(pos + k, n), k })
  } else {
    // 1~2장이면 이어 붙이지 않고 그대로 나란히 놓음
    cats.forEach((_, i) => slots.push({ key: i, i, k: i - index }))
  }

  // 사라진 칸의 key 는 정리 (같은 위치로 돌아와 다시 생기면 다시 페이드인할 수 있게)
  useEffect(() => {
    const live = new Set(slots.map((s) => s.key))
    for (const key of shown.current) if (!live.has(key)) shown.current.delete(key)
  })

  // 새로 생긴 칸이 보이는 자리라면(점으로 여러 장 건너뛴 경우 등) 슬라이드 대신 서서히 나타남
  // (ref 콜백은 다시 그릴 때마다 호출되므로, 이미 처리한 칸은 건너뜀)
  const appear = (key, el, visible) => {
    if (!el || shown.current.has(key)) return
    shown.current.add(key)
    if (ready.current && visible && !reduced.current) el.animate([{ opacity: 0 }], { duration: 350, easing: 'ease' })
  }

  return (
    <div
      className={`cat-carousel ${intro ? 'enter' : ''}`}
      style={intro ? { '--i': 3 } : undefined}
      // 터치 기기에서는 탭 한 번에 마우스 이벤트가 남아 영영 멈추는 일이 없도록, 마우스 포인터와 키보드 포커스일 때만 멈춤
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={(e) => e.target.matches(':focus-visible') && setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        // 좌우로 밀어서 넘기기 (왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전)
        const dx = e.changedTouches[0].clientX - touchX.current
        if (looping && Math.abs(dx) > 40) step(dx < 0 ? 1 : -1)
      }}
    >
      <div className="cat-viewport">
        {slots.map(({ key, i, k }) => {
          const c = cats[i]
          const a = Math.abs(k)
          const visible = a <= R
          return (
            <div
              key={key}
              ref={(el) => appear(key, el, visible && k !== 0)}
              className={`cat-slide ${k === 0 ? '' : 'side'}`}
              style={{
                // 카드 너비(+간격) 단위로 옆에 늘어놓음. 가운데에서 멀수록 작고 흐리게, 바깥 대기 칸은 숨김
                transform: `translateX(calc(${k} * (100% + ${GAP}px))) scale(${1 - 0.06 * Math.min(a, 3)})`,
                opacity: visible ? [1, 0.4, 0.2][a] : 0,
                pointerEvents: visible ? undefined : 'none',
              }}
              aria-hidden={k !== 0}
              onClick={k !== 0 && visible && looping ? () => step(k) : undefined}
            >
              <div className="panel cat-panel" inert={k !== 0}>
                <button className="cat-head" onClick={() => onSelect(c.name)}>
                  <i style={{ background: c.color }} />
                  <strong>{c.name}</strong>
                  <span>{c.count}편</span>
                </button>
                <ul>
                  {recent[i].map((p) => (
                    <li key={p.id}>
                      <Link to={`/post/${p.id}`}>
                        <span>{p.title}</span>
                        <Rel iso={p.date} className="rel" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
      {n > 1 && (
        <div className="cat-controls">
          <button type="button" className="cat-arrow" aria-label="이전 카테고리" onClick={() => (looping ? step(-1) : goTo(index - 1))}>‹</button>
          <div className="cat-dots">
            {cats.map((c, i) => (
              <button
                type="button"
                key={c.name}
                className={i === index ? 'on' : ''}
                aria-label={`${c.name} 보기`}
                aria-current={i === index}
                onClick={() => (looping ? goTo(i) : step(i - index))}
              />
            ))}
          </div>
          <button type="button" className="cat-arrow" aria-label="다음 카테고리" onClick={() => (looping ? step(1) : goTo(index + 1))}>›</button>
        </div>
      )}
    </div>
  )
}
