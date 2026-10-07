// 유튜브 주소 → { id, start } 로 해석. 유튜브 주소가 아니면 null.
//   지원: watch?v=, youtu.be/, shorts/, embed/, live/, m.youtube.com, music.youtube.com
const ID = /^[\w-]{11}$/

function parseStart(value) {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/) // 1h2m3s
  return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0
}

export function parseYouTube(text) {
  let url
  try {
    url = new URL(String(text).trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0]
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, rest] = url.pathname.split('/')
    if (kind === 'watch') id = url.searchParams.get('v')
    else if (['shorts', 'embed', 'live', 'v'].includes(kind)) id = rest
  }
  if (!id || !ID.test(id)) return null
  return { id, start: parseStart(url.searchParams.get('t') || url.searchParams.get('start')) }
}

export const isYouTubeUrl = (text) => !/\s/.test(String(text).trim()) && !!parseYouTube(text)

export const embedUrl = ({ id, start }) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ''}`
