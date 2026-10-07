import { useCallback, useEffect, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import { insert } from '@milkdown/utils'
import { commandsCtx, editorViewCtx, remarkPluginsCtx } from '@milkdown/kit/core'
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark'
import { addRowAfterCommand, tableCellSchema, tableHeaderSchema } from '@milkdown/kit/preset/gfm'
import { addColumn, deleteColumn, deleteRow, deleteTable, isInTable, selectedRect } from '@milkdown/kit/prose/tables'
import { Selection } from '@milkdown/kit/prose/state'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { api } from '../api.js'
import { isYouTubeUrl, parseYouTube } from '../youtube.js'
import { extractWidths, injectWidths } from '../tableWidths.js'

async function uploadImage(file) {
  const { url } = await api.upload(file)
  return url
}

// 캡션 없는 이미지(`![1.00](주소)`)는 title 이 null 로 파싱되어, 이미지 블록의 caption(문자열 필수) 검증에 걸려
// 글을 다시 열면 블록이 통째로 사라짐. 파싱 직후 title 을 빈 문자열로 맞춰 줌.
// 이미지 블록 변환보다 먼저 실행되어야 해서, 다른 플러그인이 등록되기 전에 설정 단계에서 맨 앞에 끼워 넣음
const fixImageTitle = () => (tree) => {
  const walk = (node) => {
    if (node.type === 'image' && node.title == null) node.title = ''
    node.children?.forEach(walk)
  }
  walk(tree)
}

// ---------- 표 열 너비 ----------
// 셀의 colwidth([px]) 속성은 기본 스키마에 이미 있지만 화면에는 반영되지 않아서, 셀 DOM 에 너비 스타일을 붙여 줌
const withColWidth = (schema) =>
  schema.extendSchema((prev) => (ctx) => {
    const base = prev(ctx)
    return {
      ...base,
      toDOM: (node) => {
        const spec = base.toDOM(node)
        const w = node.attrs.colwidth?.[0]
        if (w) spec[1] = { ...spec[1], style: `${spec[1]?.style ?? ''};width:${w}px;min-width:${w}px;max-width:${w}px` }
        return spec
      },
    }
  })
const colWidthPlugins = [withColWidth(tableCellSchema), withColWidth(tableHeaderSchema)]

const MIN_COL = 60
const GRAB = 5 // 셀 오른쪽 테두리에서 이 픽셀 안쪽이면 너비 조절 영역

// 마우스 위치 아래에서 "너비를 조절할 수 있는 열 테두리"를 찾음 → { cell, table, index } | null
function borderAt(e) {
  const block = e.target.closest?.('.milkdown-table-block')
  if (!block || e.target.closest('.add-button, .button-group')) return null
  for (const cell of block.querySelectorAll('td, th')) {
    const r = cell.getBoundingClientRect()
    if (e.clientY >= r.top && e.clientY <= r.bottom && Math.abs(e.clientX - r.right) <= GRAB) {
      return { cell, table: cell.closest('table'), index: cell.cellIndex }
    }
  }
  return null
}

// ---------- 표 공통 도우미 ----------
// 선택 위치가 속한 표의 깊이 (표 밖이면 0)
function tableDepth($pos) {
  let d = $pos.depth
  while (d > 0 && $pos.node(d).type.spec.tableRole !== 'table') d--
  return d
}

// 표 첫 행의 열 너비(px) 목록 (너비가 없는 열은 0)
function firstRowWidths(table) {
  const out = []
  table.firstChild?.forEach((cell) => out.push(cell.attrs.colwidth?.[0] ?? 0))
  return out
}

// 표의 모든 셀에 열 너비를 기록 (widths 가 null 이면 모두 지움). 값이 달라지는 셀만 바꿈. tableStart 는 표 안쪽 시작 위치
function writeWidths(tr, table, tableStart, widths) {
  table.forEach((row, rowOffset) =>
    row.forEach((cell, cellOffset, i) => {
      const w = widths?.[i] || null
      if ((cell.attrs.colwidth?.[0] ?? null) !== w) {
        tr.setNodeMarkup(tableStart + rowOffset + 1 + cellOffset, null, { ...cell.attrs, colwidth: w && [w] })
      }
    }),
  )
}

// 너비 보정은 사용자가 한 편집이 아니므로 되돌리기 기록에 남기지 않음
function commitQuietly(view, tr) {
  if (tr.docChanged) view.dispatch(tr.setMeta('addToHistory', false))
}

// 표의 모든 행에서 열 너비(px)를 문서에 기록
function setColumnWidths(view, tableEl, widths) {
  const first = tableEl.querySelector('td, th')
  if (!first) return
  const $pos = view.state.doc.resolve(view.posAtDOM(first, 0))
  const d = tableDepth($pos)
  if (!d) return
  const tr = view.state.tr
  writeWidths(tr, $pos.node(d), $pos.start(d), widths)
  if (tr.docChanged) view.dispatch(tr)
}

// 문서 안 표들의 열 너비 목록 (표 순서대로, 너비를 바꾼 적 없는 표는 null)
function collectWidths(doc) {
  const out = []
  doc.descendants((node) => {
    if (node.type.spec.tableRole !== 'table') return
    const widths = firstRowWidths(node)
    out.push(widths.length && widths.every(Boolean) ? widths : null)
    return false
  })
  return out
}

// 불러온 너비를 문서의 표들에 적용 (열 개수가 다르면 무시)
function applyWidths(view, widths) {
  const tr = view.state.tr
  let k = 0
  view.state.doc.descendants((node, pos) => {
    if (node.type.spec.tableRole !== 'table') return
    const w = widths[k++]
    if (w && node.firstChild?.childCount === w.length) writeWidths(tr, node, pos + 1, w)
    return false
  })
  commitQuietly(view, tr)
}

const YOUTUBE_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>'

// 유튜브 링크는 글 안에서 "혼자 한 줄에 있는 링크"로 저장되고, 발행된 글에서 플레이어로 보여요.
const youtubeMarkdown = (url) => {
  const { id, start } = parseYouTube(url)
  const clean = `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}` : ''}`
  return `[${clean}](${clean})`
}

// 노션처럼 입력 즉시 서식이 적용되는 WYSIWYG 에디터. 저장 형식은 마크다운 그대로.
//   - 마크다운 단축 입력: "# ", "- ", "> ", "```", **굵게** 등
//   - "/" 로 블록 메뉴, 블록 왼쪽 핸들로 이동/추가
// defaultValue 는 최초 마운트 시에만 사용합니다. 값이 바뀌면 key 로 다시 마운트하세요.
export default function RichEditor({ defaultValue, getMarkdownRef, onError, onNotice }) {
  const rootRef = useRef(null)
  const crepeRef = useRef(null)
  const [tableBar, setTableBar] = useState(null) // 커서가 표 안에 있을 때 표 아래에 띄우는 열/행 추가 버튼 위치

  // 표 기본 컨트롤은 셀 테두리 근처에 마우스를 가져가야만 '+'가 나타나서 찾기 어려움 → 표 안에 있을 때 항상 보이는 버튼 제공
  const updateTableBar = useCallback(() => {
    const root = rootRef.current
    const node = window.getSelection()?.anchorNode
    const el = node && (node.nodeType === 1 ? node : node.parentElement)
    const table = el?.closest('table')
    if (!root || !table || !root.contains(table)) return setTableBar(null)
    const t = table.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    const next = { top: t.bottom - r.top + 6, left: t.left - r.left, width: t.width, inHeader: !!el.closest('th'), cols: table.rows[0]?.cells.length ?? 0, rows: table.rows.length }
    setTableBar(next)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateTableBar)
    window.addEventListener('resize', updateTableBar)
    return () => {
      document.removeEventListener('selectionchange', updateTableBar)
      window.removeEventListener('resize', updateTableBar)
    }
  }, [updateTableBar])

  // 열 테두리를 끌어 너비 조절 (노션처럼): 끄는 열은 늘고 오른쪽 열은 줄어 표 전체 폭은 유지
  useEffect(() => {
    const root = rootRef.current
    let drag = null
    const view = () => crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx))

    const onMove = (e) => {
      if (!drag) return root.classList.toggle('col-resize', !!borderAt(e))
      const { widths, index, startX } = drag
      const next = widths.slice()
      let dx = e.clientX - startX
      if (index < widths.length - 1) {
        dx = Math.max(MIN_COL - widths[index], Math.min(dx, widths[index + 1] - MIN_COL))
        next[index] = Math.round(widths[index] + dx)
        next[index + 1] = Math.round(widths[index + 1] - dx)
      } else {
        // 마지막 열: 표가 에디터 폭을 넘지 않는 범위에서 조절
        const room = drag.limit - widths.reduce((a, b) => a + b, 0)
        next[index] = Math.round(Math.max(MIN_COL, widths[index] + Math.min(dx, Math.max(room, 0))))
      }
      cancelAnimationFrame(drag.raf)
      drag.raf = requestAnimationFrame(() => {
        const v = view()
        if (v) setColumnWidths(v, drag.table, next)
        updateTableBar()
      })
    }
    const onDown = (e) => {
      const hit = e.button === 0 && borderAt(e)
      if (!hit) return
      e.preventDefault()
      e.stopPropagation()
      const cells = [...hit.table.querySelector('tr').children]
      drag = {
        table: hit.table,
        index: hit.index,
        startX: e.clientX,
        widths: cells.map((c) => Math.round(c.getBoundingClientRect().width)),
        limit: hit.table.closest('.milkdown-table-block').getBoundingClientRect().width,
        raf: 0,
      }
      root.setPointerCapture?.(e.pointerId)
      root.classList.add('col-resize', 'resizing')
    }
    const onUp = () => {
      if (!drag) return
      drag = null
      root.classList.remove('resizing')
    }
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerdown', onDown, true)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    return () => {
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerdown', onDown, true)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onUp)
    }
  }, [updateTableBar])

  // 표 안에서 열/행/표 삭제 (마지막 남은 열·행은 지워지지 않음)
  const runTableEdit = (edit, keepCursor = true) => {
    crepeRef.current?.editor.action((ctx) => {
      const v = ctx.get(editorViewCtx)
      // 지우기 전 커서가 있던 표/행/열 위치를 기억
      const { $from } = v.state.selection
      const d = tableDepth($from)
      const at = d ? { tableStart: $from.start(d), row: $from.index(d), col: $from.index(d + 1) } : null
      const before = d ? firstRowWidths($from.node(d)) : []
      if (!edit(v.state, (tr) => v.dispatch(tr))) return
      // 열을 지우면 그 열의 너비만큼 표 전체 폭이 줄어 오른쪽에 빈 공간이 생기므로, 지운 너비를 그 자리를 이어받은 열(마지막 열이면 그 앞 열)에 더해 줌
      const shrunk = at && before.length && before.every(Boolean) ? v.state.doc.nodeAt(at.tableStart - 1) : null
      if (shrunk?.type.spec.tableRole === 'table' && shrunk.firstChild.childCount < before.length) {
        const widths = firstRowWidths(shrunk)
        const deficit = before.reduce((a, b) => a + b, 0) - widths.reduce((a, b) => a + b, 0)
        // 1열만 남으면 너비 정보를 모두 지워 처음 만든 표처럼 되돌림 (이후 열 추가는 균등 분할)
        const reset = widths.length === 1
        if (reset || (deficit > 0 && widths.every(Boolean))) {
          if (!reset) widths[Math.min(at.col, widths.length - 1)] += deficit
          const tr = v.state.tr
          writeWidths(tr, shrunk, at.tableStart, reset ? null : widths)
          commitQuietly(v, tr)
        }
      }
      if (!keepCursor || !at) return
      // 지우고 나면 커서가 제목 행이나 표 밖으로 밀려날 수 있어서, 같은 위치(없으면 가장 가까운 행/열)의 셀로 되돌려 계속 이어서 편집할 수 있게 함
      const table = v.state.doc.nodeAt(at.tableStart - 1)
      if (table?.type.spec.tableRole !== 'table') return
      const row = Math.min(at.row, table.childCount - 1)
      let pos = at.tableStart
      for (let i = 0; i < row; i++) pos += table.child(i).nodeSize
      const rowNode = table.child(row)
      pos += 1
      for (let i = 0; i < Math.min(at.col, rowNode.childCount - 1); i++) pos += rowNode.child(i).nodeSize
      v.dispatch(v.state.tr.setSelection(Selection.near(v.state.doc.resolve(pos + 1), 1)))
    })
    requestAnimationFrame(updateTableBar)
  }

  // 커서가 제목 행에 있을 때(표를 막 만든 직후 등)의 '－ 행': 제목 행은 지울 수 없으므로 바로 아래 본문 행을 지움
  const deleteRowBelowHeader = (state, dispatch) => {
    const { $from } = state.selection
    const d = tableDepth($from)
    if (!d) return false
    const table = $from.node(d)
    if (table.childCount < 3) return false
    let pos = $from.start(d) + table.child(0).nodeSize + 1 // 둘째 행 안쪽
    pos += 1 // 첫 셀 안쪽
    const moved = state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(pos + 1), 1)))
    return deleteRow(moved, dispatch)
  }

  // 열 추가는 항상 표 맨 끝에 붙임 (커서 위치와 무관)
  const appendColumn = (state, dispatch) => {
    if (!isInTable(state)) return false
    if (dispatch) {
      const rect = selectedRect(state)
      dispatch(addColumn(state.tr, rect, rect.map.width))
    }
    return true
  }

  // 열/행 추가: 새 셀에는 colwidth 가 없어서 그대로 두면 표 너비 정보가 깨지므로(저장 시 통째로 사라짐), 추가 직후 모든 행에 열 너비를 다시 채워 줌
  const runTableCommand = (command) => {
    crepeRef.current?.editor.action((ctx) => {
      const v = ctx.get(editorViewCtx)
      const { $from } = v.state.selection
      const d = tableDepth($from)
      const tableStart = d ? $from.start(d) : 0
      const before = d ? firstRowWidths($from.node(d)) : []
      // Milkdown 의 $command 도 함수이므로 typeof 가 아니라 key 유무로 구분
      if (command.key) ctx.get(commandsCtx).call(command.key)
      else command(v.state, v.dispatch.bind(v))
      if (!d || !before.length || !before.every(Boolean)) return // 너비를 조절한 적 없는 표는 건드리지 않음
      const table = v.state.doc.nodeAt(tableStart - 1)
      if (table?.type.spec.tableRole !== 'table') return
      const widths = before.slice()
      if (table.firstChild.childCount === before.length + 1) {
        // 새 열은 마지막 열의 너비를 반으로 나눠 가짐 → 표 전체 폭은 절대 늘어나지 않음
        const last = before.length - 1
        const half = Math.floor(before[last] / 2)
        widths[last] = before[last] - half
        widths.push(half)
      } else if (table.firstChild.childCount !== before.length) return
      const tr = v.state.tr
      writeWidths(tr, table, tableStart, widths)
      commitQuietly(v, tr)
    })
    requestAnimationFrame(updateTableBar)
  }

  const notice = () => onNotice?.('유튜브 링크를 넣었어요. 발행하면 영상 플레이어로 보여요.')

  useEffect(() => {
    const loaded = extractWidths(defaultValue ?? '') // 표 너비 주석은 떼어 내고 에디터에는 순수한 마크다운만 전달
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: loaded.markdown,
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: "내용을 입력하세요. '/' 를 누르면 블록 메뉴가 열려요." },
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            label: '텍스트',
            text: { label: '본문' },
            h1: { label: '제목 1' },
            h2: { label: '제목 2' },
            h3: { label: '제목 3' },
            h4: { label: '제목 4' },
            h5: { label: '제목 5' },
            h6: { label: '제목 6' },
            quote: { label: '인용' },
            divider: { label: '구분선' },
          },
          listGroup: {
            label: '목록',
            bulletList: { label: '글머리 기호 목록' },
            orderedList: { label: '번호 목록' },
            taskList: { label: '체크리스트' },
          },
          advancedGroup: {
            label: '고급',
            image: { label: '이미지' },
            codeBlock: { label: '코드 블록' },
            table: { label: '표' },
            math: { label: '수식' },
          },
        buildMenu: (builder) => {
            builder.getGroup('advanced').addItem('youtube', {
              label: '유튜브',
              icon: YOUTUBE_ICON,
              onRun: (ctx) => {
                ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key) // 입력한 "/" 제거
                const url = window.prompt('유튜브 영상 주소를 붙여넣으세요')
                if (!url) return
                if (!isYouTubeUrl(url)) return onError?.('유튜브 주소가 아닌 것 같아요.')
                insert(youtubeMarkdown(url))(ctx)
                notice()
              },
            })
          },
        },
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadImage,
          inlineOnUpload: uploadImage,
          blockOnUpload: uploadImage,
          inlineUploadButton: '업로드',
          inlineUploadPlaceholderText: '또는 이미지 링크 붙여넣기',
          inlineConfirmButton: '확인',
          blockUploadButton: '파일 업로드',
          blockUploadPlaceholderText: '또는 이미지 링크 붙여넣기',
          blockConfirmButton: '확인',
          blockCaptionPlaceholderText: '캡션 입력…',
        },
        [Crepe.Feature.LinkTooltip]: { inputPlaceholder: '링크 주소 붙여넣기…' },
      },
    })
    crepe.editor.config((ctx) => ctx.update(remarkPluginsCtx, (ps) => [{ plugin: fixImageTitle, options: undefined }, ...ps]))
    crepe.editor.use(colWidthPlugins)
    let cancelled = false
    crepe.create().then(() => {
      if (cancelled) return crepe.destroy()
      crepeRef.current = crepe
      crepe.editor.action((ctx) => applyWidths(ctx.get(editorViewCtx), loaded.widths))
    })
    // 저장 시점에 항상 최신 내용을 직접 읽어 가도록 노출 (변경 이벤트는 디바운스됨)
    if (getMarkdownRef) {
      getMarkdownRef.current = () => {
        const c = crepeRef.current
        if (!c) return defaultValue
        const widths = c.editor.action((ctx) => collectWidths(ctx.get(editorViewCtx).state.doc))
        return injectWidths(c.getMarkdown(), widths)
      }
    }
    return () => {
      cancelled = true
      if (crepeRef.current === crepe) {
        crepeRef.current = null
        crepe.destroy()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 유튜브 주소만 붙여넣으면 자동으로 영상 링크로 삽입
  function handlePaste(e) {
    const text = e.clipboardData.getData('text/plain')
    if (e.clipboardData.files.length || !isYouTubeUrl(text) || !crepeRef.current) return handleFiles(e, e.clipboardData.files)
    e.preventDefault()
    e.stopPropagation()
    crepeRef.current.editor.action(insert(youtubeMarkdown(text)))
    notice()
  }

  // 이미지 붙여넣기 / 드래그&드롭 → 업로드 후 그 자리에 삽입
  async function handleFiles(e, files) {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    if (!images.length || !crepeRef.current) return
    e.preventDefault()
    e.stopPropagation()
    try {
      for (const file of images) {
        const url = await uploadImage(file)
        const alt = (file.name || 'image').replace(/\.[^.]+$/, '')
        crepeRef.current?.editor.action(insert(`![${alt}](${url})`))
      }
    } catch (err) {
      onError?.(err.message)
    }
  }

  return (
    <div
      ref={rootRef}
      className="rich-editor"
      onPasteCapture={handlePaste}
      onDropCapture={(e) => handleFiles(e, e.dataTransfer.files)}
    >
      {tableBar && (
        <div className="table-bar" style={{ top: tableBar.top, left: tableBar.left, width: tableBar.width }} onMouseDown={(e) => e.preventDefault()}>
          <button type="button" title="열 추가" onClick={() => runTableCommand(appendColumn)}>＋ 열</button>
          <button type="button" title="행 추가" onClick={() => runTableCommand(addRowAfterCommand)}>＋ 행</button>
          <button type="button" title={tableBar.cols <= 1 ? '마지막 열은 지울 수 없어요 (표를 지우려면 표 삭제)' : '열 삭제'} disabled={tableBar.cols <= 1} onClick={() => runTableEdit(deleteColumn)}>－ 열</button>
          <button type="button" title={tableBar.rows <= 2 ? '마지막 행은 지울 수 없어요 (표를 지우려면 표 삭제)' : tableBar.inHeader ? '제목 행 바로 아래 행 삭제 (제목 행은 삭제할 수 없어요)' : '행 삭제'} disabled={tableBar.rows <= 2} onClick={() => runTableEdit(tableBar.inHeader ? deleteRowBelowHeader : deleteRow)}>－ 행</button>
          <button type="button" className="danger" title="표 삭제" onClick={() => runTableEdit(deleteTable, false)}>표 삭제</button>
        </div>
      )}
    </div>
  )
}
