/* ═══════════════════════════════════════════════════════════════
   진행 로직 — 『백지첩』 24수
   ───────────────────────────────────────────────────────────────
   지표는 두 개뿐: 등불(연속 수련일)과 익힌 수(이번 회차에 되살린 장 수).
   전부 저장된 기록에서 파생 계산한다. 따로 저장하는 건 db.game(이름·회차·본 장면·
   시련 기록·주간 편지)뿐이라 기기 간 동기화 병합이 단순하다.
═══════════════════════════════════════════════════════════════ */
import type { DB, WritingEntry } from './db';
import { CHAPTERS, ALL_SU, TOTAL_SU, chapterOf, type Chapter, type Su, type BossId, type Dim } from './curriculum';

/* ── 날짜 (로컬 기준) ── */
export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export const todayKey = () => dayKey(new Date());
export function addDays(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
export function weekKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dayKey(new Date(y, m - 1, d - ((dt.getDay() + 6) % 7)));
}
const wDay = (w: WritingEntry) => (w.date || dayKey(w.createdAt)).slice(0, 10);

/* ── 저장 상태 ── */
export type Step = 'warmup' | 'drill' | 'write';
export interface DrillLog {
  id: number;
  drill: string;
  /** 0~10 평균 */
  avg: number;
  createdAt: string;
  /** 어느 수의 어느 단계였나 (자유 연습·맞춤 과제면 없음) */
  su?: number;
  step?: Step;
}
export interface TrialRecord {
  id: number;
  cycle: number;
  chapter: number;
  boss: BossId;
  writingId: number;
  passed: boolean;
  value: number;
  createdAt: string;
}
export interface WeeklyLetter { week: string; text: string; createdAt: string }
export interface GameState {
  name: string;
  cycle: number;
  cycleStart: string;
  seenScenes: string[];
  trials: TrialRecord[];
  letters: WeeklyLetter[];
}
export const DEFAULT_GAME: GameState = { name: '', cycle: 1, cycleStart: '1970-01-01T00:00:00.000Z', seenScenes: [], trials: [], letters: [] };
export function getGame(db: DB): GameState {
  const g = { ...DEFAULT_GAME, ...(db.game ?? {}) } as GameState;
  return { ...g, cycle: g.cycle || 1, trials: (g.trials ?? []).filter(t => typeof t.chapter === 'number'), letters: g.letters ?? [] };
}

/* ── 회차 기준 ── */
/** 시련 기준: 채점이 엄격하다(항목 5=평균, 6=평균 이상, 7=드묾 / 괜찮은 수필이 40~50점대).
 *  1회차 항목 6·종합 58, 2회차부터 항목 7·종합 +4씩(최대 70). */
export function trialRule(ch: Chapter, cycle: number) {
  const b = ch.boss;
  const dimMin = b.dimMin != null ? Math.min(7, b.dimMin + (cycle >= 2 ? 1 : 0)) : undefined;
  const scoreMin = b.scoreMin != null ? Math.min(70, b.scoreMin + (cycle - 1) * 4) : undefined;
  const minChars = Math.round(b.minChars * (1 + Math.min(0.5, (cycle - 1) * 0.15)));
  const maxChars = b.maxChars ? Math.max(b.maxChars, minChars + 100) : undefined;
  const target = ch.dim === '종합' ? `종합 ${scoreMin}점` : `${ch.dim} ${dimMin}점`;
  const len = maxChars ? `${minChars}~${maxChars}자` : `${minChars}자 이상`;
  return { dimMin, scoreMin, minChars, maxChars, text: `${len}, ${target} 이상이면 격파` };
}

export function judgeTrial(ch: Chapter, cycle: number, w: WritingEntry) {
  const r = trialRule(ch, cycle);
  const a = w.analysis;
  const len = w.text.length;
  if (!a) return { passed: false, value: 0, need: 0, why: '분석이 없습니다.' };
  const value = ch.dim === '종합' ? a.score : (a.score_breakdown?.[ch.dim as Dim] ?? 0);
  const need = ch.dim === '종합' ? (r.scoreMin ?? 58) : (r.dimMin ?? 6);
  if (len < r.minChars) return { passed: false, value, need, why: `${r.minChars}자 이상이어야 해요 (지금 ${len}자).` };
  if (r.maxChars && len > r.maxChars) return { passed: false, value, need, why: `${r.maxChars}자 안으로 줄여야 해요 (지금 ${len}자).` };
  if (value < need) return { passed: false, value, need, why: `${ch.dim === '종합' ? '종합 점수' : ch.dim} ${value} / ${need}` };
  return { passed: true, value, need, why: '격파!' };
}

