import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export const DAYS = ['월', '화', '수', '목', '금', '토', '일']
// 오늘이 DAYS 의 몇 번째인지 (Date.getDay() 는 일요일이 0)
export const todayIndex = () => (new Date().getDay() + 6) % 7

const REST = '쉬는 날'
const WEEKS = 2 // 멈추기 전까지 지나가는 주 수
// 릴에 올릴 칸들: 오늘부터 하루씩 거슬러 올라가며 WEEKS 주치. 릴이 아래로 내려오므로 위에서 보면 …토 → 일 → 월 → 화… 순서로 지나가다 오늘에서 멈춤
// (맨 앞(위)이 오늘. 오늘 값이 다시 나오는 칸은 7칸 떨어져 있어서 멈추기 직전에 같은 언어가 보이지 않음)
function buildReel(days, today) {
  return Array.from({ length: 7 * WEEKS }, (_, i) => days[(((today - i) % 7) + 7) % 7]?.name || REST)
}

// 메인 화면에 보이는 오늘의 공부 계획 (읽기 전용). spin 이면 슬롯머신처럼 굴러가다 오늘 것에 멈춤
export default function PlannerView({ days, spin }) {
  const day = days?.[todayIndex()]
  const text = day?.name || REST
  const reel = useMemo(() => buildReel(days || [], todayIndex()), [days])
  const [spinning, setSpinning] = useState(() => !!spin && reel.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const reelRef = useRef(null)

  useEffect(() => {
    const el = reelRef.current
    if (!spinning || !el) return
    const anim = el.animate(
      [{ transform: `translateY(${(-(reel.length - 1) / reel.length) * 100}%)` }, { transform: 'translateY(0)' }],
      { duration: 2400, easing: 'cubic-bezier(.12,.6,.15,1)', fill: 'forwards' },
    )
    anim.onfinish = () => setSpinning(false)
    return () => anim.cancel()
  }, [spinning, reel])

  return (
    <div className="planner-view">
      <p className="planner-lead">오늘 공부할 언어는…</p>
      <strong className={`planner-today ${day?.name ? '' : 'rest'}`}>
        <span className={`slot-window ${spinning ? "spin" : ""}`} aria-label={text}>
          {spinning ? (
            <span className="slot-reel" ref={reelRef} aria-hidden="true">
              {reel.map((v, i) => <span key={i}>{v}</span>)}
            </span>
          ) : (
            text
          )}
        </span>
      </strong>
      {/* 부제는 슬롯이 멈춘 뒤에 서서히 나타나 정답을 미리 보여 주지 않음 */}
      {day?.name && day.native && <p className={`planner-native ${spinning ? 'hide' : ''}`}>{day.native}</p>}
      <Link to="/planner" className="planner-edit">계획 보기·수정 →</Link>
    </div>
  )
}
