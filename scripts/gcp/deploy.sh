#!/usr/bin/env bash
# WriteCoach → Cloud Run (서울) 배포. IAP로 본인 계정만 접근.
#
#   bash scripts/gcp/deploy.sh            # 배포
#   SETUP=1 bash scripts/gcp/deploy.sh    # 최초 1회: 실행 서비스 계정·권한·IAP 접근자까지 준비 후 배포
#                                         # (+ 푸시: vapid-private-key 비밀값, Cloud Scheduler 매시 실행)
#
# 푸시 알림(묵당의 저녁 종):
#   - VAPID 키는 로컬에서 1회 생성해 .env.local 에 둔다 (없을 때만 추가, 비공개 키는 출력하지 않음):
#       npx web-push generate-vapid-keys --json
#   - 비공개 키는 Secret Manager vapid-private-key (SETUP 때 없으면 .env.local 값으로 생성).
#   - 매 배포마다 Cloud Run Job writecoach-push 를 방금 배포한 서비스 이미지로 맞춘다
#     (node scripts/push-cron.mjs). 스케줄러 writecoach-push-hourly 가 매시 정각(Asia/Seoul) 실행.
#
# 원칙 (과거 다른 프로젝트에서 --set-secrets 로 운영 비밀값이 날아간 사고 재발 방지):
#   - --set-env-vars / --set-secrets 는 쓰지 않는다. 항상 --update-env-vars / --update-secrets.
#   - 로컬 값이 비어 있으면 그 변수는 아예 넘기지 않는다(운영 값을 빈 값으로 덮지 않음).
#
# NEXT_PUBLIC_SUPABASE_* 는 빌드 시점에 번들에 박힌다 → .env.local 에서 NEXT_PUBLIC_* 만 뽑아
# 임시 .env.production 을 만들고(Dockerfile 빌드 단계에서 next build 가 읽음) 끝나면 지운다.
# (anon 키는 원래 브라우저에 노출되는 공개 키다.)
set -euo pipefail

PROJECT="${PROJECT:-write-coach}"
REGION="${REGION:-asia-northeast3}"
SERVICE="${SERVICE:-writecoach}"
ACCOUNT="${ACCOUNT:-rlfjrl8518@gmail.com}"   # 이 PC의 gcloud 기본 계정은 회사 계정 → 항상 명시
RUN_SA="${RUN_SA:-writecoach-run@${PROJECT}.iam.gserviceaccount.com}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.8-flash}"
GCLOUD="${GCLOUD:-gcloud}"
SYNC_BUCKET="${SYNC_BUCKET:-write-coach-sync}"   # PC·모바일 동기화 저장소 (비공개, 버전 관리)

cd "$(dirname "$0")/../.."
G() { "$GCLOUD" --account="$ACCOUNT" --project="$PROJECT" "$@"; }
PUSH_JOB="${PUSH_JOB:-writecoach-push}"
PUSH_SCHED="${PUSH_SCHED:-writecoach-push-hourly}"
SCHED_SA="${SCHED_SA:-writecoach-scheduler@${PROJECT}.iam.gserviceaccount.com}"
VAPID_SECRET="${VAPID_SECRET:-vapid-private-key}"
SCHED_FLAGS=".push-schedule.flags.yaml"

# .env.local 에서 값 읽기 (출력하지 않음)
envval() { [ -f .env.local ] && grep -E "^$1=" .env.local | tail -1 | cut -d= -f2- | tr -d '\r' || true; }

if [ "${SETUP:-0}" = "1" ]; then
  echo "▶ 최초 설정: 서비스 계정·권한"
  G iam service-accounts describe "$RUN_SA" >/dev/null 2>&1 || \
    G iam service-accounts create "${RUN_SA%%@*}" --display-name=writecoach-cloud-run
  G projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$RUN_SA" --role=roles/aiplatform.user --condition=None >/dev/null
  G services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iap.googleapis.com aiplatform.googleapis.com
  echo "▶ 동기화 버킷: gs://$SYNC_BUCKET"
  G storage buckets describe "gs://$SYNC_BUCKET" >/dev/null 2>&1 ||     G storage buckets create "gs://$SYNC_BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
  G storage buckets update "gs://$SYNC_BUCKET" --versioning >/dev/null
  G storage buckets add-iam-policy-binding "gs://$SYNC_BUCKET"     --member="serviceAccount:$RUN_SA" --role=roles/storage.objectAdmin >/dev/null

  echo "▶ 푸시: Secret Manager · Cloud Scheduler"
  G services enable secretmanager.googleapis.com cloudscheduler.googleapis.com
  if ! G secrets describe "$VAPID_SECRET" >/dev/null 2>&1; then
    VAPID_PRIV="$(envval VAPID_PRIVATE_KEY)"
    if [ -n "$VAPID_PRIV" ]; then
      printf '%s' "$VAPID_PRIV" | G secrets create "$VAPID_SECRET" --replication-policy=automatic --data-file=- >/dev/null
      echo "  비밀값 $VAPID_SECRET 생성 (값은 출력하지 않음)"
    else
      echo "⚠ .env.local 에 VAPID_PRIVATE_KEY 없음 — npx web-push generate-vapid-keys --json 로 만든 뒤 다시 SETUP=1"
    fi
    unset VAPID_PRIV
  fi
  if G secrets describe "$VAPID_SECRET" >/dev/null 2>&1; then
    G secrets add-iam-policy-binding "$VAPID_SECRET" \
      --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor >/dev/null
  fi
