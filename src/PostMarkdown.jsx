import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkBr from './remarkBr.js'
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
const mdComponents = { p: Paragraph, table: Table }
const remarkPlugins = [remarkGfm, remarkBreaks, remarkBr, remarkTableCols]

// 글 본문(마크다운)을 화면에 그리는 컴포넌트: 유튜브 플레이어, 열 너비가 저장된 표, 에디터 줄바꿈 등을 처리
export default function PostMarkdown({ children }) {
  return <ReactMarkdown remarkPlugins={remarkPlugins} components={mdComponents}>{children}</ReactMarkdown>
}
