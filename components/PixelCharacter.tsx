'use client';
import { useState, useEffect, useMemo } from 'react';

/* ── 픽셀 아트 설정 ── */
const PX = 4; // 1픽셀 = 4px

const C: Record<number, string> = {
  1: '#1a1a1a', // 모자/구두
  2: '#3d3d3d', // 챙
  3: '#f5c899', // 피부
  4: '#a78bfa', // 안경 (보랏빛 accent)
  5: '#1e1e4a', // 두루마기
  6: '#e8dcc8', // 깃/셔츠
  7: '#ffd97d', // 만년필 (달빛)
  8: '#6b3a2a', // 입
  9: '#0a0a0a', // 동공
};

/* 16×20 기본 그리드 */
const BASE: number[][] = [
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,0,0,3,3,3,3,3,3,3,3,0,0,0,0],
  [0,0,0,0,3,3,3,3,3,3,3,3,0,0,0,0],
  [0,0,0,0,3,3,3,3,3,3,3,3,0,0,0,0],
  [0,0,0,0,4,4,4,0,4,4,4,0,0,0,0,0],
  [0,0,0,0,4,9,4,4,4,9,4,0,0,0,0,0],
  [0,0,0,0,4,4,4,0,4,4,4,0,0,0,0,0],
  [0,0,0,0,3,3,8,8,8,3,3,0,0,0,0,0], // row 10 = 입 (교체)
  [0,0,0,0,3,3,3,3,3,3,3,0,0,0,0,0],
  [0,0,0,5,5,6,6,6,6,5,5,5,7,0,0,0],
  [0,0,5,5,5,6,6,6,6,5,5,5,7,0,0,0],
  [0,5,5,5,5,6,6,6,6,5,5,5,0,0,0,0],
  [0,5,5,5,0,0,0,0,0,0,5,5,0,0,0,0],
  [0,5,5,0,0,0,0,0,0,0,0,5,0,0,0,0],
  [0,0,5,0,0,0,0,0,0,0,0,5,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

/* 점수별 입 모양 (row 10) */
const MOUTHS: Record<string, number[]> = {
  default: [0,0,0,0,3,3,8,8,8,3,3,0,0,0,0,0],
  happy:   [0,0,0,3,8,8,8,8,8,8,3,0,0,0,0,0],
  content: [0,0,0,0,3,3,8,8,3,3,0,0,0,0,0,0],
  neutral: [0,0,0,0,3,3,3,8,3,3,3,0,0,0,0,0],
  sad:     [0,0,0,0,3,8,3,3,3,8,3,0,0,0,0,0],
  serious: [0,0,0,3,8,8,8,8,8,8,8,3,0,0,0,0],
};

const MSGS: Record<string, string> = {
  default: '오늘도 한 줄을\n남기는군요.',
  happy:   '별이 빛나는\n밤이오.',
  content: '꽤 단단한\n문장이오.',
  neutral: '조금 더\n다듬어보시오.',
  sad:     '문장이 아직\n떨리는군요.',
  serious: '다시, 처음부터\n써보시오.',
};

function getExpr(score: number | null): string {
  if (score === null) return 'default';
  if (score >= 90) return 'happy';
  if (score >= 80) return 'content';
  if (score >= 70) return 'neutral';
  if (score >= 60) return 'sad';
  return 'serious';
}

function makeShadow(grid: number[][]): string {
  const parts: string[] = [];
  grid.forEach((row, y) => {
    row.forEach((c, x) => {
      if (c && C[c]) parts.push(`${x * PX}px ${y * PX}px 0 0 ${C[c]}`);
    });
  });
  return parts.join(', ');
}

export default function PixelCharacter() {
  const [score, setScore] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ score: number }>;
      setScore(ce.detail.score);
      setOpen(true);
      setTimeout(() => setOpen(false), 4000);
    };
    window.addEventListener('score-updated', handler);
    return () => window.removeEventListener('score-updated', handler);
  }, []);

  const expr = getExpr(score);

  const shadow = useMemo(() => {
    const grid = BASE.map((row, i) => i === 10 ? MOUTHS[expr] : row);
    return makeShadow(grid);
  }, [expr]);

  const W = BASE[0].length * PX; // 64px
  const H = BASE.length * PX;    // 80px

  return (
    <div
      className="fixed-char"
      style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }}
    >
      {/* 말풍선 */}
      {open && (
        <div className="speech-bubble" style={{ bottom: H - 10 }}>
          <span className="bubble-label">✦ 작가 선생님</span>
          {MSGS[expr].split('\n').map((line, i) => (
            <span key={i}>{line}{i < MSGS[expr].split('\n').length - 1 && <br />}</span>
          ))}
        </div>
      )}

      {/* 도트 캐릭터 */}
      <div
        onClick={() => setOpen(o => !o)}
        title="클릭하면 말씀하세요"
        style={{
          width: W, height: H,
          position: 'relative', cursor: 'pointer',
          imageRendering: 'pixelated',
          animation: 'float-up 4s ease-in-out infinite',
        }}
      >
        <div
          style={{
            position: 'absolute', top: 0, left: 0,
            width: PX, height: PX,
            boxShadow: shadow,
            imageRendering: 'pixelated',
          }}
        />
      </div>
    </div>
  );
}
