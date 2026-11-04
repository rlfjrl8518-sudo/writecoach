import 'server-only';
import { createHash } from 'crypto';
import { Storage } from '@google-cloud/storage';
import type { PushSubscription as WebPushSubscription } from 'web-push';

/* ═══════════════════════════════════════════════════════════════
   푸시 알림 설정 저장소 — gs://<SYNC_BUCKET>/push/<사용자 해시>.json
   - 해시는 lib/syncStore.ts 와 같은 규칙(sha256(email) 앞 32자) → 크론이 같은 해시로
     users/<해시>/db.json.gz 를 찾아 '오늘 썼는지' 판단한다.
   - 쓰기는 generation 조건부(ifGenerationMatch). 크론과 동시에 써도 덮어쓰지 않고 재시도.
═══════════════════════════════════════════════════════════════ */
const BUCKET = process.env.SYNC_BUCKET ?? '';
const MAX_SUBS = 5;
let storage: Storage | null = null;

export interface PushPrefs {
  email: string;
  subs: WebPushSubscription[];
  hour: number;        // 0~23, 한국 시간
  enabled: boolean;
  lastSentDay: string; // 'YYYY-MM-DD' (KST) — 같은 날 두 번 보내지 않음
  updatedAt?: string;
}

export const userKey = (email: string) => createHash('sha256').update(email).digest('hex').slice(0, 32);
export const endpointId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 16);

function file(email: string) {
  storage ??= new Storage();
  return storage.bucket(BUCKET).file(`push/${userKey(email)}.json`);
}

const empty = (email: string): PushPrefs => ({ email, subs: [], hour: 21, enabled: false, lastSentDay: '' });

async function readRaw(email: string): Promise<{ prefs: PushPrefs; gen: number }> {
  const f = file(email);
  try {
    const [meta] = await f.getMetadata();
    const gen = Number(meta.generation);
    const [buf] = await storage!.bucket(BUCKET).file(f.name, { generation: gen }).download();
    return { prefs: { ...empty(email), ...JSON.parse(buf.toString('utf8')) }, gen };
  } catch (e) {
    if ((e as { code?: number }).code === 404) return { prefs: empty(email), gen: 0 };
    throw e;
  }
}

export async function readPrefs(email: string): Promise<PushPrefs> {
  return (await readRaw(email)).prefs;
}

/** 읽고-고치고-쓰기. 다른 쓰기와 겹치면(412) 최대 3번 다시 시도. */
export async function updatePrefs(email: string, mutate: (p: PushPrefs) => PushPrefs): Promise<PushPrefs> {
  for (let i = 0; i < 3; i++) {
    const { prefs, gen } = await readRaw(email);
    const next = mutate({ ...prefs, subs: [...prefs.subs] });
    next.email = email;
    next.updatedAt = new Date().toISOString();
    // 같은 endpoint 는 하나만, 최신 것 우선, 최대 5대
    const seen = new Set<string>();
    next.subs = next.subs.filter(s => s?.endpoint && !seen.has(s.endpoint) && seen.add(s.endpoint)).slice(-MAX_SUBS);
    try {
      await file(email).save(JSON.stringify(next), {
        resumable: false,
        contentType: 'application/json',
        metadata: { cacheControl: 'no-store' },
        preconditionOpts: { ifGenerationMatch: gen },
      });
      return next;
    } catch (e) {
      if ((e as { code?: number }).code === 412) continue;
      throw e;
    }
  }
  throw new Error('push prefs: too many concurrent writes');
}
