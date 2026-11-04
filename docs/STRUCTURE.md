# 폴더 구조와 담당

설계 문서: Notion 「Hashbox 개발 기획서」. 각 파일의 `TODO(담당)` 주석이 할 일이다.

## apps/web — 프론트

| 경로                    | 내용                                                        | 담당                       |
| ----------------------- | ----------------------------------------------------------- | -------------------------- |
| `src/app/`              | 라우터, 레이아웃, 전역 스타일                               | FE2                        |
| `src/features/send/`    | 보내기 화면, 옵션, 완료 화면, `useSend`                     | FE1                        |
| `src/features/env/`     | .env 키 목록·선택 UI                                        | FE1                        |
| `src/features/receive/` | 받기 화면, 상태별 화면, 텍스트·.env·파일 보기, `useReceive` | FE2                        |
| `src/features/manage/`  | 관리 화면                                                   | FE1                        |
| `src/components/`       | 공통 UI (Button, CopyButton, Notice)                        | FE2                        |
| `src/lib/api.ts`        | API 호출 함수                                               | 보내기·관리 FE1 / 받기 FE2 |
| `src/lib/fragment.ts`   | # 뒷부분 읽고 지우기                                        | 완료                       |
| `src/lib/format.ts`     | 크기·시간 표시, 링크 조립                                   | FE1                        |
| `public/_headers`       | CSP 등 보안 헤더                                            | 인프라                     |

## apps/api — 백엔드

| 경로            | 내용                                                 | 담당   |
| --------------- | ---------------------------------------------------- | ------ |
| `src/routes/`   | 엔드포인트. 요청·응답 변환만                         | BE     |
| `src/services/` | 규칙: 생성, 업로드, 원자적 차감, 비밀번호 잠금, 파기 | BE     |
| `src/db/`       | SQL 모음, 행 타입                                    | BE     |
| `src/storage/`  | R2 읽기·쓰기·삭제                                    | BE     |
| `src/cron/`     | 만료 정리                                            | BE     |
| `src/lib/`      | 오류 응답, 입력 검증, 토큰·해시                      | BE     |
| `migrations/`   | D1 스키마                                            | BE     |
| `wrangler.toml` | Cloudflare 설정                                      | 인프라 |

## packages/shared — 공용

| 경로               | 내용                         | 담당                       |
| ------------------ | ---------------------------- | -------------------------- |
| `src/crypto/`      | 암호화·복호화, 키 유도, 포맷 | 보안                       |
| `src/env-parser/`  | .env 파싱·직렬화             | 보안 (또는 FE1)            |
| `src/constants.ts` | 선택지, 크기 제한            | 변경 시 전원 공유          |
| `src/types.ts`     | API 요청·응답 타입           | BE가 관리, 변경 시 FE 공유 |

## 규칙

- 다른 사람 담당 폴더를 고쳐야 하면 PR에서 그 사람을 리뷰어로 지정한다.
- `packages/shared`를 바꾸면 프론트·백엔드 둘 다 영향을 받는다. PR 설명에 적는다.
- 구현하면서 함수 이름이나 인자를 바꿔도 된다. 대신 개발 기획서도 같이 고친다.
