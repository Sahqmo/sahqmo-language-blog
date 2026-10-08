// CommonMark 규칙상 `**"언어 오타쿠"**가` 처럼 닫는 `**` 앞이 문장부호이고 바로 뒤에 글자가 붙으면 굵게 처리되지 않고
// `**` 가 그대로 보임(한국어 조사가 붙을 때 흔함). 파싱 후에도 글자로 남은 `**…**` 를 굵게 바꿔 줌.
const BOLD = /\*\*([^*\n]+?)\*\*/g

export default function remarkStrongFix() {
  const walk = (node) => {
    if (!node.children || node.type === 'code' || node.type === 'inlineCode') return
    const out = []
    for (const child of node.children) {
      if (child.type !== 'text' || !child.value.includes('**')) {
        walk(child)
        out.push(child)
        continue
      }
      let last = 0
      for (const m of child.value.matchAll(BOLD)) {
        if (m.index > last) out.push({ type: 'text', value: child.value.slice(last, m.index) })
        out.push({ type: 'strong', children: [{ type: 'text', value: m[1] }] })
        last = m.index + m[0].length
      }
      if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) })
    }
    node.children = out
  }
  return (tree) => walk(tree)
}
