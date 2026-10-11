import { useSyncExternalStore } from 'react'
import { formatDate, formatDateTime, formatRelative } from '../api.js'

// 화면을 열어 둔 채로도 "5분 전" 같은 표시가 낡지 않도록 주기적으로 다시 계산.
// 표시되는 항목이 많아도 타이머는 하나만 돌리고, 보이는 항목이 없으면 멈춤
const TICK = 30000
const listeners = new Set()
let now = Date.now()
let timer = 0

function subscribe(fn) {
  listeners.add(fn)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, TICK)
  }
  return () => {
    listeners.delete(fn)
    if (!listeners.size) {
      clearInterval(timer)
      timer = 0
    }
  }
}

const useNow = () => useSyncExternalStore(subscribe, () => now)

// 상대 시간만 (예: "3일 전")
export function Rel({ iso, className }) {
  const now = useNow()
  if (!iso) return null
  return <time className={className} dateTime={iso} title={formatDateTime(iso)}>{formatRelative(iso, now)}</time>
}

// "3일 전・2026년 10월 4일" (withTime 이면 날짜 뒤에 시각까지)
export default function DateLabel({ iso, withTime = false }) {
  const now = useNow()
  if (!iso) return null
  return (
    <time dateTime={iso}>
      {formatRelative(iso, now)}・{withTime ? formatDateTime(iso) : formatDate(iso)}
    </time>
  )
}

// 글 페이지용: 정확한 날짜·시각을 먼저 크게, 상대 시간은 옆에 흐리게. 수정 시각은 아래 줄에 따로
export function PostDates({ date, updated }) {
  const now = useNow()
  if (!date) return null
  return (
    <div className="post-dates">
      <div>
        <time dateTime={date}>{formatDateTime(date)}</time>
        <span className="rel">{formatRelative(date, now)}</span>
      </div>
      {updated && (
        <div className="edited">
          <span className="tag">수정</span>
          <time dateTime={updated}>{formatDateTime(updated)}</time>
          <span className="rel">{formatRelative(updated, now)}</span>
        </div>
      )}
    </div>
  )
}
