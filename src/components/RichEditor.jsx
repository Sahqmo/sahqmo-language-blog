import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import { insert } from '@milkdown/utils'
import { commandsCtx, remarkPluginsCtx } from '@milkdown/kit/core'
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { api } from '../api.js'
import { isYouTubeUrl, parseYouTube } from '../youtube.js'

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

  const notice = () => onNotice?.('유튜브 링크를 넣었어요. 발행하면 영상 플레이어로 보여요.')

  useEffect(() => {
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue,
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
    let cancelled = false
    crepe.create().then(() => {
      if (cancelled) return crepe.destroy()
      crepeRef.current = crepe
    })
    // 저장 시점에 항상 최신 내용을 직접 읽어 가도록 노출 (변경 이벤트는 디바운스됨)
    if (getMarkdownRef) getMarkdownRef.current = () => crepeRef.current?.getMarkdown() ?? defaultValue
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
    />
  )
}
