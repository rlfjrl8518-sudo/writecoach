'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDB, type DB } from '@/lib/db';
import {
  LEVELS, REGIONS, SHELL_MILESTONES, STREAK_BADGES,
  getWrittenDays, getWritingCount, getLevelInfo, getCurrentRegion, getUnlockedShells,
} from '@/lib/journey';
import TurtleImage from '@/components/TurtleImage';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="px-sec-title" style={{ marginBottom: 14 }}>{children}</div>;
}

export default function JourneyPage() {
  const [db, setDb] = useState<DB | null>(null);
  useEffect(() => { setDb(loadDB()); }, []);
  if (!db) return null;

  const days = getWrittenDays(db.writings);
  const writingCount = getWritingCount(db);
  const level = getLevelInfo(days);
  const region = getCurrentRegion(days);
  const unlockedShells = getUnlockedShells(writingCount);
  const streak = db.journey?.streak ?? 0;
  const maxStreak = db.journey?.maxStreak ?? 0;
  const badges = db.journey?.badges ?? [];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Link href="/" style={{ textDecoration: 'none', fontSize: 12, color: 'var(--dim-star)' }}>← 홈으로</Link>

      {/* 1. 현재 거북이 */}
      <div style={{ textAlign: 'center', padding: '24px 0 32px' }}>
        <TurtleImage src={`/turtle/level-${level.level}.png`} fallback="🐢" alt={level.name} size={120} />
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 14, letterSpacing: '-0.02em' }}>
          Lv.{level.level} {level.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--dim-star)', marginTop: 4 }}>{level.quote}</div>
        <div style={{ fontSize: 12, color: 'var(--dim-star)', marginTop: 10 }}>
          누적 작성일 <strong style={{ color: 'var(--text)' }}>{days}일</strong> · 작성 글 <strong style={{ color: 'var(--text)' }}>{writingCount}편</strong>
        </div>
      </div>

      {/* 2. 성장 단계 타임라인 */}
      <SectionTitle>✦ 성장 단계</SectionTitle>
      <div className="px-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {LEVELS.map((l, i) => {
            const done = days >= l.days && l.level !== level.level;
            const current = l.level === level.level;
            const locked = days < l.days;
            return (
              <div key={l.level} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: current ? 'var(--moon)' : done ? 'var(--secondary)' : 'var(--secondary-soft)',
                    color: current || done ? 'var(--on-accent)' : 'var(--dim-star)',
                  }}>
                    {done ? '✓' : l.level === 1 ? '' : ''}
                  </div>
                  {i < LEVELS.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 22, background: days >= LEVELS[i + 1].days ? 'var(--secondary)' : 'var(--secondary-soft)' }} />
                  )}
                </div>
                <div style={{ paddingBottom: 18, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: current ? 'var(--moon)' : locked ? 'var(--text-disabled)' : 'var(--text)',
                    }}>
                      Lv.{l.level} {l.name}
                    </span>
                    {locked && <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>· {l.days}일 필요</span>}
                  </div>
                  <div style={{ fontSize: 12, color: locked ? 'var(--text-disabled)' : 'var(--dim-star)', marginTop: 2 }}>
                    {l.quote}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 등껍질 무늬 컬렉션 */}
      <SectionTitle>✦ 등껍질 무늬 컬렉션</SectionTitle>
      <div className="px-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {SHELL_MILESTONES.map(m => {
            const unlocked = unlockedShells.includes(m);
            return (
              <div key={m} style={{ textAlign: 'center' }}>
                <div style={{ filter: unlocked ? 'none' : 'grayscale(1) opacity(0.35)' }}>
                  <TurtleImage src={`/turtle/shell-${m}.png`} fallback="✦" alt={`${m}편 무늬`} size={56} style={{ margin: '0 auto' }} />
                </div>
                <div style={{ fontSize: 11, color: unlocked ? 'var(--text)' : 'var(--text-disabled)', marginTop: 6, fontWeight: unlocked ? 700 : 400 }}>
                  {m}편
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. 연속 기록 배지 */}
      <SectionTitle>✦ 연속 기록 배지</SectionTitle>
      <div className="px-card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--dim-star)', marginBottom: 12 }}>
          현재 {streak}일 연속 · 최고 기록 {maxStreak}일
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {STREAK_BADGES.map(b => {
            const earned = badges.includes(`streak${b}`);
            return (
              <div key={b} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 16px', borderRadius: 12,
                background: earned ? 'var(--moon-dim)' : 'var(--bg-subtle)',
                border: `1px solid ${earned ? 'var(--moon)' : 'var(--card-border)'}`,
                minWidth: 64,
              }}>
                <span style={{ fontSize: 18 }}>{earned ? '🔥' : '🔒'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: earned ? 'var(--moon)' : 'var(--text-disabled)' }}>{b}일</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. 여행 맵 */}
      <SectionTitle>✦ 여행 맵</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
        {REGIONS.map(r => {
          const unlocked = days >= r.minDays;
          const current = r.name === region.name;
          const rangeLabel = r.maxDays === Infinity ? `${r.minDays}일+` : `${r.minDays}~${r.maxDays}일`;
          return (
            <div
              key={r.name}
              className="px-card"
              style={{
                padding: 16,
                border: current ? '1.5px solid var(--moon)' : '1px solid var(--card-border)',
                background: current ? 'var(--moon-dim)' : 'var(--bg-card)',
                opacity: unlocked ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: current ? 'var(--moon)' : 'var(--text)' }}>
                  {r.name}
                </span>
                {!unlocked && <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>🔒</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim-star)', marginBottom: 6 }}>{rangeLabel}</div>
              <div style={{ fontSize: 12, color: unlocked ? 'var(--text)' : 'var(--text-disabled)', lineHeight: 1.6 }}>
                {r.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
