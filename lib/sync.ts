'use client';
/* ═══════════════════════════════════════════════════════════════
   기기 간 동기화 엔진 (PC ↔ 모바일)
   ───────────────────────────────────────────────────────────────
   원칙
   1) 절대 '통째로 덮어쓰기' 하지 않는다: 항상 받아온 판과 합친(mergeDBs) 뒤 올린다.
   2) 올릴 때는 '내가 받아온 판(rev)'일 때만 저장된다. 그 사이 다른 기기가 먼저 올렸으면
      서버가 409와 최신 판을 돌려주고, 다시 합쳐서 재시도한다.
   3) 항목마다 마지막 수정 시각(_u)이 있어, 두 기기에서 같은 글을 고쳤으면 나중 수정이 남는다.
   4) 동기화 시점: 앱을 열 때 · 저장 직후(1.5초 모아서) · 화면으로 돌아올 때 · 온라인 복귀 ·
      화면이 보이는 동안 60초마다 · 앱을 닫을 때.
   백엔드
   - google: Cloud Run + IAP 환경. /api/sync (GCS). 로그인한 구글 계정 기준, 별도 로그인 없음.
   - supabase: 그 밖의 환경(예전 Vercel)에서 Supabase 로그인을 했을 때.
═══════════════════════════════════════════════════════════════ */
import { loadDB, saveDBMerged, type DB } from './db';
import { mergeDBs, supabase, isSupabaseConfigured, pullRow, pushRow } from './supabase';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'none';
export type BackendName = 'google' | 'supabase' | null;

interface Remote { data: DB | null; rev: string }
type PushResult = { ok: true; rev: string } | { ok: false; conflict: Remote };
interface Backend { name: Exclude<BackendName, null>; pull(): Promise<Remote>; push(db: DB, baseRev: string): Promise<PushResult> }

