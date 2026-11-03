# 백지첩 (WriteCoach) — 설치 및 배포 가이드

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

## 컨셉: 『백지첩』 24수 — 묵당 선생의 문장 수련 (2026-11-02 개편)

글쓰기 습관과 실력을 기르는 데만 집중하도록 기능을 정리했다. 독서 기록만 그대로 두고 나머지는 다시 짰다.

- **이야기**: 노작가 묵당(가상 인물 한 명)이 평생 모은 문장 기법 24가지를 『백지첩』에 적었다. 그가 펜을 놓자 책장이 하얗게 지워졌다. 제자가 한 수를 익힐 때마다 한 장이 되살아난다. 쓰지 않은 날이 쌓이면 '백지 안개'가 낀다.
- **배우는 것** (`lib/curriculum.ts`): 6장 × 4수. 장마다 AI 채점 항목 하나를 기른다.
  - 보는 눈(구체성) → 보여주기(표현력) → 동사의 힘(전달력) → 덜어내기(가독성) → 흐름(논리성) → 한 줄(종합)
  - 각 수에 들어 있는 것: 가르침, 전/후 예시, 워밍업 문장, 사진 훈련(이미지 생성 지시 포함), 짧은 글 주제
- **매일 하는 것** (`/practice`): 오늘의 수련 10~15분.
  - 순서: 가르침 → 워밍업(고쳐 쓰기, 또는 모은 문장·서고 인용문으로 필사 변주) → 사진 훈련 → 짧은 글
  - 짧은 글 주제는 셋 중 하나: 오늘의 수 주제 / 오늘의 질문 / 글감 낱말 3개
  - 세 단계를 마치면 그 수를 익힌 것으로 친다.
- **시련** (`/practice/trial`): 한 장의 네 수를 익히면 그 장의 약점이 요괴로 나온다. 해당 항목 점수로 판정한다.
  - 1회차 기준은 항목 6점, 마지막 장 종합 58점. 회차가 오를수록 높아진다.
  - 채점이 엄격하다(5점이 평균, 괜찮은 수필이 40점대).
- **지표는 둘**: 등불(연속 수련일)과 백지첩(익힌 수 / 24). 장을 마칠 때마다 칭호(호)가 바뀐다. 24수를 마치면 다음 회차로 넘어간다.
- **오래 가는 장치**: 묵당의 주간 편지(한 주의 글을 AI가 첨삭), 매일 푸시 알림, 나의 문집(`/writing/book`, PDF 저장), 모바일용 문장부호 입력 막대.
- **화면 구성**
  - 서재(`/`): 오늘의 수련 버튼 하나
  - 수련(`/practice`): 수련 4단계, 백지첩 목차, 보충 과제(옛 AI 맞춤 과제)
  - 글방(`/writing`): 자유 글쓰기, 분석, 첨삭, 문집
  - 서고(`/books`): 그대로 유지
  - 기록(`/journey`): 백지첩, 주간 편지, 성장 리포트, 달력
  - 옛 `/training /story /sentence /copy /expressions`는 `/practice`로 리디렉트한다. 기존 데이터는 그대로 두고 워밍업 재료로 쓴다.
- **훈련 이미지** (`lib/imageGen.ts`, `/api/image`): Vertex `gemini-2.5-flash-image`로 생성한다.
  - 이 프로젝트에서는 Imagen과 3.x 이미지 모델이 404를 낸다.
  - 프롬프트는 서버가 각 수의 `drill.image`로 만든다. 그 훈련에 필요한 요소가 반드시 보이게 하고, 글자는 넣지 않는다.
  - 결과는 webp로 바꿔 `gs://write-coach-sync/images/`에 캐시한다. 한 장 생성에 약 8~10초가 걸리고, 다음 변형은 미리 만들어 둔다.
- **게임 로직** (`lib/game.ts`): 모든 값은 저장된 기록에서 다시 계산한다.
  - 따로 저장하는 상태는 `db.game`(이름, 회차, 본 장면, 시련 기록, 주간 편지)과 `drillLogs`(su·step)뿐이다.

## 화풍 개편: 한지·먹의 산마루 서재 (2026-11-03)

픽셀 UI를 버리고 손그림 수채 애니메이션 화풍(한지 바탕, 먹색 글씨, 인주 포인트)으로 바꿨다. 게임 요소는 레퍼런스(스타듀 번들, 동물의 숲 실제 시계, Hades의 "알아봐 주는" 대사, Spiritfarer의 작별, 슬레이 더 스파이어의 의도 표시, Duolingo 스트릭 프리즈, 네코 아츠메의 방문 동물, Kind Words 편지)를 백지첩 한 줄기에 묶어 넣었다.