fi

# scripts/ 는 업로드에서 빠진다 → 푸시 크론만 예외로 들어가 있어야 Dockerfile COPY 가 성공한다
if ! grep -qx '!scripts/push-cron.mjs' .gcloudignore 2>/dev/null || grep -qxE 'scripts/?' .gcloudignore; then
  echo "✖ .gcloudignore 에 푸시 크론 예외가 없습니다. 'scripts' 한 줄을 아래 두 줄로 바꿔 주세요:"
  echo "    scripts/*"
  echo "    !scripts/push-cron.mjs"
  exit 1
fi

# 1) 빌드용 공개 값 (.env.production, 배포 후 삭제)
SUPA_URL="$(envval NEXT_PUBLIC_SUPABASE_URL)"
SUPA_KEY="$(envval NEXT_PUBLIC_SUPABASE_ANON_KEY)"
if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  echo "⚠ NEXT_PUBLIC_SUPABASE_* 가 .env.local 에 없습니다 — 클라우드 동기화 없이 빌드됩니다."
fi
cleanup() { rm -f .env.production "$SCHED_FLAGS"; }
trap cleanup EXIT
{
  [ -n "$SUPA_URL" ] && echo "NEXT_PUBLIC_SUPABASE_URL=$SUPA_URL"
  [ -n "$SUPA_KEY" ] && echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPA_KEY"
  true
} > .env.production

# 2) 런타임 환경 변수 (비어 있지 않은 것만, update 방식)
ENV_VARS="GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=$GEMINI_MODEL,SYNC_BUCKET=$SYNC_BUCKET"
EXTRA=()
# KORDIC_API_KEY: Secret Manager 에 kordic-api-key 가 있으면 그걸, 없으면 로컬 값(있을 때만) 사용
if G secrets describe kordic-api-key >/dev/null 2>&1; then
  EXTRA+=(--update-secrets "KORDIC_API_KEY=kordic-api-key:latest")
else
  KORDIC="$(envval KORDIC_API_KEY)"
  if [ -n "$KORDIC" ]; then ENV_VARS="$ENV_VARS,KORDIC_API_KEY=$KORDIC"
  else echo "⚠ KORDIC_API_KEY 없음 — 운영 값을 건드리지 않습니다(우리말샘 사전은 기존 값 유지/미설정)."; fi
fi
# 푸시(VAPID): 공개 키는 env, 비공개 키는 비밀값. 로컬 공개 키가 비면 운영 값 유지.
VAPID_PUB="$(envval VAPID_PUBLIC_KEY)"
JOB_ENV="GOOGLE_CLOUD_PROJECT=$PROJECT,SYNC_BUCKET=$SYNC_BUCKET"
if [ -n "$VAPID_PUB" ]; then
  ENV_VARS="$ENV_VARS,VAPID_PUBLIC_KEY=$VAPID_PUB"
  JOB_ENV="$JOB_ENV,VAPID_PUBLIC_KEY=$VAPID_PUB"
else
  echo "⚠ VAPID_PUBLIC_KEY 없음 — 운영 값을 건드리지 않습니다."
fi
HAS_VAPID_SECRET=0
if G secrets describe "$VAPID_SECRET" >/dev/null 2>&1; then
  HAS_VAPID_SECRET=1
  EXTRA+=(--update-secrets "VAPID_PRIVATE_KEY=$VAPID_SECRET:latest")
else
  echo "⚠ 비밀값 $VAPID_SECRET 없음 — 푸시 발송은 꺼진 채 배포됩니다 (SETUP=1 로 생성)."
