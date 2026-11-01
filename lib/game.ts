/* ═══════════════════════════════════════════════════════════════
   게임 로직 — 먹(경험치)·등급·스토리 진행·일일 숙제·주간 요괴·인장
   ───────────────────────────────────────────────────────────────
   원칙: 저장된 기록(db)에서 매번 '파생 계산'한다. 따로 저장하는 건
   db.game(이름, 몇 번째 해, 본 장면, 시련 기록)뿐이라 기기 간 동기화
   병합(lib/supabase.ts mergeDBs)이 단순하다.
═══════════════════════════════════════════════════════════════ */
import type { DB, WritingEntry } from './db';
import {
  type Chapter, type Req, type Trial, type Dim, type BossId,
  getYear, chaptersOf, reqScale, trialBoost,
} from './story';

/* ── 날짜 유틸 (로컬 날짜 기준) ── */
export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function todayKey() { return dayKey(new Date()); }
function addDays(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
/** 월요일 시작 주 키 */
export function weekKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7;
  return dayKey(new Date(y, m - 1, d - dow));
}
/** 글의 날짜 — 사용자가 고른 date 우선 */
const wDay = (w: WritingEntry) => (w.date || dayKey(w.createdAt)).slice(0, 10);

/* ── 게임 상태 ── */
export interface TrialRecord {
  id: number;
  year: number;
  chapterId: string;
  boss: BossId;
  writingId: number;
  passed: boolean;
  /** 판정에 쓴 값 (기준 항목 점수 또는 종합 점수) */
  value: number;
  createdAt: string;
}
export interface DrillLog {
  id: number;
  drill: string;
  /** 0~10 평균 (추상어·감각 비율 항목 제외) */
  avg: number;
  createdAt: string;
}
export interface GameState {
  name: string;
  year: number;
  yearStart: string;   // ISO — 이번 해가 시작된 시각
  seenScenes: string[];
  trials: TrialRecord[];
}
export const DEFAULT_GAME: GameState = { name: '', year: 1, yearStart: '1970-01-01T00:00:00.000Z', seenScenes: [], trials: [] };

export function getGame(db: DB): GameState {
  return { ...DEFAULT_GAME, ...(db.game ?? {}) };
}

/* ═══════════════ 활동 집계 ═══════════════ */
export interface Counts {
  writings: number;
  writtenDays: number;
  bestStreak: number;
  sentences: number;
  copies: number;
  expressions: number;
  bookNotes: number;
  booksDone: number;
  drills: number;
  missions: number;
  proofreads: number;
  charsOver: (min: number) => number;
  byType: (type: string) => number;
}

function longestStreak(days: string[]): number {
  const set = new Set(days);
  let best = 0;
  set.forEach(d => {
    if (set.has(addDays(d, -1))) return; // 연속 구간의 시작점에서만 센다
    let len = 1, cur = d;
    while (set.has(addDays(cur, 1))) { cur = addDays(cur, 1); len++; }
    best = Math.max(best, len);
  });
  return best;
}

export function countSince(db: DB, sinceIso: string): Counts {
  const since = sinceIso;
  const after = (iso?: string) => !!iso && iso >= since;
  const ws = db.writings.filter(w => after(w.createdAt));
  const days = Array.from(new Set(ws.map(wDay)));
  return {
    writings: ws.length,
    writtenDays: days.length,
    bestStreak: longestStreak(days),
    sentences: db.sentences.filter(s => after(s.createdAt)).length,
    copies: db.copies.filter(c => after(c.createdAt)).length,
    expressions: (db.expressionEntries ?? []).filter(e => after(e.createdAt)).length,
    bookNotes: (db.bookNotes ?? []).filter(n => after(n.createdAt)).length,
    booksDone: (db.books ?? []).filter(b => b.status === '완독' && after(b.finishedAt ?? b.createdAt)).length,
    drills: (db.drillLogs ?? []).filter(d => after(d.createdAt)).length,
    missions: db.missions.filter(m => m.completed && after(m.createdAt)).length,
    proofreads: db.writings.filter(w => w.proofread && after(w.proofreadAt ?? w.createdAt)).length,
    charsOver: (min: number) => ws.filter(w => w.text.length >= min).length,
    byType: (type: string) => ws.filter(w => w.type === type).length,
  };
}

