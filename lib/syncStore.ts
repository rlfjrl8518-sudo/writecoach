import 'server-only';
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { Storage } from '@google-cloud/storage';

/* ═══════════════════════════════════════════════════════════════
   기기 간 동기화 저장소 — GCS 객체 하나에 사용자 DB 전체(gzip JSON).
   - 사용자 식별: Cloud Run IAP가 붙이는 x-goog-authenticated-user-email 헤더.
     (로컬 개발은 SYNC_DEV_USER)
   - 동시성: 객체 generation을 rev로 쓰고, 쓰기 때 ifGenerationMatch로 '내가 본 판'일 때만
     덮는다. 다른 기기가 먼저 썼으면 412 → 클라이언트가 다시 받아 합친 뒤 재시도.
   - 버킷은 버전 관리(versioning)가 켜져 있어 덮어쓴 이전 판도 복구할 수 있다.
═══════════════════════════════════════════════════════════════ */
const BUCKET = process.env.SYNC_BUCKET ?? '';
let storage: Storage | null = null;

export const syncEnabled = () => !!BUCKET;

export function userFrom(headers: Headers): string | null {
  const iap = headers.get('x-goog-authenticated-user-email'); // "accounts.google.com:me@gmail.com"
  if (iap) return iap.split(':').pop()!.toLowerCase();
  if (process.env.NODE_ENV !== 'production' && process.env.SYNC_DEV_USER) return process.env.SYNC_DEV_USER.toLowerCase();
  return null;
}

function file(user: string, generation?: number) {
  storage ??= new Storage();
  // 이메일을 그대로 경로에 쓰지 않는다
  const key = createHash('sha256').update(user).digest('hex').slice(0, 32);
  return storage.bucket(BUCKET).file(`users/${key}/db.json.gz`, generation ? { generation } : undefined);
}

export async function readUserDb(user: string): Promise<{ data: unknown | null; rev: string }> {
  const f = file(user);
  try {
    const [meta] = await f.getMetadata();
    // 메타데이터에서 본 바로 그 판(generation)을 내려받아 rev와 내용이 어긋나지 않게 한다
    const [buf] = await file(user, Number(meta.generation)).download({ validation: false });
    const text = gunzipSync(buf).toString('utf8');
    return { data: JSON.parse(text), rev: String(meta.generation) };
  } catch (e) {
    if ((e as { code?: number }).code === 404) return { data: null, rev: '0' };
    throw e;
  }
}

export class ConflictError extends Error {}

export async function writeUserDb(user: string, data: unknown, baseRev: string): Promise<string> {
  const f = file(user);
  const body = gzipSync(Buffer.from(JSON.stringify(data), 'utf8'));
  try {
    await f.save(body, {
      resumable: false,
      contentType: 'application/json',
      metadata: { contentEncoding: 'identity', cacheControl: 'no-store' },
      preconditionOpts: { ifGenerationMatch: Number(baseRev) || 0 },
    });
  } catch (e) {
    if ((e as { code?: number }).code === 412) throw new ConflictError('stale');
    throw e;
  }
  // 업로드 응답의 generation — 방금 쓴 바로 그 판
  return String(f.metadata.generation);
}
