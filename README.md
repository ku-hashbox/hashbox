# Hashbox

링크로 `.env`·API 키·파일을 안전하게 전달하는 E2EE 웹 서비스.

내용은 브라우저에서 AES-256-GCM으로 암호화되고, 서버는 암호문만 보관한다. 복호화 열쇠는 링크의 `#` 뒷부분에만 있어 서버로 전송되지 않는다. 링크는 정해진 시간·횟수만 열린다.

## 구조

```
apps/
  web/        React + Vite → Cloudflare Pages
  api/        Cloudflare Workers + Hono, D1, R2
packages/
  shared/     프론트·백엔드 공용 상수, 타입, 유틸 (암호화 모듈 포함 예정)
```

## 시작하기

Node.js 22, pnpm 10 필요 (`corepack enable`로 pnpm 활성화).

```bash
pnpm install

# API (http://localhost:8787)
pnpm --filter @hashbox/api db:migrate:local
pnpm dev:api

# 웹 (http://localhost:5173)
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web
```

로컬 개발은 Cloudflare 계정 없이 동작한다 (D1·R2를 로컬에서 흉내 냄).

## 규칙

- 브랜치: `main`(배포) ← `dev`(통합) ← `feat/기능명`, `fix/내용`
- 커밋: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- PR은 `dev`로, 리뷰 1명 승인 + CI 통과 후 머지
- 프론트·백엔드가 같이 쓰는 값은 `packages/shared`에 둔다
- **공개 레포다. 실제 `.env`, API 키, Cloudflare 토큰은 절대 커밋하지 않는다.**

## 라이선스

MIT
