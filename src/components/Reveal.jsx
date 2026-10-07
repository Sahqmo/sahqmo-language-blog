import { useEffect, useRef, useState } from 'react'

// 한 번에 화면에 들어온 블록들은 위에서 아래 순서로 조금씩 시차를 두고 나타남.
// (블록마다 따로 관찰하면 도착 순서가 뒤섞이고, 목록 순번 기준 지연은 스크롤 위치와 안 맞아서 순서가 어색해짐)
const STAGGER = 70
const callbacks = new WeakMap()
let observer = null

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((e, i) => {
          const show = callbacks.get(e.target)
          observer.unobserve(e.target)
          callbacks.delete(e.target)
          if (show) setTimeout(show, i * STAGGER)
        })
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  )
  return observer
}

// 화면에 들어올 때 한 번 부드럽게 나타나는 래퍼 (스크롤 적응형 등장 효과)
export default function Reveal({ as: Tag = 'div', className = '', children }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) return setShown(true)
    let alive = true
    callbacks.set(el, () => alive && setShown(true))
    getObserver().observe(el)
    return () => {
      alive = false
      callbacks.delete(el)
      observer?.unobserve(el)
    }
  }, [])

  return (
    <Tag ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`}>
      {children}
    </Tag>
  )
}