/* ═══════════════ 스토리 진행 ═══════════════ */
export interface ReqProgress { req: Req; have: number; need: number; done: boolean }

export function reqProgress(req: Req, c: Counts, year: number): ReqProgress {
  const need = Math.max(1, Math.round(req.n * reqScale(year)));
  let have = 0;
  switch (req.kind) {
    case 'writings': have = c.writings; break;
    case 'writtenDays': have = c.writtenDays; break;
    case 'streak': have = c.bestStreak; break;
    case 'chars': have = c.charsOver(req.min ?? 0); break;
    case 'sentences': have = c.sentences; break;
    case 'copies': have = c.copies; break;
    case 'expressions': have = c.expressions; break;
    case 'bookNotes': have = c.bookNotes; break;
    case 'booksDone': have = c.booksDone; break;
    case 'drills': have = c.drills; break;
    case 'missions': have = c.missions; break;
    case 'proofreads': have = c.proofreads; break;
    case 'typeWritings': have = c.byType(req.type ?? ''); break;
  }
  const label = need === req.n ? req.label : req.label.replace(String(req.n), String(need));
  return { req: { ...req, label }, have: Math.min(have, need), need, done: have >= need };
}

/** 이 해의 기준을 반영한 시련 */
export function scaledTrial(t: Trial, year: number): Trial {
  const b = trialBoost(year);
  return {
    ...t,
    dimMin: t.dimMin != null ? Math.min(7, t.dimMin + b.dim) : undefined,
    scoreMin: t.scoreMin != null ? Math.min(75, t.scoreMin + b.score) : undefined,
    minChars: Math.round(t.minChars * (year <= 2 ? 1 : 1 + (year - 2) * 0.1)),
    rule: year <= 2 ? t.rule : `${t.rule} (심화: 기준 상향)`,
  };
}

/** 시련 판정 — 분석된 글이 기준을 넘는가 */
export function judgeTrial(t: Trial, w: WritingEntry): { passed: boolean; value: number; need: number; why: string } {
  const len = w.text.length;
  const a = w.analysis;
  if (!a) return { passed: false, value: 0, need: 0, why: '분석이 없습니다.' };
  const value = t.dim ? (a.score_breakdown?.[t.dim as Dim] ?? 0) : a.score;
  const need = t.dim ? (t.dimMin ?? 8) : (t.scoreMin ?? 60);
  if (len < t.minChars) return { passed: false, value, need, why: `${t.minChars}자 이상이어야 해요 (지금 ${len}자).` };
  if (t.maxChars && len > t.maxChars) return { passed: false, value, need, why: `${t.maxChars}자 안으로 줄여야 해요 (지금 ${len}자).` };
  if (value < need) return { passed: false, value, need, why: `${t.dim ?? '종합 점수'} ${value} / ${need}` };
  return { passed: true, value, need, why: '격파!' };
}

export type ChapterStatus = 'done' | 'current' | 'locked';
export interface ChapterView {
  chapter: Chapter;
  index: number;
  status: ChapterStatus;
  reqs: ReqProgress[];
  reqsDone: boolean;
  trial?: Trial;
  trialPassed: boolean;
  /** 시련에서 입힌 최고 피해율 0~1 (보스 체력 표시용) */
  bestHit: number;
}
export interface StoryView {
  year: number;
  chapters: ChapterView[];
  current: ChapterView | null;
  yearDone: boolean;
  clearedCount: number;
}

export function storyView(db: DB): StoryView {
  const g = getGame(db);
  const c = countSince(db, g.yearStart);
  const chs = chaptersOf(g.year);
  let blocked = false;
  const views: ChapterView[] = chs.map((ch, i) => {
    const reqs = ch.reqs.map(r => reqProgress(r, c, g.year));
    const reqsDone = reqs.every(r => r.done);
    const trial = ch.trial ? scaledTrial(ch.trial, g.year) : undefined;
    const recs = g.trials.filter(t => t.year === g.year && t.chapterId === ch.id && t.createdAt >= g.yearStart);
    const trialPassed = !trial || recs.some(t => t.passed);
    const need = trial ? (trial.dim ? (trial.dimMin ?? 8) : (trial.scoreMin ?? 60)) : 1;
    const bestHit = recs.length ? Math.min(1, Math.max(...recs.map(r => r.passed ? 1 : r.value / need))) : 0;
    let status: ChapterStatus;
    if (blocked) status = 'locked';
    else if (reqsDone && trialPassed) status = 'done';
    else { status = 'current'; blocked = true; }
    return { chapter: ch, index: i, status, reqs, reqsDone, trial, trialPassed, bestHit };
  });
  const current = views.find(v => v.status === 'current') ?? null;
  return { year: g.year, chapters: views, current, yearDone: !current, clearedCount: views.filter(v => v.status === 'done').length };
}

