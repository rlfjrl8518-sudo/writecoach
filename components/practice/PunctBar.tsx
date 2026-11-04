'use client';
import type { RefObject } from 'react';

/* 모바일 글쓰기용 문장부호 빠른 입력 (무제노트 참고) — 커서 위치에 끼워 넣는다 */
const MARKS = ['.', ',', '?', '!', '…', '—', '·', '“ ”', '‘ ’', '「 」', '( )', '~'];

export default function PunctBar({ target, value, onChange }: {
  target: RefObject<HTMLTextAreaElement>; value: string; onChange: (v: string) => void;
}) {
  function insert(mark: string) {
    const el = target.current;
    const pair = mark.includes(' ') ? mark.split(' ') : null;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const sel = value.slice(start, end);
    const ins = pair ? `${pair[0]}${sel}${pair[1]}` : mark;
    const next = value.slice(0, start) + ins + value.slice(end);
    onChange(next);
    const caret = pair ? start + pair[0].length + sel.length : start + ins.length;
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(caret, caret); });
  }
  return (
    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '6px 0', WebkitOverflowScrolling: 'touch' }} aria-label="문장부호 넣기">
      {MARKS.map(m => (
        <button key={m} type="button" className="g-btn sm" style={{ margin: 2, minWidth: 34, flexShrink: 0 }}
          onMouseDown={e => e.preventDefault()} onClick={() => insert(m)}>{m.replace(' ', '')}</button>
      ))}
    </div>
  );
}
