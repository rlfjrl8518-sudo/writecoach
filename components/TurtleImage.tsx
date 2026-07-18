'use client';
import { useState } from 'react';

interface Props {
  src: string;
  fallback: string;
  alt: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

/** public/turtle/ 이미지를 시도하고, 없으면 이모지로 대체 */
export default function TurtleImage({ src, fallback, alt, size = 64, style, className }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={className}
        role="img"
        aria-label={alt}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, fontSize: size * 0.62, lineHeight: 1,
          ...style,
        }}
      >
        {fallback}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block', ...style }}
    />
  );
}
