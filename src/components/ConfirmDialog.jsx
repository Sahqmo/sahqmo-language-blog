import { useEffect, useRef } from 'react'

// 페이지 안에 뜨는 확인 팝업 (window.confirm 대체). Esc / 바깥 클릭 / 취소로 닫힘
export default function ConfirmDialog({ title, message, confirmLabel = '확인', busy = false, error = '', onConfirm, onCancel }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-desc">
        <h2 id="modal-title">{title}</h2>
        <p id="modal-desc">{message}</p>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button ref={cancelRef} className="btn ghost" onClick={onCancel} disabled={busy}>취소</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? '삭제 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
