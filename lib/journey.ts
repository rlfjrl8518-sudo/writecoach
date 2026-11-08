import type { DB, WritingEntry, Journey } from './db';
import type { Emotion } from './curriculum';

/* ═══════════════════════════════════════════════════════════════
   연속 기록(등불) — 글을 저장할 때 갱신한다.
   등급·이야기·인장 등 게임 요소는 lib/game.ts에서 파생 계산한다.
═══════════════════════════════════════════════════════════════ */

/* 연속 기록 배지 (legacy, journey.badges에 남는다) */
export const STREAK_BADGES = [3, 7, 30, 100];

/** 분석 점수 → 스승의 표정과 한마디 */
export function getScoreEmotion(score: number): { emotion: Emotion; message: string } {
  // 채점이 엄격하다(5점=평균, 7점=드묾, 괜찮은 글이 40~50점대) — 표정 기준도 그에 맞춘다
  if (score >= 70) return { emotion: 'happy', message: '허, 이건 남겨 둘 만한 글이군.' };
  if (score >= 55) return { emotion: 'happy', message: '단단해졌군. 어제의 자네보다 낫군.' };
  if (score >= 40) return { emotion: 'default', message: '나쁘지 않다. 약점 하나만 고쳐 보게.' };
  return { emotion: 'think', message: '괜찮다. 써낸 것만으로 먹이 쌓였어.' };
}

/** 마지막 기록일이 어제/오늘이 아니면(등불이 꺼졌으면) true */
export function isStreakBroken(journey: Journey | undefined): boolean {
  if (!journey?.lastWriteDate) return false;
  return journey.lastWriteDate !== todayStr() && journey.lastWriteDate !== yesterdayStr();
}

export function getWrittenDays(writings: WritingEntry[]): number {
  return new Set(writings.map(w => w.date)).size;
}
export function getWritingCount(db: DB): number {
  return db.writings.length;
}

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 새 글을 db.writings에 push한 *뒤* 호출한다. db.journey(연속 기록)를 갱신한다.
 * (호출 순서: db.writings.push(entry) → updateJourneyOnWrite(db) → saveDB(db))
 */
export function updateJourneyOnWrite(db: DB): { streak: number; newStreakBadge: number | null } {
  const today = todayStr();
  const j = db.journey ?? { lastWriteDate: '', streak: 0, maxStreak: 0, badges: [] };
  if (j.lastWriteDate === today) {
    // 이미 오늘 기록함 — 유지
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
  return { streak: j.streak, newStreakBadge };
}
