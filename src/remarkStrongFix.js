// CommonMark 규칙상 `**"언어 오타쿠"**가` 처럼 닫는 표시 앞이 문장부호이고 바로 뒤에 글자가 붙으면 굵게 처리되지 않고
// `**` 가 그대로 보임(한국어 조사가 붙을 때 흔함). 굵게뿐 아니라 기울임(`*…*`), 취소선(`~~…~~`)도 같은 문제라서,
// 파싱 후에도 글자로 남은 표시를 서식으로 바꿔 줌. 게시글 화면과 에디터가 같은 플러그인을 씀.
//   - 안쪽이 공백으로 시작/끝나면(예: `2 * 3 * 4`) 서식이 아니므로 건드리지 않음
//   - 굵게 → 취소선 → 기울임 순으로 처리해서 `**` 가 기울임 두 개로 잘못 읽히지 않게 함
const RULES = [
  { type: 'strong', re: /\*\*(?=\S)([^*\n]*?\S)\*\*/g },
  { type: 'delete', re: /~~(?=\S)([^~\n]*?\S)~~/g },
  { type: 'emphasis', re: /(?<!\*)\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\*)/g },
]

// Milkdown 의 marker 플러그인이 strong/emphasis 노드의 position.start.offset 위치 글자를 읽어 `*`/`_` 를 정함.
// 우리가 만든 노드에는 원문 위치가 없어서 에러가 나므로(에디터가 빈 화면이 됨), 원문 안의 `*` 위치를 가리키게 해 둠.
let starAt = null
const star = () => ({ start: { line: 1, column: 1, offset: starAt }, end: { line: 1, column: 1, offset: starAt } })

function split(text, rules) {
  const [rule, ...rest] = rules
  if (!rule) return [{ type: 'text', value: text }]
  const out = []
  let last = 0
  for (const m of text.matchAll(rule.re)) {
    if (m.index > last) out.push(...split(text.slice(last, m.index), rest))
    const node = { type: rule.type, children: split(m[1], rules) }
    if (rule.type !== 'delete') Object.assign(node, { marker: '*', position: star() })
    out.push(node)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(...split(text.slice(last), rest))
  return out
}

export default function remarkStrongFix() {
  const walk = (node) => {
    if (!node.children || node.type === 'code' || node.type === 'inlineCode') return
    const out = []
    for (const child of node.children) {
      if (child.type !== 'text' || !/\*|~~/.test(child.value)) {
        walk(child)
        out.push(child)
      } else {
        out.push(...split(child.value, RULES))
      }
    }
    node.children = out
  }
  return (tree, file) => {
    starAt = Math.max(0, String(file?.value ?? '').indexOf('*'))
    walk(tree)
  }
}
