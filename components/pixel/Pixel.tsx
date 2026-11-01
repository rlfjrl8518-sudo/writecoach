'use client';
import type { CSSProperties } from 'react';
import type { SpriteDef, Emotion } from './sprites';
import { speakerSprite, monster } from './sprites';
import type { SpeakerId } from '@/lib/curriculum';

/** 격자 → SVG. 가로로 이어진 같은 색 칸은 하나의 rect로 합친다. */
export function PixelArt({ sprite, size = 64, flip, className, style, title }: {
  sprite: SpriteDef; size?: number; flip?: boolean; className?: string; style?: CSSProperties; title?: string;
}) {
  const h = sprite.grid.length;
  const w = Math.max(...sprite.grid.map(r => r.length));
  const rects: JSX.Element[] = [];
  sprite.grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === '.' || !sprite.palette[c]) { x++; continue; }
      let len = 1;
      while (x + len < row.length && row[x + len] === c) len++;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={len} height={1} fill={sprite.palette[c]} />);
      x += len;
    }
  });
  return (
    <svg
      className={`sprite ${className ?? ''}`}
      viewBox={`0 0 ${w} ${h}`}
      width={size} height={size * h / w}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', transform: flip ? 'scaleX(-1)' : undefined, ...style }}
    >
      {rects}
    </svg>
  );
}

export function Speaker({ id, emotion, size = 64, robe, className, flip, style }: {
  id: SpeakerId; emotion?: Emotion; size?: number; robe?: { robe: string; color: string }; className?: string; flip?: boolean; style?: CSSProperties;
}) {
  const s = speakerSprite(id, emotion, robe);
  if (!s) return null;
  return <PixelArt sprite={s} size={size} className={className} flip={flip} style={style} />;
}

export function Monster({ id, size = 96, className, style }: { id: string; size?: number; className?: string; style?: CSSProperties }) {
  return <PixelArt sprite={monster(id)} size={size} className={className} style={style} />;
}
