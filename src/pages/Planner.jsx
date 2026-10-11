import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { DAYS, todayIndex } from '../components/PlannerView.jsx'

// 헤더 달력 아이콘으로 들어오는 '언어 공부 플래너' 확인·수정 페이지
export default function Planner() {
  const [days, setDays] = useState(null)
  const [saved, setSaved] = useState(null) // 마지막으로 저장된 값 (변경 여부 비교용)
  const [status, setStatus] = useState('') // '' | 'saving' | 'done'
  const [error, setError] = useState('')
  const [armed, setArmed] = useState(null) // 손잡이를 누른 줄 (이때만 draggable 이라 입력칸의 글자 선택은 그대로 동작)
  const [drag, setDrag] = useState(null) // { from, over } 드래그 중인 줄과 지금 올라가 있는 줄

  useEffect(() => {
    api.planner().then((p) => {
      setDays(p.days)
      setSaved(p.days)
    }).catch((e) => setError(e.message))
  }, [])

  if (error && !days) return <p className="state error">{error}</p>
  if (!days) return <p className="state">불러오는 중…</p>

  const dirty = days.some((d, i) => d.name !== saved[i].name || d.native !== saved[i].native)
  const edit = (i, field, v) => {
    setStatus('')
    setDays(days.map((d, j) => (j === i ? { ...d, [field]: v } : d)))
  }
  // from 번째 줄의 계획을 to 번째 자리로 옮김 (요일 이름은 자리에 고정, 내용만 이동)
  const move = (from, to) => {
    if (from === to) return
    const next = [...days]
    next.splice(to, 0, next.splice(from, 1)[0])
    setStatus('')
    setDays(next)
  }
  const endDrag = () => {
    setDrag(null)
    setArmed(null)
  }
  const save = async (e) => {
    e.preventDefault()
    setStatus('saving')
    setError('')
    try {
      const p = await api.savePlanner(days)
      setDays(p.days)
      setSaved(p.days)
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('')
    }
  }

  return (
    <form className="planner-page" onSubmit={save}>
      <h1>언어 공부 플래너</h1>
      <p className="planner-hint">왼쪽 ⠿ 손잡이를 끌어 순서를 바꿀 수 있어요. 요일마다 공부할 언어를 적어 두면 메인 화면에 보여요. 아래 칸에는 그 언어로 쓴 언어 이름(예: 영어 → English)을 적어요.</p>
      <ul className="planner-form">
        {DAYS.map((d, i) => (
          <li
            key={d}
            className={[i === todayIndex() && 'today', drag?.from === i && 'dragging', drag && drag.over === i && drag.from !== i && (drag.from < i ? 'over-after' : 'over-before')].filter(Boolean).join(' ')}
            draggable={armed === i}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(i))
              setDrag({ from: i, over: i })
            }}
            onDragOver={(e) => {
              if (!drag) return
              e.preventDefault()
              if (drag.over !== i) setDrag({ ...drag, over: i })
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (drag) move(drag.from, i)
              endDrag()
            }}
            onDragEnd={endDrag}
          >
            <span className="planner-grip" title="끌어서 순서 바꾸기" aria-hidden="true" onPointerDown={() => setArmed(i)} onPointerUp={() => setArmed(null)}>⠿</span>
            <label htmlFor={`day-${i}`}>{d}</label>
            <div className="planner-fields">
              <input
                id={`day-${i}`}
                value={days[i].name}
                maxLength={100}
                placeholder="쉬는 날"
                onChange={(e) => edit(i, 'name', e.target.value)}
              />
              <input
                className="sub"
                aria-label={`${d}요일 부제`}
                value={days[i].native}
                maxLength={100}
                placeholder="부제 (예: English, Deutsch)"
                onChange={(e) => edit(i, 'native', e.target.value)}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="planner-actions">
        <button className="btn" disabled={!dirty || status === 'saving'}>{status === 'saving' ? '저장 중…' : '저장'}</button>
        {status === 'done' && !dirty && <span className="planner-ok">저장했어요</span>}
        {error && <span className="state error">{error}</span>}
      </div>
    </form>
  )
}
