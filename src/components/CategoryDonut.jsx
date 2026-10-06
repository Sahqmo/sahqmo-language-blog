import { useState } from 'react'
import { Link } from 'react-router-dom'

// 카테고리별 고정 순서 색상 (라이트/다크 모두에서 구분되는 차분한 톤)
export const PALETTE = ['#5f7a5c', '#c58a4a', '#6f8fa6', '#b4655a', '#8a6fa0', '#b8a24e', '#4f9a94', '#9a7b66']
export const UNCATEGORIZED = '미분류'

export function countCategories(posts) {
  const map = new Map()
  for (const p of posts) {
    const c = p.category || UNCATEGORIZED
    map.set(c, (map.get(c) || 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((c, i) => ({ ...c, color: PALETTE[i % PALETTE.length] }))
}

export default function CategoryDonut({ data, total }) {
  const R = 15.9155 // 둘레 = 100
  let offset = 0
  const [tip, setTip] = useState(null) // { x, y, d }
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 42 42" className="donut" role="img" aria-label="카테고리별 글 비율">
        <circle cx="21" cy="21" r={R} fill="none" stroke="var(--line)" strokeWidth="5" />
        {data.map((d) => {
          const pct = (d.count / total) * 100
          const el = (
            <circle
              key={d.name}
              cx="21" cy="21" r={R} fill="none"
              stroke={d.color} strokeWidth={tip?.d.name === d.name ? 6 : 5}
              className="slice"
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, d })}
              onMouseLeave={() => setTip(null)}
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={25 - offset}
            />
          )
          offset += pct
          return el
        })}
        <text x="21" y="20.5" textAnchor="middle" className="donut-num">{total}</text>
        <text x="21" y="25.5" textAnchor="middle" className="donut-label">posts</text>
      </svg>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.name}>
            <Link to={d.name === UNCATEGORIZED ? '/' : `/?category=${encodeURIComponent(d.name)}`}>
              <i style={{ background: d.color }} />
              <span>{d.name}</span>
            </Link>
          </li>
        ))}
      </ul>
      {tip && (
        <div className="donut-tip" style={{ left: tip.x, top: tip.y }}>
          <i style={{ background: tip.d.color }} />
          {tip.d.name} {Math.round((tip.d.count / total) * 100)}%
          <small>{tip.d.count}편</small>
        </div>
      )}
    </div>
  )
}