/* ═══════════════ 일일 숙제 (스승의 숙제) ═══════════════ */
export interface QuestDef { id: string; label: string; place: string; href: string; check: (d: DayActivity) => boolean }
export interface DayActivity {
  writings: WritingEntry[];
  chars: number;
  sentences: number;
  copies: number;
  bookNotes: number;
  expressions: number;
  studied: number;
  drills: number;
  proofreads: number;
}

const WRITE_POOL: QuestDef[] = [
  { id: 'w1', label: '글 한 편 쓰기', place: '글방', href: '/writing', check: d => d.writings.length >= 1 },
  { id: 'w300', label: '하루 300자 넘게 쓰기', place: '글방', href: '/writing', check: d => d.chars >= 300 },
  { id: 'w55', label: '분석 55점 넘는 글 쓰기', place: '글방', href: '/writing', check: d => d.writings.some(w => (w.analysis?.score ?? 0) >= 55) },
];
const INPUT_POOL: QuestDef[] = [
  { id: 'sen', label: '좋은 문장 하나 수집', place: '장터', href: '/sentence', check: d => d.sentences >= 1 },
  { id: 'cpy', label: '카피 하나 수집', place: '장터', href: '/copy', check: d => d.copies >= 1 },
  { id: 'note', label: '독서 메모 남기기', place: '서고', href: '/books', check: d => d.bookNotes >= 1 },
  { id: 'note2', label: '읽은 책에 메모 남기기', place: '서고', href: '/books', check: d => d.bookNotes >= 1 },
];
const PRACTICE_POOL: QuestDef[] = [
  { id: 'drill', label: '도장 훈련 1회', place: '수련터', href: '/training', check: d => d.drills >= 1 },
  { id: 'proof', label: '첨삭(붉은 펜) 받기', place: '글방', href: '/writing', check: d => d.proofreads >= 1 },
  { id: 'expr', label: '표현 하나 익히기', place: '사전각', href: '/expressions', check: d => d.expressions >= 1 || d.studied >= 1 },
];

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function questsFor(day: string): QuestDef[] {
  const h = hash(day);
  return [WRITE_POOL[h % WRITE_POOL.length], INPUT_POOL[(h >>> 8) % INPUT_POOL.length], PRACTICE_POOL[(h >>> 16) % PRACTICE_POOL.length]];
}

export function activityByDay(db: DB): Map<string, DayActivity> {
  const m = new Map<string, DayActivity>();
  const get = (k: string) => {
    let a = m.get(k);
    if (!a) { a = { writings: [], chars: 0, sentences: 0, copies: 0, bookNotes: 0, expressions: 0, studied: 0, drills: 0, proofreads: 0 }; m.set(k, a); }
    return a;
  };
  db.writings.forEach(w => { const a = get(wDay(w)); a.writings.push(w); a.chars += w.text.length; if (w.proofread && w.proofreadAt) get(dayKey(w.proofreadAt)).proofreads++; });
  db.sentences.forEach(s => get(dayKey(s.createdAt)).sentences++);
  db.copies.forEach(c => get(dayKey(c.createdAt)).copies++);
  (db.bookNotes ?? []).forEach(n => get(dayKey(n.createdAt)).bookNotes++);
  (db.expressionEntries ?? []).forEach(e => { get(dayKey(e.createdAt)).expressions++; if (e.lastStudiedAt) get(dayKey(e.lastStudiedAt)).studied++; });
  (db.drillLogs ?? []).forEach(d => get(dayKey(d.createdAt)).drills++);
  return m;
}

export interface QuestStatus { def: QuestDef; done: boolean }
export function todayQuests(db: DB, acts = activityByDay(db)): QuestStatus[] {
  const k = todayKey();
  const a = acts.get(k);
  return questsFor(k).map(def => ({ def, done: !!a && def.check(a) }));
}