/* ── 수 익힘 판정 ── */
export interface SuProgress { su: Su; steps: Record<Step, boolean>; mastered: boolean; masteredAt?: string }
function suProgressMap(db: DB, since: string): Map<number, SuProgress> {
  const m = new Map<number, SuProgress>();
  for (const su of ALL_SU) m.set(su.n, { su, steps: { warmup: false, drill: false, write: false }, mastered: false });
  const events: { n?: number; step: Step; at: string }[] = [
    ...(db.drillLogs ?? []).filter(d => d.su && d.step).map(d => ({ n: d.su, step: d.step!, at: d.createdAt })),
    ...db.writings.filter(w => w.su).map(w => ({ n: w.su, step: 'write' as Step, at: w.createdAt })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  events.forEach(e => {
    if (!e.n || e.at < since) return;
    const p = m.get(e.n); if (!p) return;
    p.steps[e.step] = true;
    if (!p.mastered && p.steps.warmup && p.steps.drill && p.steps.write) { p.mastered = true; p.masteredAt = e.at; }
  });
  return m;
}

export type ChapterStatus = 'done' | 'current' | 'trial' | 'locked';
export interface ChapterView {
  ch: Chapter;
  status: ChapterStatus;
  sus: SuProgress[];
  trialPassed: boolean;
  bestHit: number;
  rule: ReturnType<typeof trialRule>;
}
export interface PathView {
  cycle: number;
  chapters: ChapterView[];
  /** 지금 배울 수 (시련 대기 중이거나 회차를 마쳤으면 null) */
  current: SuProgress | null;
  /** 시련 대기 중인 장 (그 장의 4수를 다 익혔는데 시련 전) */
  trialChapter: ChapterView | null;
  masteredCount: number;
  cycleDone: boolean;
}

export function pathView(db: DB): PathView {
  const g = getGame(db);
  const prog = suProgressMap(db, g.cycleStart);
  let blocked = false;
  let current: SuProgress | null = null;
  let trialChapter: ChapterView | null = null;
  const chapters: ChapterView[] = CHAPTERS.map(ch => {
    const sus = ch.sus.map(s => prog.get(s.n)!);
    const recs = g.trials.filter(t => t.cycle === g.cycle && t.chapter === ch.n);
    const trialPassed = recs.some(t => t.passed);
    const rule = trialRule(ch, g.cycle);
    const need = ch.dim === '종합' ? (rule.scoreMin ?? 58) : (rule.dimMin ?? 6);
    const bestHit = recs.length ? Math.min(1, Math.max(...recs.map(r => r.passed ? 1 : r.value / need))) : 0;
    let status: ChapterStatus;
    if (blocked) status = 'locked';
    else if (sus.every(s => s.mastered) && trialPassed) status = 'done';
    else if (sus.every(s => s.mastered)) { status = 'trial'; blocked = true; }
    else { status = 'current'; blocked = true; current = sus.find(s => !s.mastered) ?? null; }
    const v: ChapterView = { ch, status, sus, trialPassed, bestHit, rule };
    if (status === 'trial') trialChapter = v;
    return v;
  });
  const masteredCount = chapters.reduce((s, c) => s + c.sus.filter(x => x.mastered).length, 0);
  return { cycle: g.cycle, chapters, current, trialChapter, masteredCount, cycleDone: chapters.every(c => c.status === 'done') };
}

/* ── 오늘 ── */
export interface TodayView {
  /** 오늘 수련할(했던) 수 */
  su: Su | null;
  steps: Record<Step, boolean>;
  /** 오늘 한 수를 끝까지 마쳤는가 */
  done: boolean;
  /** 오늘 무엇이든 썼는가 (= 등불) */
  lit: boolean;
}
const noSteps = (): Record<Step, boolean> => ({ warmup: false, drill: false, write: false });
export function todayView(db: DB): TodayView {
  const t = todayKey();
  const logs = (db.drillLogs ?? []).filter(d => dayKey(d.createdAt) === t);
  const writes = db.writings.filter(w => dayKey(w.createdAt) === t);
  const lit = logs.length > 0 || writes.length > 0;
  const touched = new Map<number, Record<Step, boolean>>();
  const touch = (n: number, step: Step) => { const s = touched.get(n) ?? noSteps(); s[step] = true; touched.set(n, s); };
  logs.forEach(d => { if (d.su && d.step) touch(d.su, d.step); });
  writes.forEach(w => { if (w.su) touch(w.su, 'write'); });
  const doneEntry = Array.from(touched.entries()).find(([, s]) => s.warmup && s.drill && s.write);
  const pv = pathView(db);
  const cur = pv.current;
  // 오늘 이미 한 수를 마쳤으면 '완료' — 다음 수는 "하나 더"로
  if (doneEntry) return { su: cur?.su ?? ALL_SU.find(s => s.n === doneEntry[0]) ?? null, steps: cur ? { ...cur.steps } : doneEntry[1], done: true, lit };
  if (cur) return { su: cur.su, steps: { ...cur.steps }, done: false, lit };
  return { su: null, steps: noSteps(), done: false, lit };
}

/* ── 등불과 안개 ── */
export function practiceDays(db: DB): Set<string> {
  const s = new Set<string>();
  db.writings.forEach(w => s.add(wDay(w)));
  (db.drillLogs ?? []).forEach(d => s.add(dayKey(d.createdAt)));
  return s;
}
export function currentStreak(db: DB): number {
  const days = practiceDays(db);
  let k = todayKey();
  if (!days.has(k)) k = addDays(k, -1);
  let n = 0;
  while (days.has(k)) { n++; k = addDays(k, -1); }
  return n;
}
export function bestStreak(db: DB): number {
  const days = practiceDays(db);
  let best = 0;
  days.forEach(d => {
    if (days.has(addDays(d, -1))) return;
    let n = 1, cur = d;
    while (days.has(addDays(cur, 1))) { cur = addDays(cur, 1); n++; }
    best = Math.max(best, n);
  });
  return best;
}
/** 0(맑음)~1(짙음) — 마지막 수련 이후 지난 날수 */
export function fogLevel(db: DB): number {
  const days = Array.from(practiceDays(db)).sort();
  if (!days.length) return 0.6;
  const [y, m, d] = days[days.length - 1].split('-').map(Number);
  const gap = Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86400000);
  return Math.max(0, Math.min(1, (gap - 1) / 6));
}

/* ── 칭호·도포 (장을 마칠 때마다 바뀐다) ── */
const TITLES = ['견습 제자', '눈뜬 제자', '그리는 제자', '움직이는 제자', '덜어내는 제자', '잇는 제자', '백지첩의 제자'];
const ROBES = [
  { robe: '#5a5a8a', color: '#8f8fb8' }, { robe: '#1f6fa8', color: '#37c4ff' }, { robe: '#8e2f6f', color: '#f15bb5' },
  { robe: '#3e8e41', color: '#7cff6b' }, { robe: '#b0562a', color: '#ff8c42' }, { robe: '#6b4a8a', color: '#c9a0ff' }, { robe: '#c8961e', color: '#f7e26b' },
];
export function rankOf(db: DB) {
  const pv = pathView(db);
  const done = pv.chapters.filter(c => c.status === 'done').length;
  if (pv.cycle > 1) return { title: `${pv.cycle}회차 · ${TITLES[Math.max(1, done)]}`, ...ROBES[6], chaptersDone: done };
  return { title: TITLES[done], ...ROBES[done], chaptersDone: done };
}

/* ── 약점 (최근 분석 10편) ── */
const DIMS: Dim[] = ['표현력', '전달력', '구체성', '논리성', '가독성'];
export function weakestDims(db: DB): { dim: Dim; avg: number }[] {
  const an = db.writings.filter(w => w.analysis?.score_breakdown).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-10);
  if (!an.length) return [];
  return DIMS.map(d => ({ dim: d, avg: an.reduce((s, w) => s + (w.analysis!.score_breakdown[d] ?? 0), 0) / an.length }))
    .sort((a, b) => a.avg - b.avg);
}

/* ── 변화 감지용 스냅샷 ── */
export interface GameSnapshot { mastered: number; chapters: number; cycle: number; todayDone: boolean; lit: boolean }
export function snapshot(db: DB): GameSnapshot {
  const pv = pathView(db);
  const tv = todayView(db);
  return { mastered: pv.masteredCount, chapters: pv.chapters.filter(c => c.status === 'done').length, cycle: pv.cycle, todayDone: tv.done, lit: tv.lit };
}

export { TOTAL_SU, chapterOf };
