#!/usr/bin/env bash
# WriteCoach → Cloud Run (서울) 배포. IAP로 본인 계정만 접근.
#
#   bash scripts/gcp/deploy.sh            # 배포
#   SETUP=1 bash scripts/gcp/deploy.sh    # 최초 1회: 실행 서비스 계정·권한·IAP 접근자까지 준비 후 배포
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

cd "$(dirname "$0")/../.."
G() { "$GCLOUD" --account="$ACCOUNT" --project="$PROJECT" "$@"; }

# .env.local 에서 값 읽기 (출력하지 않음)
envval() { [ -f .env.local ] && grep -E "^$1=" .env.local | tail -1 | cut -d= -f2- | tr -d '\r' || true; }

if [ "${SETUP:-0}" = "1" ]; then
  echo "▶ 최초 설정: 서비스 계정·권한"
  G iam service-accounts describe "$RUN_SA" >/dev/null 2>&1 || \
    G iam service-accounts create "${RUN_SA%%@*}" --display-name="WriteCoach Cloud Run"
  G projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$RUN_SA" --role=roles/aiplatform.user --condition=None >/dev/null
  G services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iap.googleapis.com aiplatform.googleapis.com
fi

# 1) 빌드용 공개 값 (.env.production, 배포 후 삭제)
SUPA_URL="$(envval NEXT_PUBLIC_SUPABASE_URL)"
SUPA_KEY="$(envval NEXT_PUBLIC_SUPABASE_ANON_KEY)"
if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  echo "⚠ NEXT_PUBLIC_SUPABASE_* 가 .env.local 에 없습니다 — 클라우드 동기화 없이 빌드됩니다."
fi
cleanup() { rm -f .env.production; }
trap cleanup EXIT
{
  [ -n "$SUPA_URL" ] && echo "NEXT_PUBLIC_SUPABASE_URL=$SUPA_URL"
  [ -n "$SUPA_KEY" ] && echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPA_KEY"
  true
} > .env.production

# 2) 런타임 환경 변수 (비어 있지 않은 것만, update 방식)
ENV_VARS="GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=$GEMINI_MODEL"
EXTRA=()
# KORDIC_API_KEY: Secret Manager 에 kordic-api-key 가 있으면 그걸, 없으면 로컬 값(있을 때만) 사용
if G secrets describe kordic-api-key >/dev/null 2>&1; then
  EXTRA+=(--update-secrets "KORDIC_API_KEY=kordic-api-key:latest")
else
  KORDIC="$(envval KORDIC_API_KEY)"
  if [ -n "$KORDIC" ]; then ENV_VARS="$ENV_VARS,KORDIC_API_KEY=$KORDIC"
  else echo "⚠ KORDIC_API_KEY 없음 — 운영 값을 건드리지 않습니다(우리말샘 사전은 기존 값 유지/미설정)."; fi
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

cat <<'NOTE'
✔ 배포 완료. 개인(조직 없는) 프로젝트라 IAP OAuth 클라이언트는 콘솔에서 1회 설정해야 접속된다:
  1) Google 인증 플랫폼 → 브랜딩: 앱 이름 'WriteCoach', 대상 '외부', 테스트 사용자에 본인 계정 추가
  2) 클라이언트 → 웹 애플리케이션 생성 → 리디렉션 URI
     https://iap.googleapis.com/v1/oauth/clientIds/<클라이언트ID>:handleRedirect
  3) gcloud iap settings set <yaml> --resource-type=cloud-run --service=writecoach --region=asia-northeast3
     (yaml: access_settings.oauth_settings.client_id / client_secret — 비밀값은 커밋 금지)
  Supabase 로그인을 쓰면 Supabase 대시보드 Auth → URL 설정에 Cloud Run URL도 추가.
NOTE