/* ═══════════════ 주간 요괴 (약점 맞춤) ═══════════════ */
export const WEEKLY_MONSTERS: Record<Dim, { name: string; desc: string; sprite: string }> = {
  표현력: { name: '밋밋이', desc: '맛없는 표현을 먹고 사는 요괴. 표현력으로 물리친다.', sprite: 'mitmit' },
  전달력: { name: '웅얼이', desc: '할 말을 웅얼거리게 만든다. 전달력으로 물리친다.', sprite: 'ungeol' },
  구체성: { name: '뭉실이', desc: '모든 것을 뭉뚱그린다. 구체성으로 물리친다.', sprite: 'mungsil' },
  논리성: { name: '갈팡이', desc: '생각의 길을 엇갈리게 한다. 논리성으로 물리친다.', sprite: 'galpang' },
  가독성: { name: '빽빽이', desc: '문장을 숨 막히게 채운다. 가독성으로 물리친다.', sprite: 'ppaek' },
};
const DIMS: Dim[] = ['표현력', '전달력', '구체성', '논리성', '가독성'];

/** 최근 글 10편에서 평균이 가장 낮은 항목과 그 평균 */
function weakestDim(ws: WritingEntry[]): { dim: Dim; avg: number | null } {
  const an = ws.filter(w => w.analysis?.score_breakdown).slice(-10);
  if (!an.length) return { dim: '구체성', avg: null };
  let best: Dim = '구체성', min = Infinity;
  DIMS.forEach(d => {
    const avg = an.reduce((s, w) => s + (w.analysis!.score_breakdown[d] ?? 0), 0) / an.length;
    if (avg < min) { min = avg; best = d; }
  });
  return { dim: best, avg: min };
}

/** 목표 = 내 평균보다 1점 위 (4~7점 사이). 채점이 엄격해(7점=드묾) 상한을 둔다. */
export interface WeeklyView { week: string; dim: Dim; target: number; avg: number | null; defeated: boolean; best: number }
export function weeklyFor(db: DB, week: string): WeeklyView {
  const sorted = [...db.writings].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const before = sorted.filter(w => wDay(w) < week);
  const { dim, avg } = weakestDim(before);
  const target = Math.max(4, Math.min(7, Math.floor(avg ?? 4) + 1));
  const inWeek = sorted.filter(w => weekKey(wDay(w)) === week);
  const best = Math.max(0, ...inWeek.map(w => w.analysis?.score_breakdown?.[dim] ?? 0));
  return { week, dim, target, avg, defeated: best >= target, best };
}

/* ═══════════════ 인장 (업적) ═══════════════ */
export interface SealDef { id: string; name: string; desc: string; ink: number; test: (db: DB, x: SealCtx) => boolean }
interface SealCtx { all: Counts; maxStreak: number; trialsWon: number; years: number; weekly: number }

