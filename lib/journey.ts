import type { DB, WritingEntry } from './db';

/* ── 성장 단계 ── */
export interface LevelDef { level: number; name: string; days: number; quote: string; }
export const LEVELS: LevelDef[] = [
  { level: 1,   name: '새끼 거북',   days: 0,   quote: '이제 첫 글을 씁니다.' },
  { level: 10,  name: '어린 거북',   days: 10,  quote: '작은 무늬가 생겼어요!' },
  { level: 20,  name: '청소년 거북', days: 20,  quote: '조금 더 단단해졌어요!' },
  { level: 35,  name: '성체 거북',   days: 35,  quote: '꾸준함이 힘이 되었어요.' },
  { level: 50,  name: '베테랑 거북', days: 50,  quote: '많은 이야기가 쌓였어요.' },
  { level: 70,  name: '현자 거북',   days: 70,  quote: '지혜가 등껍질에 새겨졌어요.' },
  { level: 100, name: '노장 거북',   days: 100, quote: '당신은 위대한 이야기꾼입니다.' },
];

/* ── 등껍질 무늬 (누적 편수) ── */
export const SHELL_MILESTONES = [10, 30, 50, 100, 200, 300];

/* ── 연속 기록 배지 ── */
export const STREAK_BADGES = [3, 7, 30, 100];

/* ── 여행 맵 8개 지역 (누적 작성일 기준) ── */
export interface RegionDef { name: string; minDays: number; maxDays: number; desc: string; }
export const REGIONS: RegionDef[] = [
  { name: '숲의 시작',   minDays: 0,   maxDays: 9,       desc: '모든 이야기는 첫 걸음에서 시작돼요.' },
  { name: '졸졸 강가',   minDays: 10,  maxDays: 29,      desc: '흘러가는 생각들이 글이 되어 흐릅니다.' },
  { name: '드넓은 들판', minDays: 30,  maxDays: 59,      desc: '마음껏 상상하고 자유롭게 써내려가요.' },
  { name: '뜨거운 사막', minDays: 60,  maxDays: 99,      desc: '어려운 순간도 이겨내며 앞으로 나아가요.' },
  { name: '높은 산길',   minDays: 100, maxDays: 179,     desc: '더 높이, 더 멀리 나의 한계를 넘어요.' },
  { name: '푸른 바다',   minDays: 180, maxDays: 299,     desc: '넓은 세상 속에서 나만의 목소리를 찾아요.' },
  { name: '거대한 나무', minDays: 300, maxDays: 499,     desc: '수많은 이야기가 모여 큰 힘이 됩니다.' },
  { name: '지혜의 도서관', minDays: 500, maxDays: Infinity, desc: '당신의 모든 이야기가 책이 되어 빛나요.' },
];

/* ── 감정 거북이 ── */
export type Emotion = 'happy' | 'proud' | 'thinking' | 'tired' | 'fail';
export interface EmotionDef { key: Emotion; emoji: string; label: string; message: string; }
export function getEmotion(score: number): EmotionDef {
  if (score >= 90) return { key: 'happy',    emoji: '🐢✨', label: '기쁨', message: '정말 멋진 글이에요!' };
  if (score >= 80) return { key: 'proud',    emoji: '🐢',   label: '뿌듯', message: '뿌듯한 결과예요.' };
  if (score >= 70) return { key: 'thinking', emoji: '🐢💭', label: '고민', message: '조금만 더 다듬어봐요.' };
  if (score >= 60) return { key: 'tired',    emoji: '🐢💧', label: '지침', message: '오늘도 애쓰셨어요.' };
  return { key: 'fail', emoji: '🐢💦', label: '실패', message: '괜찮아요, 다음 글로 더 좋아질 거예요.' };
}

/* ── 파생 계산 (저장 없이 매번 writings에서 계산) ── */
export function getWrittenDays(writings: WritingEntry[]): number {
  return new Set(writings.map(w => w.date)).size;
}
export function getWritingCount(db: DB): number {
  return db.writings.length;
}

