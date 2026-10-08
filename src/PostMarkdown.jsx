import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import remarkBreaks from 'remark-breaks'
import remarkBr from './remarkBr.js'
import remarkStrongFix from './remarkStrongFix.js'
import remarkTableCols from './remarkTableCols.js'
import { embedUrl, parseYouTube } from './youtube.js'

// 혼자 한 줄에 있는 유튜브 링크 문단은 영상 플레이어로, 나머지는 평소처럼 렌더링
function Paragraph({ node, children, ...props }) {
  const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()))
  const yt = kids.length === 1 && kids[0].tagName === 'a' ? parseYouTube(kids[0].properties.href) : null
  if (!yt) return <p {...props}>{children}</p>
  return (
    <div className="yt-embed">
      <iframe
        src={embedUrl(yt)}
        title="YouTube 영상"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )
}
// 열 너비가 저장된 표는 그 너비대로(좁은 화면에서는 가로 스크롤), 아니면 평소처럼 본문 폭에 맞춰 렌더링
function Table({ node, children, ...props }) {
  const { 'data-cols': dataCols, dataCols: dataColsCamel, ...rest } = props
  const raw = dataCols ?? dataColsCamel
  const cols = raw ? String(raw).split(',').map(Number).filter((n) => n > 0) : []
  if (!cols.length) return <table {...rest}>{children}</table>
  return (
    <div className="table-scroll">
      <table {...rest} style={{ width: cols.reduce((a, b) => a + b, 0), tableLayout: 'fixed' }}>
        <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        {children}
      </table>
    </div>
  )
}

// 코드 블록: 마우스를 올리면 오른쪽 위에 복사/다운로드 버튼이 나타남
const FILE_EXT = {
  javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx', python: 'py', py: 'py', json: 'json',
  html: 'html', xml: 'xml', css: 'css', scss: 'scss', sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh', java: 'java', c: 'c',
  cpp: 'cpp', csharp: 'cs', go: 'go', rust: 'rs', rs: 'rs', yaml: 'yml', yml: 'yml', markdown: 'md', md: 'md', php: 'php',
  ruby: 'rb', kotlin: 'kt', swift: 'swift', diff: 'diff',
}
const icon = (d) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)
const COPY_ICON = icon(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>)
const CHECK_ICON = icon(<path d="M5 12.5l4.5 4.5L19 7.5" />)
const DOWNLOAD_ICON = icon(<><path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></>)
const nodeText = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(nodeText).join(''))

function CodeBlock({ node, children, ...props }) {
  const [copied, setCopied] = useState(false)
  const code = nodeText(node).replace(/\n$/, '')
  const cls = [].concat(node.children?.[0]?.properties?.className ?? []).find((c) => String(c).startsWith('language-'))
  const lang = cls ? String(cls).slice(9).toLowerCase() : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: code })
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([code + '\n'], { type: 'text/plain;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `code.${FILE_EXT[lang] ?? 'txt'}` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="code-block">
      <pre {...props}>{children}</pre>
      <div className="code-actions">
        <button type="button" onClick={copy} title={copied ? '복사됨' : '복사'} aria-label="코드 복사">{copied ? CHECK_ICON : COPY_ICON}</button>
        <button type="button" onClick={download} title="다운로드" aria-label="코드 다운로드">{DOWNLOAD_ICON}</button>
      </div>
    </div>
  )
}
const mdComponents = { p: Paragraph, table: Table, pre: CodeBlock }
const remarkPlugins = [remarkGfm, remarkBreaks, remarkBr, remarkStrongFix, remarkTableCols]
// 언어를 적은 코드 블록만 색을 입힘 (언어 자동 추측은 끔)
const rehypePlugins = [[rehypeHighlight, { detect: false, ignoreMissing: true }]]

// 글 본문(마크다운)을 화면에 그리는 컴포넌트: 유튜브 플레이어, 열 너비가 저장된 표, 에디터 줄바꿈 등을 처리
export default function PostMarkdown({ children }) {
  return <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={mdComponents}>{children}</ReactMarkdown>
}
