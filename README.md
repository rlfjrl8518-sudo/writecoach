# ✦ WriteCoach — 설치 및 배포 가이드

## 로컬 실행 (Claude Code에서)

```bash
cd writecoach
npm install
npm run dev
# → http://localhost:3000
```

## Vercel 무료 배포 (폰에서도 접근 가능)

```bash
# 1. Vercel CLI 설치
npm i -g vercel

# 2. 배포
vercel

# 3. 이후 수정사항 반영
vercel --prod
```

## 첫 실행 후 할 일

1. `http://localhost:3000/settings` 접속
2. OpenAI API 키 입력 (sk-...) → 저장
3. `http://localhost:3000` 에서 글 작성 시작

## 페이지 구성

| 경로 | 기능 |
|---|---|
| `/` | 글 작성 + AI 분석 |
| `/log` | 전체 글 기록 조회 |
| `/dashboard` | 통계·차트·TOP10 |
| `/report` | 월간 리포트 자동 생성 |
| `/settings` | API 키·모델·데이터 관리 |

## 비용 참고

- Vercel: 무료 플랜으로 충분
- OpenAI gpt-4o-mini: 글 1편 분석 약 $0.001
- 월 100편 분석 기준 약 $0.1 수준
