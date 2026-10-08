// 인공언어용 특수문자를 로마자 두 글자로 입력하는 규칙 (kh=x, gh=ř, th=θ, dh=ð, sh=š, dg=ĝ, lh=ł, ch=č).
// 대소문자 구분 없이 인식하고, 첫 글자가 대문자면(Ch, CH) 결과도 대문자(Č), 소문자면 소문자(č)로 만든다.
export const DIGRAPH_MAP = { kh: 'x', gh: 'ř', th: 'θ', dh: 'ð', sh: 'š', dg: 'ĝ', lh: 'ł', ch: 'č' }
export const DIGRAPH_END = new RegExp(`(?:${Object.keys(DIGRAPH_MAP).join('|')})$`, 'i')

export function digraphReplacement(pair) {
  const base = DIGRAPH_MAP[pair.toLowerCase()]
  if (!base) return null
  if (pair[0] === pair[0].toLowerCase()) return base
  const upper = base.toUpperCase()
  return upper !== base ? upper : base
}
