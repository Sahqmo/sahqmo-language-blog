# Sahqmo · 언어학 노트

React(Vite) 기반 개인 블로그. 글 작성/수정/삭제, 마크다운 에디터(실시간 미리보기), 이미지 업로드를 지원합니다.

```
npm install
npm run dev     # http://localhost:5173
```

## 저장 위치
- `content/posts/<slug>.md` — 글 (상단 frontmatter: title, date, updated, tags + 마크다운 본문)
- `content/images/` — 에디터에 붙여넣기/드래그한 이미지

저장 API는 `server/blogApi.js`(Vite 미들웨어)가 담당하므로 `npm run dev`(또는 `npm run build && npm run preview`)로 실행해야 글 저장이 동작합니다. 로컬 전용이며 인증은 없습니다.

## 실행 / 로그인
- `start-server.bat` 더블클릭 → 의존성 설치(최초 1회) 후 개발 서버 실행, 브라우저 자동 열림. 코드를 수정하면 자동 반영됩니다(서버 코드 수정 시 서버 자동 재시작 + 페이지 새로고침).
- 처음 접속해 `로그인`을 누르면 관리자 비밀번호 설정 화면이 나옵니다. 이후 로그인한 상태에서만 글 작성/수정/삭제/업로드가 가능하고, 글 읽기는 누구나 가능합니다.
- 비밀번호 해시는 `data/auth.json`에 저장됩니다. 비밀번호를 잊었다면 이 파일을 삭제하고 다시 설정하세요.
