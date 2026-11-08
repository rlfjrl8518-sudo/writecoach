#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   묵당의 저녁 종 — 매시 정각 Cloud Run Job(writecoach-push)으로 돈다.
     node scripts/push-cron.mjs [--dry-run] [--force-hour=N | --force-hour N]

   1) gs://$SYNC_BUCKET/push/*.json (사용자별 알림 설정) 을 훑는다.
   2) enabled 이고, hour == 지금 한국 시각(시), lastSentDay != 오늘(KST) 인 사람만.
   3) 그 사람 DB(users/<같은 해시>/db.json.gz)를 열어 오늘(KST) 글·드릴 기록이 있으면 건너뛴다.
   4) 없으면 푸시 한 통. 연속 수련(어제까지) 2일 이상이면 '등불이 꺼진다' 문구.
   5) 404/410 구독은 지우고 lastSentDay=오늘 로 기록 (조건부 쓰기로 웹 요청과 겹쳐도 안전).

   이미지(.next/standalone) 안에서 돌므로 Next 가 추적해 넣는 패키지(web-push,
   @google-cloud/storage)만 쓴다. Next 쪽과 같은 CJS 진입점을 쓰려고 createRequire 로 불러온다.
═══════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const forceArg = (() => {
  const i = argv.findIndex(a => a === '--force-hour' || a.startsWith('--force-hour='));
  if (i < 0) return null;
  const v = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 23) { console.error('[push-cron] --force-hour 는 0~23'); process.exit(2); }
  return n;
})();

const BUCKET = process.env.SYNC_BUCKET ?? '';
const SUBJECT = 'mailto:rlfjrl8518@gmail.com';

