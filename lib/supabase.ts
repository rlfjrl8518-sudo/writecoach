import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { DB, ExpressionRecord, Journey, Settings } from './db';
import { DEFAULT_JOURNEY, normalizeDB } from './db';
import { DEFAULT_GAME, type GameState } from './game';

export type { User };

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

/* ── Auth ── */
export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase가 설정되지 않았어요.' };
  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'https://writecoach-three.vercel.app/auth/callback';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

/* ── Settings Sync ── */
export async function pushSettings(settings: Settings): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: existing } = await supabase
    .from('user_data').select('data').eq('user_id', user.id).single();
  const base = (existing?.data as Record<string, unknown>) ?? {};
  await supabase.from('user_data').upsert(
    { user_id: user.id, data: { ...base, __settings: settings }, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

export async function pullSettings(): Promise<Settings | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_data').select('data').eq('user_id', user.id).single();
  if (error || !data?.data) return null;
  const s = (data.data as Record<string, unknown>).__settings;
  return (s as Settings) ?? null;
}

/* ── 동기화 엔진(lib/sync.ts)용: 행 단위 읽기/쓰기 ──
   user_data.data 안에 __settings가 함께 들어 있으므로 쓸 때 보존한다. */
export async function pullRow(): Promise<{ data: DB | null; updatedAt: string } | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('user_data').select('data, updated_at').eq('user_id', user.id).single();
  if (error?.code === 'PGRST116') return { data: null, updatedAt: '0' };
  if (error) throw new Error(error.message);
  const raw = (data?.data ?? null) as (DB & { __settings?: unknown }) | null;
  if (raw) delete raw.__settings;
  return { data: raw, updatedAt: String(data?.updated_at ?? '0') };
}
export async function pushRow(db: DB): Promise<string> {
  if (!supabase) throw new Error('Supabase 미설정');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인 필요');
  const { data: existing } = await supabase.from('user_data').select('data').eq('user_id', user.id).single();
  const settings = (existing?.data as Record<string, unknown> | undefined)?.__settings;
  const updatedAt = new Date().toISOString();
  const payload = { ...(db as unknown as Record<string, unknown>), ...(settings ? { __settings: settings } : {}) };
  const { error } = await supabase.from('user_data').upsert(
    { user_id: user.id, data: payload, updated_at: updatedAt }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return updatedAt;
}

/* ── Sync (legacy) ── */
export async function pushData(db: DB): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('user_data')
    .upsert(
      { user_id: user.id, data: db as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw new Error(error.message);
}

export async function pullData(): Promise<DB | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', user.id)
    .single();
  if (error?.code === 'PGRST116') return null; // 데이터 없음 (첫 로그인)
  if (error) throw new Error(error.message);
  return (data?.data as DB) ?? null;
}

/* ── Merge: 두 DB를 합침 (항목 ID별 union, 삭제 제외) ── */
export function mergeDBs(localIn: DB, remoteIn: DB): DB {
  // 어느 쪽이든 빠진 필드가 있을 수 있다(옛 버전·부분 데이터) — 기본값으로 채운 뒤 합친다
  const local = normalizeDB(localIn), remote = normalizeDB(remoteIn);
  // 양쪽 tombstone 합산
  const deletedIds = new Set([...(local._deletedIds ?? []), ...(remote._deletedIds ?? [])]);

  function mergeArr<T extends { id: number }>(a: T[], b: T[]): T[] {
    const map = new Map<number, T>();
    [...b, ...a].forEach(item => {
      if (deletedIds.has(item.id)) return; // tombstone — 복구 금지
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        // 수정 시각(_u)이 있으면 나중에 고친 쪽, 없으면(옛 데이터) 분석·평가가 있는 쪽
        const iu = (item as { _u?: number })._u ?? 0;
        const eu = (existing as { _u?: number })._u ?? 0;
        if (iu || eu) { if (iu > eu) map.set(item.id, item); return; }
        const itemDone = !!(item as Record<string, unknown>)['analysis'] || !!(item as Record<string, unknown>)['evaluation'];
        const existDone = !!(existing as Record<string, unknown>)['analysis'] || !!(existing as Record<string, unknown>)['evaluation'];
        if (itemDone && !existDone) map.set(item.id, item);
      }
    });
    return Array.from(map.values()).sort((x, y) => y.id - x.id);
  }

  function mergeRec(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const r = { ...b };
    for (const [k, v] of Object.entries(a)) r[k] = Math.max(r[k] || 0, v);
    return r;
  }

  function mergeJourney(a: Journey, b: Journey): Journey {
    const newer = (a.lastWriteDate ?? '') >= (b.lastWriteDate ?? '') ? a : b;
    return {
      lastWriteDate: newer.lastWriteDate,
      streak: newer.streak,
      maxStreak: Math.max(a.maxStreak ?? 0, b.maxStreak ?? 0),
      badges: Array.from(new Set([...(a.badges ?? []), ...(b.badges ?? [])])),
    };
  }

  /** 게임 상태 — 더 나중 해(year)를 따르고, 본 장면·시련 기록은 합집합 */
  function mergeGame(a?: GameState, b?: GameState): GameState {
    const x = { ...DEFAULT_GAME, ...(a ?? {}) }, y = { ...DEFAULT_GAME, ...(b ?? {}) };
    const lead = x.year !== y.year ? (x.year > y.year ? x : y) : (x.yearStart >= y.yearStart ? x : y);
    const trials = new Map<number, GameState['trials'][number]>();
    [...y.trials, ...x.trials].forEach(t => trials.set(t.id, t));
    return {
      name: x.name || y.name,
      year: lead.year,
      yearStart: lead.yearStart,
      seenScenes: Array.from(new Set([...x.seenScenes, ...y.seenScenes])),
      trials: Array.from(trials.values()).sort((p, q) => p.id - q.id),
    };
  }

  function mergeExprRec(
    a: Record<string, ExpressionRecord>,
    b: Record<string, ExpressionRecord>
  ): Record<string, ExpressionRecord> {
    const r = { ...b };
    for (const [k, v] of Object.entries(a)) {
      if (!r[k]) r[k] = v;
      else r[k] = { ...r[k], count: Math.max(v.count, r[k].count) };
    }
    return r;
  }

  return {
    writings:              mergeArr(local.writings, remote.writings),
    sentences:             mergeArr(local.sentences, remote.sentences),
    copies:                mergeArr(local.copies, remote.copies),
    missions:              mergeArr(local.missions, remote.missions),
    expressions:           mergeExprRec(local.expressions, remote.expressions),
    weaknesses:            mergeRec(local.weaknesses, remote.weaknesses),
    structures:            mergeRec(local.structures, remote.structures),
    senses:                mergeRec(local.senses, remote.senses),
    copyTypes:             mergeRec(local.copyTypes, remote.copyTypes),
    sentenceStructures:    mergeRec(local.sentenceStructures, remote.sentenceStructures),
    sentenceCopyStructures: mergeRec(local.sentenceCopyStructures, remote.sentenceCopyStructures),
    sentenceTypes:            mergeRec(local.sentenceTypes, remote.sentenceTypes),
    sentenceRoles:            mergeRec(local.sentenceRoles ?? {}, remote.sentenceRoles ?? {}),
    sentenceExpressionTypes:  mergeRec(local.sentenceExpressionTypes ?? {}, remote.sentenceExpressionTypes ?? {}),
    images:                   mergeArr(local.images ?? [], remote.images ?? []),
    expressionEntries:        mergeArr(local.expressionEntries ?? [], remote.expressionEntries ?? []),
    books:                    mergeArr(local.books ?? [], remote.books ?? []),
    bookNotes:                mergeArr(local.bookNotes ?? [], remote.bookNotes ?? []),
    ...((local.weaknessSynthesisAt ?? '') > (remote.weaknessSynthesisAt ?? '')
      ? { weaknessSynthesis: local.weaknessSynthesis ?? [], weaknessSynthesisAt: local.weaknessSynthesisAt ?? '' }
      : { weaknessSynthesis: remote.weaknessSynthesis ?? [], weaknessSynthesisAt: remote.weaknessSynthesisAt ?? '' }),
    ...((local.strengthSynthesisAt ?? '') > (remote.strengthSynthesisAt ?? '')
      ? { strengthSynthesis: local.strengthSynthesis ?? [], strengthSynthesisAt: local.strengthSynthesisAt ?? '' }
      : { strengthSynthesis: remote.strengthSynthesis ?? [], strengthSynthesisAt: remote.strengthSynthesisAt ?? '' }),
    drillLogs:                mergeArr(local.drillLogs ?? [], remote.drillLogs ?? []),
    game:                     mergeGame(local.game, remote.game),
    journey:                  mergeJourney(local.journey ?? DEFAULT_JOURNEY, remote.journey ?? DEFAULT_JOURNEY),
    _deletedIds:              Array.from(deletedIds),
  };
}
