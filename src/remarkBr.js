// 에디터는 빈 줄을 `<br />` 로 저장합니다. 글에는 태그 글자가 보이는 대신 실제 줄바꿈(빈 줄)으로 렌더링.
//  - 블록 위치의 `<br />`  → 빈 줄 하나짜리 문단
//  - 문장 안의 `<br />`    → 줄바꿈
const BR = /^<br\s*\/?>$/i
const BLOCK_PARENTS = new Set(['root', 'blockquote', 'listItem'])

export default function remarkBr() {
  const walk = (node) => {
    if (!node.children) return
    node.children = node.children.map((child) => {
      if (child.type === 'html' && BR.test(child.value.trim())) {
        const br = { type: 'break' }
        return BLOCK_PARENTS.has(node.type) ? { type: 'paragraph', children: [br] } : br
      }
      walk(child)
      return child
    })
  }
  return (tree) => walk(tree)
}
