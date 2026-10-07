import { forwardRef, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from './Reveal.jsx'
import PostCard from './PostCard.jsx'
import { UNCATEGORIZED } from './CategoryDonut.jsx'

// 카테고리 칩 + 검색 + 글 카드 목록 (메인 하단 '최근 게시된 글'과 글 목록 페이지가 함께 사용)
//   limit: 보여줄 최대 개수 (필터/검색 결과에도 적용, 생략하면 전부)
//   moreTo: 목록 아래에 '전체 글 보기' 링크를 걸 주소 (limit 로 잘렸을 때 쓰면 좋음)
//   paging: { size, sizes, page, onSize, onPage } 를 넘기면 한 페이지 글 개수 선택과 페이지 이동이 생김 (필터/검색 결과에도 적용)
const PostBrowser = forwardRef(function PostBrowser({ posts, cats, category, onCategory, title, limit, paging, moreTo }, ref) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return posts.filter(
      (p) =>
        (!category || (p.category || UNCATEGORIZED) === category) &&
        (!q || [p.title, p.excerpt, p.category, ...p.tags].some((s) => (s || '').toLowerCase().includes(q))),
    )
  }, [posts, query, category])

  const pages = paging ? Math.max(1, Math.ceil(filtered.length / paging.size)) : 1
  const page = paging ? Math.min(paging.page, pages) : 1
  const shown = paging
    ? filtered.slice((page - 1) * paging.size, page * paging.size)
    : limit
      ? filtered.slice(0, limit)
      : filtered

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
        onChange={(e) => {
          setQuery(e.target.value)
          paging?.onPage(1)
        }}
      />
      {paging && (
        <label className="page-size">
          <span>한 페이지에</span>
          <select value={paging.size} onChange={(e) => paging.onSize(Number(e.target.value))}>
            {paging.sizes.map((n) => (
              <option key={n} value={n}>{n}개</option>
            ))}
          </select>
          <span className="page-size-total">총 {filtered.length}개</span>
        </label>
      )}
      {filtered.length === 0 ? (
        <p className="state">{posts.length ? '해당하는 글이 없어요.' : '아직 작성된 글이 없어요.'}</p>
      ) : (
        <ul className="post-list">
          {shown.map((p) => (
            <Reveal as="li" key={p.id}><PostCard p={p} /></Reveal>
          ))}
        </ul>
      )}
      {moreTo && (
        <Link className="more-link" to={moreTo}>전체 글 보기 <span aria-hidden="true">→</span></Link>
      )}
      {paging && pages > 1 && (
        <nav className="pager" aria-label="페이지 이동">
          <button className="chip" disabled={page <= 1} onClick={() => paging.onPage(page - 1)}>이전</button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
            .map((n, i, arr) => (
              <span key={n} className="pager-item">
                {i > 0 && n - arr[i - 1] > 1 && <span className="pager-gap">…</span>}
                <button className={`chip ${n === page ? 'on' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => paging.onPage(n)}>{n}</button>
              </span>
            ))}
          <button className="chip" disabled={page >= pages} onClick={() => paging.onPage(page + 1)}>다음</button>
        </nav>
      )}
    </section>
  )
})

export default PostBrowser
