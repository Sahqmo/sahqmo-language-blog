import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UNCATEGORIZED } from './CategoryDonut.jsx'
import { Rel } from './DateLabel.jsx'

const INTERVAL = 5000

// 카테고리 노트 한 장이 가운데 보이고, 5초마다 오른쪽에서 다음 장이 들어오는 슬라이드.
// 마우스를 올리거나 키보드 포커스가 있으면 멈추고, 점/화살표로 직접 넘길 수도 있음.
export default function CategoryCarousel({ cats, posts, onSelect, intro }) {
  const n = cats.length
  // 카테고리별 최근 글 5개 (슬라이드가 넘어갈 때마다 다시 거르지 않도록 글/카테고리가 바뀔 때만 계산)
  const recent = useMemo(
    () => cats.map((c) => posts.filter((p) => (p.category || UNCATEGORIZED) === c.name).slice(0, 5)),
    [cats, posts],
  )
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const prevOff = useRef([])
  const reduced = useRef(false)
  const touchX = useRef(0)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // 목록이 줄어들어 현재 위치가 범위를 벗어나면 되돌림
  useEffect(() => {
    if (index >= n) setIndex(0)
  }, [n, index])

  // index 가 바뀔 때마다 타이머를 새로 걸어서, 직접 넘긴 뒤에는 다시 5초를 기다림
  useEffect(() => {
    if (n < 2 || paused || reduced.current) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % n), INTERVAL)
    return () => clearTimeout(t)
  }, [index, n, paused])

  const go = (i) => setIndex(((i % n) + n) % n)

  // 각 장의 위치(-1: 왼쪽, 0: 가운데, 1: 오른쪽…). 3장 이상이면 원형으로 이어짐
  const offsets = cats.map((_, i) => {
    if (n < 3) return i - index
    let o = (((i - index) % n) + n) % n
    if (o > n / 2) o -= n
    return o
  })
  // 한 번에 두 칸 이상 건너뛰는 장(맨 뒤에서 맨 앞으로 돌아가는 장)은 가운데를 가로지르지 않도록 애니메이션 없이 옮김
  const jumped = offsets.map((o, i) => Math.abs(o - (prevOff.current[i] ?? o)) > 1)
  useEffect(() => {
    prevOff.current = offsets
  })

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
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
      }}
    >
      <div className="cat-viewport">
        {cats.map((c, i) => {
          const off = offsets[i]
          return (
            <div
              key={c.name}
              className={`cat-slide ${jumped[i] ? 'no-anim' : ''} ${off === 0 ? '' : 'side'}`}
              style={{
                // 카드 너비(+간격) 단위로 옆에 늘어놓음. 가운데에서 멀수록 작고 흐리게, 두 칸 밖은 숨김 (창이 넓으면 양옆으로 이어져 보임)
                transform: `translateX(calc(${off} * (100% + 20px))) scale(${Math.abs(off) > 2 ? 0.88 : 1 - 0.06 * Math.abs(off)})`,
                opacity: [1, 0.4, 0.2][Math.abs(off)] ?? 0,
              }}
              aria-hidden={off !== 0}
              onClick={off !== 0 ? () => go(i) : undefined}
            >
              <div className="panel cat-panel" inert={off !== 0}>
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
          <button type="button" className="cat-arrow" aria-label="이전 카테고리" onClick={() => go(index - 1)}>‹</button>
          <div className="cat-dots">
            {cats.map((c, i) => (
              <button
                type="button"
                key={c.name}
                className={i === index ? 'on' : ''}
                aria-label={`${c.name} 보기`}
                aria-current={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button type="button" className="cat-arrow" aria-label="다음 카테고리" onClick={() => go(index + 1)}>›</button>
        </div>
      )}
    </div>
  )
}
