import { COLS_COMMENT } from './tableWidths.js'

// 표 바로 뒤의 `<!-- cols: 200,300 -->` 주석을 표의 data-cols 속성으로 옮기고 주석 노드는 제거
export default function remarkTableCols() {
  const walk = (node) => {
    if (!node.children) return
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      const next = node.children[i + 1]
      if (child.type === 'table' && next?.type === 'html') {
        const m = next.value.trim().match(COLS_COMMENT)
        if (m) {
          child.data = { ...child.data, hProperties: { ...child.data?.hProperties, dataCols: m[1].replace(/\s/g, '') } }
          node.children.splice(i + 1, 1)
        }
      }
      walk(child)
    }
  }
  return (tree) => walk(tree)
}