fi

echo "▶ Cloud Run 배포: $SERVICE ($PROJECT / $REGION)"
G run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --service-account "$RUN_SA" \
  --no-allow-unauthenticated \
  --iap \
  --update-env-vars "$ENV_VARS" \
  "${EXTRA[@]}" \
  --memory 1Gi --cpu 1 --min-instances 0 --max-instances 2 \
  --quiet

if [ "${SETUP:-0}" = "1" ]; then
  echo "▶ IAP 접근자: user:$ACCOUNT"
  G iap web add-iam-policy-binding --resource-type=cloud-run --service="$SERVICE" --region="$REGION" \
    --member="user:$ACCOUNT" --role=roles/iap.httpsResourceAccessor
fi

# 3) 푸시 크론 Job — 방금 배포된 서비스와 같은 이미지로 (매 배포마다 갱신)
if [ "$HAS_VAPID_SECRET" = "1" ]; then
  IMAGE="$(G run services describe "$SERVICE" --region "$REGION" --format='value(spec.template.spec.containers[0].image)' | tr -d '\r')"
  if [ -z "$IMAGE" ]; then
    echo "✖ 서비스 이미지를 찾지 못했습니다 — 푸시 Job 갱신 건너뜀"
  else
    echo "▶ 푸시 Job: $PUSH_JOB ← $IMAGE"
    G run jobs deploy "$PUSH_JOB" \
      --image "$IMAGE" \
      --region "$REGION" \
      --service-account "$RUN_SA" \
      --command node \
      --args scripts/push-cron.mjs \
      --update-env-vars "$JOB_ENV" \
      --update-secrets "VAPID_PRIVATE_KEY=$VAPID_SECRET:latest" \
      --max-retries 0 --task-timeout 300s --tasks 1 \
      --memory 512Mi --cpu 1 \
      --quiet
  fi

  if [ "${SETUP:-0}" = "1" ]; then
    echo "▶ 푸시 스케줄러: $PUSH_SCHED (매시 정각, Asia/Seoul)"
    G iam service-accounts describe "$SCHED_SA" >/dev/null 2>&1 || \
      G iam service-accounts create "${SCHED_SA%%@*}" --display-name=writecoach-push-scheduler
    G run jobs add-iam-policy-binding "$PUSH_JOB" --region "$REGION" \
      --member="serviceAccount:$SCHED_SA" --role=roles/run.invoker >/dev/null
    # 크론식엔 공백이 있어 Git Bash→gcloud.cmd 인용이 깨진다 → --flags-file(YAML)로 넘긴다
    printf '%s\n' '--schedule: "0 * * * *"' '--time-zone: Asia/Seoul' > "$SCHED_FLAGS"
    RUN_URI="https://run.googleapis.com/v2/projects/$PROJECT/locations/$REGION/jobs/$PUSH_JOB:run"
    if G scheduler jobs describe "$PUSH_SCHED" --location "$REGION" >/dev/null 2>&1; then VERB=update; else VERB=create; fi
    G scheduler jobs "$VERB" http "$PUSH_SCHED" \
      --location "$REGION" \
      --flags-file="$SCHED_FLAGS" \
      --uri "$RUN_URI" \
      --http-method POST \
      --oauth-service-account-email "$SCHED_SA" \
      --oauth-token-scope https://www.googleapis.com/auth/cloud-platform \
      --quiet
    rm -f "$SCHED_FLAGS"
  fi
else
  echo "⚠ 푸시 Job/스케줄러 건너뜀 (비밀값 $VAPID_SECRET 없음)"
fi

cat <<'NOTE'
✔ 배포 완료. 개인(조직 없는) 프로젝트라 IAP OAuth 클라이언트는 콘솔에서 1회 설정해야 접속된다:
  1) Google 인증 플랫폼 → 브랜딩: 앱 이름 'WriteCoach', 대상 '외부', 테스트 사용자에 본인 계정 추가
  2) 클라이언트 → 웹 애플리케이션 생성 → 리디렉션 URI
     https://iap.googleapis.com/v1/oauth/clientIds/<클라이언트ID>:handleRedirect
  3) gcloud iap settings set <yaml> --resource-type=cloud-run --service=writecoach --region=asia-northeast3
     (yaml: access_settings.oauth_settings.client_id / client_secret — 비밀값은 커밋 금지)
  Supabase 로그인을 쓰면 Supabase 대시보드 Auth → URL 설정에 Cloud Run URL도 추가.
NOTE
