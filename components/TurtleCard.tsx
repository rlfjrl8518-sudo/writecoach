'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DB } from '@/lib/db';
import { getWrittenDays, getLevelInfo, getNextLevelInfo, getLevelProgress, toTurtleLevel, isStreakBroken } from '@/lib/journey';
import TurtleSprite from './TurtleSprite';

export default function TurtleCard({ db }: { db: DB }) {
  const router = useRouter();
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    const handler = () => {
      setBounce(true);
      setTimeout(() => setBounce(false), 500);
    };
    window.addEventListener('turtle-bounce', handler);
    return () => window.removeEventListener('turtle-bounce', handler);
  }, []);

  const days = getWrittenDays(db.writings);
  const level = getLevelInfo(days);
  const next = getNextLevelInfo(days);
  const progress = getLevelProgress(days);
  const streak = db.journey?.streak ?? 0;
  const broken = isStreakBroken(db.journey);

  return (
    <div
      className="px-card"
      onClick={() => router.push('/journey')}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 16, cursor: 'pointer',
      }}
    >
      <div className={bounce ? 'turtle-bounce' : undefined} style={{ flexShrink: 0 }}>
        <TurtleSprite
          level={toTurtleLevel(level.level)}
          emotion={broken ? 'tired' : 'default'}
          size={64}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Lv.{level.level} {level.name}
          </span>
          {!broken && streak > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--moon)' }}>🔥 {streak}일 연속</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: broken ? 'var(--bad)' : 'var(--dim-star)', marginBottom: 8 }}>
          {broken ? '오늘부터 다시 시작해요' : level.quote}
        </div>
        <div style={{ height: 6, background: 'var(--secondary-soft)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, background: 'var(--secondary)',
            width: `${progress}%`, transition: 'width 0.5s ease',
          }} />
        </div>
        {next && (
          <div style={{ fontSize: 10.5, color: 'var(--dim-star)', marginTop: 4 }}>
            다음 단계까지 {Math.max(0, next.days - days)}일
          </div>
        )}
      </div>
    </div>
  );
}