/* ── 안정 해시: 키 순서·배열 순서(id) 차이를 무시하고 내용만 비교 ── */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) {
    const arr = v.map(canon);
    if (arr.length && arr.every(x => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'number')) {
      arr.sort((a, b) => (a as { id: number }).id - (b as { id: number }).id);
    }
    return arr;
  }
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    Object.keys(v as object).sort().forEach(k => { const x = (v as Record<string, unknown>)[k]; if (x !== undefined) o[k] = canon(x); });
    return o;
  }
  return v;
}
export function dbHash(db: DB | null): string {
  if (!db) return '';
  const s = JSON.stringify(canon(db));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h >>> 0}`;
}

/* ── 백엔드 ── */
const googleBackend: Backend = {
  name: 'google',
  async pull() {
    const r = await fetch('/api/sync', { cache: 'no-store', credentials: 'include' });
    if (!r.ok) throw new Error(`sync GET ${r.status}`);
    const j = await r.json();
    return { data: j.data as DB | null, rev: String(j.rev) };
  },
  async push(db, baseRev) {
    const r = await fetch('/api/sync', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: db, baseRev }), keepalive: false,
    });
    if (r.status === 409) { const j = await r.json(); return { ok: false, conflict: { data: j.data, rev: String(j.rev) } }; }
    if (!r.ok) throw new Error(`sync PUT ${r.status}`);
    const j = await r.json();
    return { ok: true, rev: String(j.rev) };
  },
};

const supabaseBackend: Backend = {
  name: 'supabase',
  async pull() { const r = await pullRow(); return { data: r?.data ?? null, rev: r?.updatedAt ?? '0' }; },
  async push(db, baseRev) {
    // Supabase는 조건부 쓰기가 없으니 직전에 다시 확인한다
    const cur = await pullRow();
    if (cur && cur.updatedAt !== baseRev) return { ok: false, conflict: { data: cur.data, rev: cur.updatedAt } };
    const rev = await pushRow(db);
    return { ok: true, rev };
  },
};

/* ── 상태 ── */
let backend: Backend | null = null;
let rev = '0';
let lastRemoteHash = '';
let running: Promise<void> | null = null;
let again = false;
let applying = false;
let firstSyncDone = false;
let user: string | null = null;

export function getBackend(): BackendName { return backend?.name ?? null; }
export function getSyncUser() { return user; }
export function isApplyingRemote() { return applying; }

function status(s: SyncStatus) {
  window.dispatchEvent(new CustomEvent('sync-status', { detail: s }));
}

/** 백엔드 판별 — google(/api/sync 200)이 우선, 아니면 Supabase 로그인 */
export async function detectBackend(): Promise<BackendName> {
  try {
    const r = await fetch('/api/sync', { cache: 'no-store', credentials: 'include' });
    if (r.ok) {
      const j = await r.json();
      backend = googleBackend; user = j.user ?? null;
      return 'google';
    }
  } catch { /* 오프라인 등 */ }
  if (isSupabaseConfigured && supabase) {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) { backend = supabaseBackend; user = u.email ?? null; return 'supabase'; }
  }
  backend = null;
  return null;
}

/** 받아온 원격과 로컬을 합쳐 로컬에 반영. 바뀐 게 있으면 true */
function applyRemote(remote: DB | null): { merged: DB; changed: boolean } {
  const local = loadDB();
  if (!remote) return { merged: local, changed: false };
  const merged = mergeDBs(local, remote);
  const changed = dbHash(merged) !== dbHash(local);
  if (changed) {
    saveDBMerged(merged);
    applying = true;
    try { window.dispatchEvent(new CustomEvent('db-saved', { detail: merged })); } finally { applying = false; }
    window.dispatchEvent(new CustomEvent('db-remote-applied'));
  }
  return { merged, changed };
}

async function runOnce() {
  if (!backend) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) { status('offline'); return; }
  status('syncing');
  let remote = await backend.pull();
  rev = remote.rev;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { merged } = applyRemote(remote.data);
    const h = dbHash(merged);
    if (remote.data && h === dbHash(remote.data)) { lastRemoteHash = h; break; } // 이미 같다
    const res = await backend.push(merged, rev);
    if (res.ok) { rev = res.rev; lastRemoteHash = h; break; }
    remote = res.conflict; rev = remote.rev; // 다른 기기가 먼저 썼다 → 다시 합친다
  }
  firstSyncDone = true;
  status('synced');
}

/** 동기화 요청 — 이미 돌고 있으면 끝난 뒤 한 번 더 */
export function syncNow(): Promise<void> {
  if (!backend) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do { again = false; await runOnce(); } while (again);
    } catch (e) {
      console.warn('[sync]', e);
      status(navigator.onLine ? 'error' : 'offline');
    } finally { running = null; }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** 저장 직후 호출 — 1.5초 모아서 동기화 */
export function requestSync(delay = 1500) {
  if (!backend) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncNow(); }, delay);
}

/** 앱을 닫을 때 — 바뀐 게 있으면 조건부로 한 번 올린다(합치기는 다음 실행 때) */
export function flushOnHide() {
  if (!backend || backend.name !== 'google' || !firstSyncDone) return;
  const db = loadDB();
  if (dbHash(db) === lastRemoteHash) return;
  try {
    fetch('/api/sync', {
      method: 'PUT', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: db, baseRev: rev }),
    }).catch(() => {});
  } catch { /* keepalive 본문 한도(64KB) 초과 등 — 다음 실행 때 동기화 */ }
}

/** 원격을 지금 로컬 그대로 교체 (전체 삭제·백업 가져오기처럼 '덮어쓰기'가 의도일 때만) */
export async function replaceRemote(db: DB): Promise<void> {
  if (!backend) return;
  for (let i = 0; i < 5; i++) {
    const cur = await backend.pull();
    const res = await backend.push(db, cur.rev);
    if (res.ok) { rev = res.rev; lastRemoteHash = dbHash(db); status('synced'); return; }
  }
  throw new Error('다른 기기와 동시에 쓰고 있어요. 잠시 후 다시 시도해 주세요.');
}

/** Supabase에 있던 예전 데이터를 한 번 합쳐 온다 (google 백엔드로 옮긴 뒤 최초 1회) */
export async function importLegacySupabaseOnce() {
  if (backend?.name !== 'google' || !isSupabaseConfigured || !supabase) return;
  if (localStorage.getItem('wc_supabase_imported')) return;
  try {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const row = await pullRow();
    if (row?.data) { applyRemote(row.data); requestSync(200); }
    localStorage.setItem('wc_supabase_imported', new Date().toISOString());
  } catch { /* 다음 기회에 */ }
}

export function isFirstSyncDone() { return firstSyncDone; }
