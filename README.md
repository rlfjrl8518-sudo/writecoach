# ✦ WriteCoach — 설치 및 배포 가이드

별헤는 밤 테마의 글쓰기 AI 코칭 앱. 매일 글을 쓰고, AI가 분석·첨삭해주고, 문장/카피/표현을 수집하며 성장 기록을 쌓는다.

## 로컬 실행

```bash
cd writecoach
npm install
npm run dev
# → http://localhost:3000
```

`.env.local`은 커밋하지 않는다. 변수 이름은 `.env.example` 참고.

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY   # 클라우드 동기화(빌드 시점에 필요)
KORDIC_API_KEY                                             # 우리말샘 사전(서버 전용)
GOOGLE_CLOUD_PROJECT=write-coach                           # 서버 AI(Vertex)
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-3.8-flash
```

로컬 AI 인증은 ADC: `gcloud auth application-default login` (계정 rlfjrl8518@gmail.com).

## AI 구조

- **기본: 서버 GCP Vertex AI(Gemini 3.x)** — 사용자는 API 키가 필요 없다. 브라우저 → `POST /api/ai` → `lib/vertex.ts`(`@google/genai`, ADC/서비스 계정).
  - 요청 `{system, user, maxTokens?, temperature?, json?, schema?, imageUrl?, stream?, model?}`
  - 응답: 일반 `{text}` / `stream:true`면 텍스트 델타 plain 스트림 / 오류 `{error}` (503 `AI_OFF` = 서버 AI 미설정, 429 한도, 413 너무 큼)
  - 사고(thinking) 토큰 때문에 JSON이 잘리지 않게 thinkingLevel LOW + 출력 토큰 여유분 2000.
  - IP(또는 IAP 사용자)당 5분 60회 인메모리 제한, 본문 200KB 제한.
- 이 계정의 Vertex는 **Gemini 2.5가 404**라 3.x만 쓴다: `gemini-3.8-flash`(기본), `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`.
- 선택: `/settings`에서 OpenAI·Gemini 개인 키(BYOK)로 바꿀 수 있다(`/api/openai`, `/api/gemini` 프록시, 키는 브라우저에만 저장).
- 설정 저장본에 `settingsVersion`이 생겼다. 예전 저장본(provider `openai`)은 처음 열 때 한 번 `gcp`로 바뀐다(키는 그대로 남음). 키 확인은 `aiReady(settings)`.

## 배포 (Cloud Run + IAP)

`output: 'standalone'` + `Dockerfile`(node 22 alpine, PORT 8080). 서울 리전, IAP로 본인 계정만 접근.

```bash
SETUP=1 bash scripts/gcp/deploy.sh   # 최초 1회: 실행 서비스 계정(aiplatform.user)·IAP 접근자 준비 + 배포
bash scripts/gcp/deploy.sh           # 재배포
```

- `NEXT_PUBLIC_SUPABASE_*`는 빌드 시점 값이라 스크립트가 `.env.local`에서 그 둘만 뽑아 임시 `.env.production`을 만들고 끝나면 지운다.
- 런타임 변수는 `--update-env-vars`/`--update-secrets`만 쓴다(`--set-*` 금지, 빈 로컬 값으로 운영 값을 덮지 않음). `KORDIC_API_KEY`는 Secret Manager `kordic-api-key`가 있으면 그걸 쓴다.
- IAP OAuth 클라이언트는 콘솔에서 1회 설정해야 한다(스크립트 끝 안내 참고, chunil-lab README §10과 같은 절차). Supabase 로그인을 쓰면 Supabase Auth URL 설정에 Cloud Run URL 추가.
- 이 PC의 gcloud 기본 계정은 회사 계정이라 스크립트가 `--account=rlfjrl8518@gmail.com`을 붙인다.
- (예전 Vercel 배포도 그대로 가능하지만 서버 AI를 쓰려면 GCP 인증 설정이 따로 필요하다.)

## 첫 실행 후 할 일

1. 바로 쓰면 된다 — 기본 AI는 서버 GCP Vertex AI라 키 입력이 필요 없다. 원하면 `/settings`에서 모델을 고르거나 개인 OpenAI/Gemini 키로 바꾼다.
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
| `/settings` | AI 공급자(GCP 기본/BYOK)·모델·백업(JSON 내보내기/가져오기)·데이터 관리 |

## 데이터 저장 구조

- 기본은 브라우저 `localStorage`에 전부 저장 (로그인 없이도 전부 동작)
- 로그인 시 Supabase에 백업되고, 기기 간 동기화됨 (`lib/supabase.ts`의 `mergeDBs`가 ID 단위로 병합, 삭제는 tombstone으로 추적)
- `/settings`에서 JSON 내보내기/가져오기로 수동 백업 가능

## 비용 참고

- 기본 AI 비용은 GCP 프로젝트 `write-coach`(Vertex AI)로 과금된다. Cloud Run은 min-instances 0이라 쓰지 않으면 거의 0원.
- BYOK를 고르면 OpenAI/Gemini 비용은 사용자 본인 키로 과금된다.

## 게임: 산마루 서재 수련기 (2026-11-01)

거북이 성장 시스템을 걷어내고, 초기 기획(노작가에게 배우는 제자)으로 되돌려 픽셀 RPG로 만들었다.

- **세계관**: 산마루 서재의 노작가 '묵당 선생'(가상 인물)의 문하생이 된다. 쓰지 않은 날은 '백지 안개'로 지워지고, 매일의 글이 '먹'이 되어 안개를 걷는다.
- **이야기** (`lib/story.ts`): 1년 = 4막 16장. 계절마다 서재의 책 속 작가가 걸어 나와 가르친다.
  - 첫해: 윤동주(습관) → 체호프(관찰) → 헤밍웨이(퇴고·간결) → 울프(자기 목소리)
  - 둘째 해: 연암 박지원(표현) → 김유정(입말·이야기) → 오웰(명료·논리) → 이상(형식 실험)
  - 셋째 해부터는 '심화' 회차로, 요구량과 시련 기준이 오른다.
  - 세상을 떠난 작가만 등장시킨다. 인물 소개는 널리 알려진 사실만 적고, 대사는 게임 속 인물의 말로 새로 쓴다.
- **시련**: 막마다 글쓰기 약점이 요괴로 나온다(미루기·추상어·군더더기·완벽주의…). 주제에 맞춰 글을 쓰면 AI 분석 점수로 판정한다(`/story/trial`).
  - 채점이 엄격해서(괜찮은 수필이 40점대, 항목 5점이 평균) 기준은 항목 6점, 종합 40~62점으로 맞췄다.
- **게임 로직** (`lib/game.ts`): 먹(경험치)·등급(견습 글꾼~대가, Lv.60)·오늘의 숙제 3개·주간 요괴(가장 약한 항목, 내 평균보다 1점 위가 목표)·인장 22종.
  - 전부 저장된 기록에서 파생 계산한다. 따로 저장하는 건 `db.game`(이름·해·본 장면·시련 기록)과 `db.drillLogs`뿐이고, `mergeDBs`에서 병합한다.
- **화면**: `/` 서재 허브, `/story` 이야기, `/story/trial` 시련, `/journey` 수련 기록.
  - `components/game/*`: 장면 재생기, 알림·레벨업, 서재 그림
  - `components/pixel/*`: 16×16 스프라이트 생성기
- **디자인**: design-isms Pixel Art UI.
  - `app/pixel.css`가 globals.css를 덮는다. 계단식 테두리, 곡선 없음, Galmuri11/14 폰트.
  - 테마는 기본 밤(먹)이고, 낮(한지)도 쓸 수 있다.
