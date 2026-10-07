// 표 열 너비는 마크다운 표 문법에 담을 수 없어서, 표 바로 뒤에 보이지 않는 주석 한 줄로 함께 저장:
//
//   | a | b | c |
//   | - | - | - |
//   | 1 | 2 | 3 |
//
//   <!-- cols: 200,300,326 -->
//
// 주석이라 다른 마크다운 뷰어에서는 아무 영향이 없고, 에디터는 읽을 때 주석을 떼어 내고 저장할 때 다시 붙임.
// 표는 글 안에서 나타나는 순서(0,1,2…)로 구분함.
export const COLS_COMMENT = /^<!--\s*cols:\s*([\d.,\s]+?)\s*-->\s*$/

export const parseCols = (text) => text.split(',').map((s) => Math.round(Number(s))).filter((n) => n > 0)

const FENCE = /^\s*(```|~~~)/
const isRow = (l) => /^[\s>]*\|/.test(l)
const isSep = (l) => /^[\s>]*\|[\s:|-]*-[\s:|-]*$/.test(l)

// 코드블록 밖의 표들이 차지하는 줄 범위 [start, end)
function tableRanges(lines) {
  const out = []
  let fenced = false
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) fenced = !fenced
    if (fenced || !isRow(lines[i]) || !isSep(lines[i + 1] ?? '')) continue
    let end = i + 2
    while (end < lines.length && isRow(lines[end])) end++
    out.push({ start: i, end })
    i = end - 1
  }
  return out
}

const columnCount = (headerLine) => headerLine.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).length

// 불러올 때: 주석을 떼어 내고 표 순서별 너비 배열을 돌려줌
export function extractWidths(md) {
  const lines = md.split('\n')
  const widths = []
  const drop = new Set()
  tableRanges(lines).forEach(({ end }, k) => {
    const m = lines[end + 1]?.match(COLS_COMMENT)
    if (lines[end] === '' && m) {
      widths[k] = parseCols(m[1])
      drop.add(end).add(end + 1)
    }
  })
  return { markdown: lines.filter((_, i) => !drop.has(i)).join('\n'), widths }
}

// 저장할 때: widths[k] 가 있는 표 뒤에 주석을 붙임 (열 개수가 다르면 무시)
export function injectWidths(md, widths) {
  const lines = md.split('\n')
  const ranges = tableRanges(lines)
  for (let k = ranges.length - 1; k >= 0; k--) {
    const w = widths[k]
    const { start, end } = ranges[k]
    if (!w || w.length !== columnCount(lines[start]) || !lines[start].startsWith('|')) continue
    lines.splice(end, 0, '', `<!-- cols: ${w.join(',')} -->`)
  }
  return lines.join('\n')
}
