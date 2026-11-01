'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadDB, type DB, type WritingEntry } from '@/lib/db';
import { getGame } from '@/lib/game';

/* 나의 문집 — 쓴 글을 골라 책으로 엮는다 (무제노트·하루북 참고). 브라우저 인쇄로 PDF 저장. */
type Filter = 'all' | 'practice' | 'free';

export default function BookPage() {
  const [db, setDb] = useState<DB | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState('나의 백지첩');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => { setDb(loadDB()); }, []);

  const list = useMemo(() => {
    if (!db) return [] as WritingEntry[];
    return [...db.writings]
      .filter(w => filter === 'all' || (filter === 'practice' ? !!(w.su || w.trial) : !(w.su || w.trial)))
      .filter(w => (!from || w.date >= from) && (!to || w.date <= to))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }, [db, filter, from, to]);
  useEffect(() => { setPicked(new Set(list.map(w => w.id))); }, [list]);

  if (!db) return null;
  const chosen = list.filter(w => picked.has(w.id));
  const name = getGame(db).name || '제자';
  const cleanTitle = (w: WritingEntry) => (w.topic || w.type).replace(/^\[[^\]]+\]\s*/, '');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 24 }}>
      <div className="no-print">
        <Link href="/writing" className="g-btn sm">← 글방</Link>
        <div className="g-panel" style={{ marginTop: 8 }}>
          <div className="g-h">나의 문집 만들기</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
            <input className="px-input" value={title} onChange={e => setTitle(e.target.value)} style={{ maxWidth: 240, padding: '6px 10px' }} aria-label="문집 제목" />
            {(['all', 'practice', 'free'] as Filter[]).map(f => <button key={f} className={`g-btn sm ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? '전체' : f === 'practice' ? '수련 글' : '자유 글'}</button>)}
            <input type="date" className="px-input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150, padding: '4px 8px' }} aria-label="시작일" />
            <span>~</span>
            <input type="date" className="px-input" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150, padding: '4px 8px' }} aria-label="종료일" />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', margin: '10px 0', boxShadow: 'inset 0 0 0 2px var(--line-soft)', padding: 6 }}>
            {list.map(w => (
              <label key={w.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(w.id)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(w.id)) n.delete(w.id); else n.add(w.id); return n; })} />
                <span className="g-dim" style={{ width: 80, flexShrink: 0 }}>{w.date}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanTitle(w)}</span>
              </label>
            ))}
            {!list.length && <div className="g-dim" style={{ fontSize: 12 }}>고를 글이 없네.</div>}
          </div>
          <button className="g-btn primary" disabled={!chosen.length} onClick={() => window.print()}>📖 {chosen.length}편으로 책 만들기 (PDF로 저장)</button>
          <div className="g-dim" style={{ fontSize: 11, marginTop: 4 }}>인쇄 창에서 &lsquo;PDF로 저장&rsquo;을 고르면 책 파일이 되네. 수련 사진도 함께 실리네.</div>
        </div>
      </div>

      {/* 책 본문 — 화면에서는 미리보기, 인쇄 시 책 */}
      <div className="book">
        <section className="book-cover">
          <div className="book-title">{title}</div>
          <div className="book-sub">{name} 지음 · {chosen[0]?.date ?? ''} ~ {chosen[chosen.length - 1]?.date ?? ''}</div>
          <div className="book-sub">산마루 서재에서, 묵당 선생과 함께</div>
        </section>
        <section className="book-toc">
          <div className="book-h">차례</div>
          {chosen.map((w, i) => <div key={w.id} className="book-toc-row"><span>{i + 1}. {cleanTitle(w)}</span><span>{w.date}</span></div>)}
        </section>
        {chosen.map((w, i) => (
          <article key={w.id} className="book-page">
            <div className="book-num">{i + 1}</div>
            <h2 className="book-h">{cleanTitle(w)}</h2>
            <div className="book-date">{w.date} · {w.type}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {w.imageUrl && <img src={w.imageUrl} alt="" className="book-img" />}
            <div className="book-text">{w.text}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