const KST_MS = 9 * 3600 * 1000; // 한국은 서머타임 없음
const kstDay = (d) => new Date(d.getTime() + KST_MS).toISOString().slice(0, 10);
const kstHour = (d) => new Date(d.getTime() + KST_MS).getUTCHours();
const isoToKstDay = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? kstDay(new Date(t)) : null; };
const prevDay = (day) => new Date(Date.parse(day + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);

const LINES = [
  '자네, 오늘 먹은 갈았는가. 한 줄이면 된다.',
  '해가 졌다. 백지 안개가 서재 문턱까지 왔어.',
  '잘 쓰려 하지 말게. 오늘은 그저 쓰게.',
  '붓이 마르면 손도 굳지. 세 문장만 적고 자게.',
  '오늘 본 것 하나만 적어 보게. 그게 글일세.',
  '서재 등불을 켜 두었다. 들어오게.',
  '미루기 요괴가 문밖에서 웃고 있군. 한 줄로 쫓아내게.',
  '하루 한 장. 그 약속, 아직 유효하다.',
];
const STREAK_LINES = [
  '등불이 {n}일째 켜져 있다. 오늘 꺼지게 둘 건가?',
  '{n}일을 이어 왔군. 오늘 한 줄이면 {m}일일세.',
  '자네의 {n}일, 여기서 끊기엔 아깝지.',
];

function practicedDays(db) {
  const days = new Set();
  for (const w of Array.isArray(db?.writings) ? db.writings : []) {
    if (typeof w?.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(w.date)) days.add(w.date.slice(0, 10));
    const c = typeof w?.createdAt === 'string' && isoToKstDay(w.createdAt);
    if (c) days.add(c);
  }
  for (const d of Array.isArray(db?.drillLogs) ? db.drillLogs : []) {
    const c = typeof d?.createdAt === 'string' && isoToKstDay(d.createdAt);
    if (c) days.add(c);
  }
  return days;
}

function streakUntilYesterday(days, today) {
  let n = 0;
  for (let d = prevDay(today); days.has(d); d = prevDay(d)) n++;
  return n;
}

function pickMessage(streak, today) {
  const seed = Math.floor(Date.parse(today + 'T00:00:00Z') / 86400000);
  if (streak >= 2) {
    return STREAK_LINES[seed % STREAK_LINES.length].replaceAll('{n}', String(streak)).replaceAll('{m}', String(streak + 1));
  }
  return LINES[seed % LINES.length];
}

async function main() {
  if (!BUCKET) {
    console.log('[push-cron] SYNC_BUCKET 이 비어 있음 — 할 일 없음, 종료');
    return 0;
  }
  const { Storage } = require('@google-cloud/storage');
  const webpush = require('web-push');

  if (!DRY) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.error('[push-cron] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 없음');
      return 1;
    }
    webpush.setVapidDetails(SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }

  const now = new Date();
  const today = kstDay(now);
  const hour = forceArg ?? kstHour(now);
  const bucket = new Storage().bucket(BUCKET);
  console.log(`[push-cron] ${DRY ? 'DRY-RUN ' : ''}KST ${today} ${hour}시${forceArg !== null ? ' (forced)' : ''} · gs://${BUCKET}/push/`);

  const [files] = await bucket.getFiles({ prefix: 'push/' });
  const prefFiles = files.filter(f => /^push\/[0-9a-f]{32}\.json$/.test(f.name));
  const stat = { total: prefFiles.length, due: 0, practiced: 0, sent: 0, removed: 0, failed: 0 };

  for (const f of prefFiles) {
    const key = f.name.slice(5, 37);
    try {
      const gen = Number(f.metadata.generation);
      const [buf] = await bucket.file(f.name, { generation: gen }).download();
      const prefs = JSON.parse(buf.toString('utf8'));
      const subs = Array.isArray(prefs.subs) ? prefs.subs : [];
      if (!prefs.enabled || !subs.length || Number(prefs.hour) !== hour || prefs.lastSentDay === today) continue;
      stat.due++;

      let db = null;
      try {
        const [gz] = await bucket.file(`users/${key}/db.json.gz`).download({ validation: false });
        db = JSON.parse(gunzipSync(gz).toString('utf8'));
      } catch (e) {
        if (e?.code !== 404) throw e;
      }
      const days = practicedDays(db);
      if (days.has(today)) {
        stat.practiced++;
        console.log(`[push-cron] ${key.slice(0, 8)}… 오늘 수련함 — 건너뜀`);
        continue;
      }
      const streak = streakUntilYesterday(days, today);
      const body = pickMessage(streak, today);
      const payload = JSON.stringify({ title: '산마루 서재', body, url: '/practice', tag: 'writecoach-daily' });

      if (DRY) {
        console.log(`[push-cron] ${key.slice(0, 8)}… (dry) 보낼 예정: 기기 ${subs.length}대 · 연속 ${streak}일 · "${body}"`);
        continue;
      }

      const gone = new Set();
      let ok = 0;
      await Promise.all(subs.map(async (s) => {
        try {
          await webpush.sendNotification(s, payload, { TTL: 60 * 60 * 6, urgency: 'normal' });
          ok++;
        } catch (e) {
          if (e?.statusCode === 404 || e?.statusCode === 410) gone.add(s.endpoint);
          else { stat.failed++; console.warn(`[push-cron] ${key.slice(0, 8)}… 발송 실패 ${e?.statusCode ?? e?.message}`); }
        }
      }));
      stat.sent += ok;
      stat.removed += gone.size;
      console.log(`[push-cron] ${key.slice(0, 8)}… 보냄 ${ok}/${subs.length} · 제거 ${gone.size} · 연속 ${streak}일`);

      // 기록: 조건부 쓰기, 겹치면 다시 읽어 합친다
      let cur = prefs, curGen = gen;
      for (let i = 0; i < 3; i++) {
        const next = {
          ...cur,
          subs: (cur.subs ?? []).filter(s => !gone.has(s.endpoint)),
          lastSentDay: ok > 0 ? today : cur.lastSentDay,
        };
        if (!next.subs.length) next.enabled = false;
        try {
          await f.save(JSON.stringify(next), {
            resumable: false, contentType: 'application/json', metadata: { cacheControl: 'no-store' },
            preconditionOpts: { ifGenerationMatch: curGen },
          });
          break;
        } catch (e) {
          if (e?.code !== 412 || i === 2) throw e;
          const [m] = await f.getMetadata();
          curGen = Number(m.generation);
          const [b] = await bucket.file(f.name, { generation: curGen }).download();
          cur = JSON.parse(b.toString('utf8'));
        }
      }
    } catch (e) {
      stat.failed++;
      console.error(`[push-cron] ${key.slice(0, 8)}… 오류`, e?.message ?? e);
    }
  }

  console.log(`[push-cron] 끝: 설정 ${stat.total} · 대상 ${stat.due} · 이미 씀 ${stat.practiced} · 보냄 ${stat.sent} · 제거 ${stat.removed} · 실패 ${stat.failed}`);
  return 0;
}

main().then(code => process.exit(code), (e) => { console.error('[push-cron] 치명적 오류', e); process.exit(1); });
