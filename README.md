# ✦ WriteCoach — 설치 및 배포 가이드

별헤는 밤 테마의 글쓰기 AI 코칭 앱. 매일 글을 쓰고, AI가 분석·첨삭해주고, 문장/카피/표현을 수집하며 성장 기록을 쌓는다.

## 로컬 실행

```bash
cd writecoach
npm install
npm run dev
# → http://localhost:3000
```

## Vercel 배포

```bash
npm i -g vercel
vercel          # 프리뷰 배포
vercel --prod   # 프로덕션 반영
```

## 첫 실행 후 할 일

1. `/settings`에서 OpenAI(또는 Gemini) API 키 입력 → 저장 (BYOK 구조, 서버는 키를 보관하지 않음)
2. 필요하면 로그인해서 클라우드 동기화 켜기 (`/login` → Supabase 계정)
3. `/writing`에서 글 작성 시작

## 페이지 구성

| 경로 | 기능 |
|---|---|
| `/` | 홈 — 오늘의 기록, 거북이 성장 요약 |
| `/writing` | 글 작성 + AI 분석·첨삭·이의신청(재심) |
| `/expressions` | 표현 사전 — 단어/표현 검색·학습·즐겨찾기 |
| `/sentence` | 문장 수집 — 좋은 문장 저장 및 AI 구조 분석 |
| `/copy` | 카피 수집 — 광고 카피 저장 및 설득 구조 분석 |
| `/training` | 미션 기반 글쓰기 훈련 |
| `/books` | 독서 기록 — 책별 진행 메모 |
| `/calendar` | 월별 작성 기록 캘린더 뷰 |
| `/journey` | 거북이 성장(스트릭·뱃지) |
| `/report` | 월간 리포트 자동 생성 |
| `/guide` | 사용 가이드 |
| `/login` | Supabase 로그인 (클라우드 동기화용) |
| `/settings` | API 키·모델·백업(JSON 내보내기/가져오기)·데이터 관리 |

## 데이터 저장 구조

- 기본은 브라우저 `localStorage`에 전부 저장 (로그인 없이도 전부 동작)
- 로그인 시 Supabase에 백업되고, 기기 간 동기화됨 (`lib/supabase.ts`의 `mergeDBs`가 ID 단위로 병합, 삭제는 tombstone으로 추적)
- `/settings`에서 JSON 내보내기/가져오기로 수동 백업 가능

## 비용 참고

- Vercel: 무료 플랜으로 충분
- OpenAI 분석 비용은 사용자 본인 API 키로 직접 과금됨 (모델/사용량에 따라 변동)
