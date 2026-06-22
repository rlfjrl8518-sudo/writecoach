import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { DB, ExpressionRecord, Settings } from './db';

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

/* ── Sync ── */
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
export function mergeDBs(local: DB, remote: DB): DB {
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
    rewrites:              mergeArr(local.rewrites, remote.rewrites),
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
    _deletedIds:              Array.from(deletedIds),
  };
}