export const SEALS: SealDef[] = [
  { id: 'first', name: '첫 먹', desc: '첫 글을 썼다', ink: 20, test: (_, x) => x.all.writings >= 1 },
  { id: 'w10', name: '열 편', desc: '글 10편', ink: 40, test: (_, x) => x.all.writings >= 10 },
  { id: 'w50', name: '쉰 편', desc: '글 50편', ink: 100, test: (_, x) => x.all.writings >= 50 },
  { id: 'w100', name: '백 편', desc: '글 100편', ink: 200, test: (_, x) => x.all.writings >= 100 },
  { id: 'w365', name: '한 해의 글', desc: '글 365편', ink: 500, test: (_, x) => x.all.writings >= 365 },
  { id: 's7', name: '이레 등불', desc: '7일 연속', ink: 50, test: (_, x) => x.maxStreak >= 7 },
  { id: 's30', name: '한 달 등불', desc: '30일 연속', ink: 150, test: (_, x) => x.maxStreak >= 30 },
  { id: 's100', name: '백 일 등불', desc: '100일 연속', ink: 400, test: (_, x) => x.maxStreak >= 100 },
  { id: 'score70', name: '일흔 점', desc: '분석 70점 이상 글 (드문 점수)', ink: 150, test: db => db.writings.some(w => (w.analysis?.score ?? 0) >= 70) },
  { id: 'long', name: '긴 호흡', desc: '2,000자 넘는 글', ink: 60, test: db => db.writings.some(w => w.text.length >= 2000) },
  { id: 'types', name: '여덟 갈래', desc: '글 유형 8가지 모두 써 보기', ink: 120, test: db => new Set(db.writings.map(w => w.type)).size >= 8 },
  { id: 'sen30', name: '문장 사냥꾼', desc: '문장 30개 수집', ink: 80, test: (_, x) => x.all.sentences >= 30 },
  { id: 'cpy30', name: '장터의 귀', desc: '카피 30개 수집', ink: 80, test: (_, x) => x.all.copies >= 30 },
  { id: 'exp30', name: '사전각 단골', desc: '표현 30개 익히기', ink: 80, test: (_, x) => x.all.expressions >= 30 },
  { id: 'book1', name: '첫 완독', desc: '책 1권 완독', ink: 60, test: (_, x) => x.all.booksDone >= 1 },
  { id: 'book10', name: '서고지기', desc: '책 10권 완독', ink: 250, test: (_, x) => x.all.booksDone >= 10 },
  { id: 'drill20', name: '도장 개근', desc: '도장 훈련 20회', ink: 100, test: (_, x) => x.all.drills >= 20 },
  { id: 'proof10', name: '붉은 펜', desc: '첨삭 10번', ink: 80, test: (_, x) => x.all.proofreads >= 10 },
  { id: 'trial1', name: '첫 퇴치', desc: '시련 보스 첫 격파', ink: 60, test: (_, x) => x.trialsWon >= 1 },
  { id: 'weekly4', name: '요괴 사냥꾼', desc: '주간 요괴 4번 퇴치', ink: 120, test: (_, x) => x.weekly >= 4 },
  { id: 'year1', name: '첫해를 넘기다', desc: '첫해 이야기 완주', ink: 500, test: (_, x) => x.years >= 1 },
  { id: 'year2', name: '닫힌 서가', desc: '둘째 해 이야기 완주', ink: 800, test: (_, x) => x.years >= 2 },
];

/* ═══════════════ 먹(경험치) 계산 ═══════════════ */
export const INK = {
  writing: 20, perScore: 0.2, per200Chars: 1, maxCharBonus: 10,
  sentence: 6, analyzed: 4, copy: 6, expression: 5, bookNote: 8, bookDone: 40, book: 5,
  mission: 15, drill: 10, proofread: 5,
  quest: 15, questAll: 20, weekly: 60, trial: 120, chapter: 40,
};

export interface InkReport {
  total: number;
  parts: { label: string; ink: number }[];
  seals: { def: SealDef; got: boolean }[];
  weeklyWins: number;
  questDays: number;
}

export function computeInk(db: DB): InkReport {
  const g = getGame(db);
  const parts: { label: string; ink: number }[] = [];
  const add = (label: string, ink: number) => { if (ink) parts.push({ label, ink: Math.round(ink) }); };

  add('글쓰기', db.writings.reduce((s, w) => s + INK.writing + (w.analysis ? w.analysis.score * INK.perScore : 0) + Math.min(INK.maxCharBonus, Math.floor(w.text.length / 200) * INK.per200Chars), 0));
  add('문장 수집', db.sentences.reduce((s, x) => s + INK.sentence + (x.analysis ? INK.analyzed : 0), 0));
  add('카피 수집', db.copies.reduce((s, x) => s + INK.copy + (x.analysis ? INK.analyzed : 0), 0));
  add('표현 사전', (db.expressionEntries ?? []).reduce((s, x) => s + INK.expression + (x.analysis ? 3 : 0), 0));
  add('독서', (db.bookNotes ?? []).length * INK.bookNote + (db.books ?? []).length * INK.book + (db.books ?? []).filter(b => b.status === '완독').length * INK.bookDone);
  add('훈련·과제', (db.drillLogs ?? []).length * INK.drill + db.missions.filter(m => m.completed).length * INK.mission);
  add('첨삭', db.writings.filter(w => w.proofread).length * INK.proofread);

  // 일일 숙제 — 활동이 있었던 모든 날에 대해 소급 계산
  const acts = activityByDay(db);
  let questInk = 0, questDays = 0;
  acts.forEach((a, day) => {
    const qs = questsFor(day).map(q => q.check(a));
    const n = qs.filter(Boolean).length;
    questInk += n * INK.quest + (n === 3 ? INK.questAll : 0);
    if (n === 3) questDays++;
  });
  add('스승의 숙제', questInk);

  // 주간 요괴
  const weeks = new Set(db.writings.map(w => weekKey(wDay(w))));
  let weeklyWins = 0;
  weeks.forEach(wk => { if (weeklyFor(db, wk).defeated) weeklyWins++; });
  add('주간 요괴', weeklyWins * INK.weekly);

  // 시련·장 — 지난 해들은 전부 완주로 치고, 이번 해는 진행분만
  const trialsWon = new Set(g.trials.filter(t => t.passed).map(t => `${t.year}:${t.chapterId}`)).size;
  add('시련 격파', trialsWon * INK.trial);
  const sv = storyView(db);
  const pastChapters = Array.from({ length: g.year - 1 }, (_, i) => chaptersOf(i + 1).length).reduce((a, b) => a + b, 0);
  add('이야기 진행', (pastChapters + sv.clearedCount) * INK.chapter);

  // 인장
  const all = countSince(db, DEFAULT_GAME.yearStart);
  const ctx: SealCtx = { all, maxStreak: Math.max(all.bestStreak, db.journey?.maxStreak ?? 0), trialsWon, years: g.year - 1, weekly: weeklyWins };
  const seals = SEALS.map(def => ({ def, got: def.test(db, ctx) }));
  add('인장', seals.filter(s => s.got).reduce((s, x) => s + x.def.ink, 0));

  return { total: parts.reduce((s, p) => s + p.ink, 0), parts, seals, weeklyWins, questDays };
}