- **그림**: 전부 Vertex `gemini-2.5-flash-image`로 미리 만들어 `public/art/*.webp`에 넣는다. 목록은 `scripts/art/manifest.mjs`.
  - 생성: `node scripts/art/generate.mjs [접두어...]` (있는 건 건너뜀, `--force`로 다시). 원본 PNG는 `art-src/`(git 제외).
  - 인물·요괴·소품은 흰 배경을 flood fill로 투명하게 딴다. 표정 그림은 기본 그림을 참고 이미지로 넣어 같은 인물로 유지한다.
  - 배경은 종이 여백을 잘라 낸다(`scripts/art/reprocess.mjs`). 한도(429)가 잦으면 `ART_LOCATION=us-central1` 등 리전을 나눠 돌린다.
- **살아 있는 서재** (`components/game/LivingStudy.tsx`): 실제 계절 4 × 시간대 3의 서재 그림. 쉰 날만큼 창밖 안개가 짙어지고, 오늘 쓰면 등불이 켜진다. 계절 입자(꽃잎·반딧불·낙엽·눈), 기억이 열릴 때마다 놓이는 물건, 고양이 '먹물'(눌러 보면 오늘의 낱말을 물어 온다).
- **묵당의 한마디** (`app/page.tsx`): 최근 글의 사실(문장 평균 길이 변화, 가장 좋았던 항목)을 짚어 말한다. 누르면 다음 말(절기 인사 등).
- **장면** (`components/game/ScenePlayer.tsx`): 비주얼노벨 방식. 배경 그림, 표정 있는 스탠딩, 기록·자동·창 숨기기·건너뛰기. 프롤로그에서 제자의 모습(두 가지)과 이름을 고른다.
- **시련**: 요괴의 '의도'(무엇을 노리는지)를 쓰기 전에 보여 준다. 채점 뒤 항목마다 한 번씩 타격이 들어가고(그 장의 항목은 급소), 판정 도장(妙·好·可·霧)을 찍는다. 이기면 요괴를 '놓아 보내고' 종이가 흩어진다.
- **장기 이야기** (`lib/story.ts`)
  - 묵당의 기억 20편: 수련한 날 1·3·5·7·14·21·30…365일에 열린다. 옛 제자 서하, 뜯지 않은 편지, 다시 쓰기 시작하는 묵당, 1년째 스물다섯 번째 수.
  - 24절기: 실제 날짜의 절기마다 묵당의 인사와 절기 글감(짧은 글에서 고를 수 있음).
  - 서재의 물건 13가지: 기억과 함께 놓인다(기록 → 기억첩에서 모아 보기).
- **먹 한 방울** (`lib/game.ts` `streakInfo`): 한 주에 3일 수련하면 한 방울(최대 2). 하루 거른 날을 메워 등불이 이어진다. 기록에서 계산하므로 동기화할 상태가 없다.
- **편지 답장**: 주간 편지에 답장을 쓰면 글로 남고, 다음 편지가 그 답장을 인용한다.
- **산마루 지도** (`/journey`): 6장이 산길 여섯 구역. 지도 위에 제자가 서 있다.
- 짧은 글에 "지난번 이 수에서 쓴 글"이 함께 나온다(회차 반복 때 성장 비교).

## 푸시 알림: 묵당의 저녁 종

정한 시각(한국 시간)까지 그날 글·드릴 기록이 없으면 묵당 선생이 푸시 한 통을 보낸다. 쓴 날은 조용하다.

- **켜기**: `/settings` → "묵당의 저녁 종" (`components/PushOptIn.tsx`). iOS는 "홈 화면에 추가"로 설치한 앱에서만 된다(16.4+). `next dev`에선 서비스 워커가 꺼져 있어 동작하지 않는다.
- **서버**: `/api/push/key`·`/api/push/subscribe`(GET/POST/DELETE)·`/api/push/test`. 설정은 `gs://write-coach-sync/push/<sha256(email)[:32]>.json`.
- **서비스 워커**: `worker/index.js` (next-pwa `customWorkerDir`) — push 수신, 클릭 시 `/practice` 열기.
- **발송**: Cloud Run Job `writecoach-push`(`node scripts/push-cron.mjs`, 서비스와 같은 이미지)를 Cloud Scheduler `writecoach-push-hourly`가 매시 정각 실행. 연속 수련 2일 이상이면 "등불이 n일째…" 문구.
- **키**: VAPID 공개 키는 env, 비공개 키는 Secret Manager `vapid-private-key`. 최초 1회 `SETUP=1 bash scripts/gcp/deploy.sh`.
- **점검**: `SYNC_BUCKET=write-coach-sync node scripts/push-cron.mjs --dry-run [--force-hour 21]` (보내지 않고 대상만 출력).