export function getLevelInfo(days: number): LevelDef {
  let cur = LEVELS[0];
  for (const l of LEVELS) { if (days >= l.days) cur = l; else break; }
  return cur;
}
export function getNextLevelInfo(days: number): LevelDef | null {
  return LEVELS.find(l => l.days > days) ?? null;
}
export function getLevelProgress(days: number): number {
  const cur = getLevelInfo(days);
  const next = getNextLevelInfo(days);
  if (!next) return 100;
  const span = next.days - cur.days;
  if (span <= 0) return 100;
  return Math.min(100, Math.round(((days - cur.days) / span) * 100));
}

export function getCurrentRegion(days: number): RegionDef {
  return REGIONS.find(r => days >= r.minDays && days <= r.maxDays) ?? REGIONS[REGIONS.length - 1];
}

export function getUnlockedShells(writingCount: number): number[] {
  return SHELL_MILESTONES.filter(m => writingCount >= m);
}

/* ── 글 저장 시 스트릭 갱신 ── */
export interface JourneyUpdateResult {
  leveledUp: boolean;
  prevLevel: LevelDef;
  newLevel: LevelDef;
  newShellMilestone: number | null;
  newStreakBadge: number | null;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * writings 배열에 새 글을 push하기 *전* 상태로 호출한다.
 * db.journey를 직접 갱신하고, 레벨업/무늬 획득 여부를 반환한다.
 * (호출 순서: db.writings.push(entry) → updateJourneyOnWrite(db) → saveDB(db))
 */
export function updateJourneyOnWrite(db: DB): JourneyUpdateResult {
  const prevDays = getWrittenDays(db.writings.slice(0, -1));
  const prevCount = Math.max(0, db.writings.length - 1);
  const prevLevel = getLevelInfo(prevDays);

  const today = todayStr();
  const j = db.journey ?? { lastWriteDate: '', streak: 0, maxStreak: 0, badges: [] };
  if (j.lastWriteDate === today) {
    // 이미 오늘 기록함 — streak 유지
  } else if (j.lastWriteDate === yesterdayStr()) {
    j.streak += 1;
  } else {
    j.streak = 1;
  }
  j.lastWriteDate = today;
  j.maxStreak = Math.max(j.maxStreak ?? 0, j.streak);

  let newStreakBadge: number | null = null;
  for (const b of STREAK_BADGES) {
    const key = `streak${b}`;
    if (j.streak >= b && !j.badges.includes(key)) {
      j.badges.push(key);
      newStreakBadge = b;
    }
  }
  db.journey = j;

  const newDays = getWrittenDays(db.writings);
  const newLevel = getLevelInfo(newDays);
  const newCount = db.writings.length;

  let newShellMilestone: number | null = null;
  for (const m of SHELL_MILESTONES) {
    if (newCount >= m && prevCount < m) newShellMilestone = m;
  }

  return {
    leveledUp: newLevel.level !== prevLevel.level,
    prevLevel,
    newLevel,
    newShellMilestone,
    newStreakBadge,
  };
}

/* ── 홈 진입 시 1회 축하 모달 큐 (localStorage, DB와 별도) ── */
export type CelebrationItem =
  | { type: 'level'; level: LevelDef }
  | { type: 'shell'; milestone: number };

const PENDING_KEY = 'wc_journey_pending';

export function pushPendingCelebration(item: CelebrationItem) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const list: CelebrationItem[] = raw ? JSON.parse(raw) : [];
    list.push(item);
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch { /* */ }
}

export function popPendingCelebration(): CelebrationItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const list: CelebrationItem[] = raw ? JSON.parse(raw) : [];
    if (!list.length) return null;
    const [first, ...rest] = list;
    localStorage.setItem(PENDING_KEY, JSON.stringify(rest));
    return first;
  } catch { return null; }
}