/* ═══════════════ 등급 ═══════════════ */
export const MAX_LEVEL = 60;
export function inkForLevel(l: number) { return l <= 1 ? 0 : Math.round(60 * Math.pow(l - 1, 1.7)); }

export interface RankTier { from: number; title: string; color: string; robe: string }
export const RANKS: RankTier[] = [
  { from: 1, title: '견습 글꾼', color: '#8f8fb8', robe: '#5a5a8a' },
  { from: 6, title: '글꾼', color: '#37c4ff', robe: '#1f6fa8' },
  { from: 12, title: '문장가', color: '#7cff6b', robe: '#3e8e41' },
  { from: 20, title: '이야기꾼', color: '#ff8c42', robe: '#b0562a' },
  { from: 30, title: '작가', color: '#f15bb5', robe: '#8e2f6f' },
  { from: 42, title: '대가', color: '#f7e26b', robe: '#c8961e' },
];

export interface LevelInfo { level: number; rank: RankTier; ink: number; cur: number; next: number | null; progress: number }
export function levelInfo(ink: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && ink >= inkForLevel(level + 1)) level++;
  const rank = [...RANKS].reverse().find(r => level >= r.from) ?? RANKS[0];
  const cur = inkForLevel(level);
  const next = level < MAX_LEVEL ? inkForLevel(level + 1) : null;
  const progress = next ? Math.min(1, (ink - cur) / (next - cur)) : 1;
  return { level, rank, ink, cur, next, progress };
}

/* ═══════════════ 등불(연속 기록)과 안개 ═══════════════ */
export function currentStreak(db: DB): number {
  const days = new Set(db.writings.map(wDay));
  let k = todayKey();
  if (!days.has(k)) k = addDays(k, -1); // 오늘 아직 안 썼으면 어제부터
  let n = 0;
  while (days.has(k)) { n++; k = addDays(k, -1); }
  return n;
}
/** 0(맑음)~1(짙음). 마지막 글 이후 지난 날수로 계산 */
export function fogLevel(db: DB): number {
  if (!db.writings.length) return 0.6;
  const last = db.writings.map(wDay).sort().pop()!;
  const [y, m, d] = last.split('-').map(Number);
  const gap = Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86400000);
  return Math.max(0, Math.min(1, (gap - 1) / 6));
}

/* ═══════════════ 스냅샷 (변화 감지용) ═══════════════ */
export interface GameSnapshot {
  ink: number;
  level: number;
  quests: string[];
  seals: string[];
  chapterId: string | null;
  yearDone: boolean;
}
export function snapshot(db: DB): GameSnapshot {
  const r = computeInk(db);
  const sv = storyView(db);
  return {
    ink: r.total,
    level: levelInfo(r.total).level,
    quests: todayQuests(db).filter(q => q.done).map(q => q.def.id),
    seals: r.seals.filter(s => s.got).map(s => s.def.id),
    chapterId: sv.current?.chapter.id ?? null,
    yearDone: sv.yearDone,
  };
}

export { getYear };
