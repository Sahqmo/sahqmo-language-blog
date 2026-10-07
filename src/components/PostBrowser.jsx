import { forwardRef, useMemo, useState } from 'react'
import Reveal from './Reveal.jsx'
import PostCard from './PostCard.jsx'
import { UNCATEGORIZED } from './CategoryDonut.jsx'

// 카테고리 칩 + 검색 + 글 카드 목록 (메인 하단 '최근 게시된 글'과 글 목록 페이지가 함께 사용)
//   limit: 필터/검색이 없을 때 보여줄 최대 개수 (생략하면 전부)
const PostBrowser = forwardRef(function PostBrowser({ posts, cats, category, onCategory, title, limit }, ref) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return posts.filter(
      (p) =>
        (!category || (p.category || UNCATEGORIZED) === category) &&
        (!q || [p.title, p.excerpt, p.category, ...p.tags].some((s) => (s || '').toLowerCase().includes(q))),
    )
  }, [posts, query, category])

  const shown = limit && !category && !query ? filtered.slice(0, limit) : filtered

  return (
    <section className="block list-section" id="recent" ref={ref}>
      <h3 className="section-title">{category ? `${category} 글` : title}</h3>
      <div className="filters">
        <button className={`chip ${!category ? 'on' : ''}`} onClick={() => onCategory('')}>전체</button>
        {cats.map((c) => (
          <button key={c.name} className={`chip ${category === c.name ? 'on' : ''}`} onClick={() => onCategory(c.name)}>
            {c.name}
          </button>
        ))}
      </div>
      <input
        className="search"
        type="search"
        placeholder="제목, 내용, 태그 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="state">{posts.length ? '해당하는 글이 없어요.' : '아직 작성된 글이 없어요.'}</p>
      ) : (
        <ul className="post-list">
          {shown.map((p, i) => (
            <Reveal as="li" key={p.id} delay={(i % 4) * 60}><PostCard p={p} /></Reveal>
          ))}
        </ul>
      )}
    </section>
  )
})

export default PostBrowser
