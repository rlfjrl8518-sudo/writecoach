'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadDB, type WritingEntry, type SentenceEntry, type CopyEntry } from '@/lib/db';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type DayItem =
  | { kind: 'writing'; id: number; label: string; text: string }
  | { kind: 'sentence'; id: number; label: string; text: string }
  | { kind: 'copy'; id: number; label: string; text: string };

const KIND_STYLE: Record<DayItem['kind'], { color: string; label: string; href: (id: number) => string }> = {
  writing:  { color: 'var(--accent)', label: '글쓰기',   href: id => `/writing?focus=${id}` },
  sentence: { color: 'var(--good)',   label: '문장 수집', href: id => `/sentence?focus=${id}` },
  copy:     { color: 'var(--moon)',   label: '카피 수집', href: id => `/copy?focus=${id}` },
};

function localKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selected,  setSelected]  = useState<string | null>(null);
  const [writings,  setWritings]  = useState<WritingEntry[]>([]);
  const [sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [copies,    setCopies]    = useState<CopyEntry[]>([]);

  useEffect(() => {
    const db = loadDB();
    setWritings(db.writings);
    setSentences(db.sentences);
    setCopies(db.copies);
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (key: string, item: DayItem) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    };
    writings.forEach(w => push(w.date, { kind: 'writing', id: w.id, label: w.type, text: w.topic || w.text.slice(0, 30) }));
    sentences.forEach(s => push(localKey(s.createdAt), { kind: 'sentence', id: s.id, label: s.type || '문장', text: s.sentence.slice(0, 30) }));
    copies.forEach(c => push(localKey(c.createdAt), { kind: 'copy', id: c.id, label: c.brand || '카피', text: c.copy.slice(0, 30) }));
    return map;
  }, [writings, sentences, copies]);

  const todayKey = localKey(today.toISOString());

  const cells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const list: ({ key: string; day: number } | null)[] = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ key: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d });
    }
    return list;
  }, [viewYear, viewMonth]);

  function changeMonth(delta: number) {
    let y = viewYear, m = viewMonth + delta;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewYear(y); setViewMonth(m); setSelected(null);
  }

  function goToday() {
    setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelected(todayKey);
  }

  const selectedItems = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>暦 달력</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        글쓰기·문장 수집·카피 수집 기록을 날짜별로 모아 봐요.
      </p>

      <div className="px-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={() => changeMonth(-1)} className="px-btn-ghost-sm" style={{ fontSize: 14, padding: '4px 10px' }}>‹</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'Pretendard, sans-serif' }}>
              {viewYear}년 {viewMonth + 1}월
            </span>
            <button onClick={goToday} className="px-btn-ghost-sm" style={{ fontSize: 11, padding: '3px 10px' }}>오늘</button>
          </div>
          <button onClick={() => changeMonth(1)} className="px-btn-ghost-sm" style={{ fontSize: 14, padding: '4px 10px' }}>›</button>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          {(Object.keys(KIND_STYLE) as DayItem['kind'][]).map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: KIND_STYLE[k].color, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif' }}>{KIND_STYLE[k].label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {WEEKDAYS.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: 11, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif', padding: '4px 0' }}>{w}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const items = byDate.get(cell.key) ?? [];
            const kinds = Array.from(new Set(items.map(it => it.kind)));
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selected;
            return (
              <button
                key={cell.key}
                onClick={() => setSelected(cell.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '6px 0', borderRadius: 8, cursor: 'pointer',
                  background: isSelected ? 'var(--accent-dim)' : 'transparent',
                  border: isToday ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  minHeight: 40,
                }}
              >
                <span style={{
                  fontSize: 12, fontFamily: 'Pretendard, sans-serif',
                  color: isSelected ? 'var(--accent)' : 'var(--text)',
                  fontWeight: isToday ? 700 : 500,
                }}>
                  {cell.day}
                </span>
                <span style={{ display: 'flex', gap: 2, height: 6 }}>
                  {kinds.map(k => (
                    <span key={k} style={{ width: 5, height: 5, borderRadius: '50%', background: KIND_STYLE[k].color, display: 'inline-block' }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div style={{ marginTop: 20 }}>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ {selected.replace(/-/g, '.')} ({selectedItems.length}개)</div>
          {selectedItems.length === 0 ? (
            <div className="px-empty">
              <div className="px-empty-icon">暦</div>
              <p className="px-empty-text">이 날짜에는 기록이 없어요</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedItems.map(item => {
                const style = KIND_STYLE[item.kind];
                return (
                  <Link key={`${item.kind}-${item.id}`} href={style.href(item.id)} style={{ textDecoration: 'none' }}>
                    <div className="px-card" style={{ padding: '12px 16px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: style.color, display: 'inline-block' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'Pretendard, sans-serif' }}>{style.label}</span>
                        <span style={{ fontSize: 12, color: 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif' }}>· {item.label}</span>
                      </div>
                      <p style={{
                        fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.text}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
