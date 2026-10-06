import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import { insert } from '@milkdown/utils'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { api } from '../api.js'

async function uploadImage(file) {
  const { url } = await api.upload(file)
  return url
}

// 노션처럼 입력 즉시 서식이 적용되는 WYSIWYG 에디터. 저장 형식은 마크다운 그대로.
//   - 마크다운 단축 입력: "# ", "- ", "> ", "```", **굵게** 등
//   - "/" 로 블록 메뉴, 블록 왼쪽 핸들로 이동/추가
// defaultValue 는 최초 마운트 시에만 사용합니다. 값이 바뀌면 key 로 다시 마운트하세요.
export default function RichEditor({ defaultValue, getMarkdownRef, onError }) {
  const rootRef = useRef(null)
  const crepeRef = useRef(null)

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
      onPasteCapture={(e) => handleFiles(e, e.clipboardData.files)}
      onDropCapture={(e) => handleFiles(e, e.dataTransfer.files)}
    />
  )
}
