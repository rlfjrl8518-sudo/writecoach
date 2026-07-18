'use client';
import { useEffect, useRef, useState } from 'react';
import { popPendingCelebration, toTurtleLevel, type CelebrationItem } from '@/lib/journey';
import TurtleImage from './TurtleImage';
import TurtleSprite from './TurtleSprite';

const CONFETTI_COLORS = ['var(--secondary)', 'var(--moon)', 'var(--accent)', 'var(--good)'];

function Confetti() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: `${(i * 53) % 100}%`,
          top: -20,
          width: 7, height: 7,
          borderRadius: i % 3 === 0 ? '50%' : 2,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animation: `confetti-fall ${1.1 + (i % 5) * 0.15}s ease-in forwards`,
          animationDelay: `${(i % 6) * 0.05}s`,
        }} />
      ))}
    </div>
  );
}

export default function CelebrationModal() {
  const [item, setItem] = useState<CelebrationItem | null>(null);
  const popped = useRef(false);

  useEffect(() => {
    if (popped.current) return;
    popped.current = true;
    setItem(popPendingCelebration());
  }, []);

  if (!item) return null;

  const title = item.type === 'level' ? `${item.level.name}가 되었어요!` : '새 등껍질 무늬를 얻었어요!';
  const desc = item.type === 'level'
    ? `Lv.${item.level.level} · ${item.level.quote}`
    : `누적 ${item.milestone}편 달성`;

  return (
    <div
      onClick={() => setItem(null)}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="px-card animate-fade-in"
        style={{
          position: 'relative', maxWidth: 320, width: '100%',
          textAlign: 'center', padding: '36px 24px 28px',
        }}
      >
        <Confetti />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {item.type === 'level' ? (
            <TurtleSprite level={toTurtleLevel(item.level.level)} emotion="happy" size={88} />
          ) : (
            <TurtleImage src={`/turtle/shell-${item.milestone}.png`} fallback="✦" alt={title} size={88} />
          )}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.01em' }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.7 }}>
          {desc}
        </div>
        <button className="px-btn px-btn-accent" onClick={() => setItem(null)}>확인</button>
      </div>
    </div>
  );
}
