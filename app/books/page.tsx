'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  loadDB, saveDB, groupByMonth, getBookNotes,
  type Book, type BookNote, type BookStatus,
} from '@/lib/db';

function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusBadge({ status }: { status: BookStatus }) {
  const cls: Record<BookStatus, string> = {
    '읽는 중': 'px-badge px-badge-accent',
    '완독':    'px-badge px-badge-done',
    '중단':    'px-badge px-badge-type',
  };
  return <span className={cls[status]} style={{ fontSize: 11, padding: '2px 9px' }}>{status}</span>;
}

function BookCard({ book, noteCount, onClick }: { book: Book; noteCount: number; onClick: () => void }) {
  return (
    <div className="px-card" style={{ cursor: 'pointer', padding: '14px 16px' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{book.title}</span>
        <StatusBadge status={book.status} />
      </div>
      {book.author && (
        <div style={{ fontSize: 12, color: 'var(--dim-star)', marginBottom: 6 }}>{book.author}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--dim-star)' }}>
        <span className="pixel-font" style={{ fontSize: 6.5 }}>
          {book.status === '완독' && book.finishedAt ? `완독 ${fmtDate(book.finishedAt)}` : `시작 ${fmtDate(book.startedAt)}`}
        </span>
        <span>· 기록 {noteCount}개</span>
      </div>
    </div>
  );
}

function NoteItem({
  note, dragging, itemRef, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp,
}: {
  note: BookNote;
  dragging?: boolean;
  itemRef?: (el: HTMLDivElement | null) => void;
  onHandlePointerDown?: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onHandlePointerMove?: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onHandlePointerUp?: (e: React.PointerEvent<HTMLSpanElement>) => void;
}) {
  return (
    <div
      ref={itemRef}
      className="px-card"
      style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', opacity: dragging ? 0.6 : 1 }}
    >
      <span
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        title="드래그로 순서 변경"
        style={{
          cursor: dragging ? 'grabbing' : 'grab',
          color: 'var(--dim-star)', fontSize: 16, lineHeight: 1,
          paddingTop: 2, touchAction: 'none', userSelect: 'none', flexShrink: 0,
        }}
      >
        ⠿
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)' }}>{fmtDate(note.date)}</span>
          {note.progress && <span className="px-tag-expr">{note.progress}</span>}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
          {note.text}
        </p>
        {note.quote && (
          <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--accent-dim)', borderLeft: '2px solid var(--accent)', fontSize: 12, color: 'var(--text)', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif', whiteSpace: 'pre-wrap' }}>
            <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, display: 'block', marginBottom: 3, letterSpacing: '0.02em' }}>인상 깊은 구절</span>
            {note.quote}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookNotes, setBookNotes] = useState<BookNote[]>([]);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [progress, setProgress] = useState('');
  const [noteText, setNoteText] = useState('');
  const [quote, setQuote] = useState('');

  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  // ── 기록 타임라인 드래그 앤 드롭 재정렬 상태 ──
  const [dragNotes, setDragNotes] = useState<BookNote[] | null>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<number | null>(null);
  const noteRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    const db = loadDB();
    setBooks([...db.books].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setBookNotes(db.bookNotes);
  }, [saved]);

  const reading = useMemo(() => books.filter(b => b.status === '읽는 중'), [books]);
  const others  = useMemo(() => books.filter(b => b.status !== '읽는 중'), [books]);
  const otherGroups = useMemo(
    () => groupByMonth(others, b => b.finishedAt || b.createdAt),
    [others]
  );

  function toggleMonth(key: string) {
    setOpenMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleAddBook(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const db = loadDB();
    const now = new Date().toISOString();
    db.books.push({
      id: Date.now(),
      title: title.trim(),
      author: author.trim() || undefined,
      status: '읽는 중',
      startedAt: todayStr(),
      createdAt: now,
    });
    saveDB(db);
    setTitle(''); setAuthor('');
    setSaved(v => !v);
  }

  function handleAddNote(bookId: number, e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const db = loadDB();
    db.bookNotes.push({
      id: Date.now(),
      bookId,
      date: todayStr(),
      progress: progress.trim() || undefined,
      text: noteText.trim(),
      quote: quote.trim() || undefined,
      createdAt: new Date().toISOString(),
      order: Date.now(),
    });
    saveDB(db);
    setProgress(''); setNoteText(''); setQuote('');
    setSaved(v => !v);
  }

  function handleMarkFinished(bookId: number) {
    const db = loadDB();
    const found = db.books.find(b => b.id === bookId);
    if (found) {
      found.status = '완독';
      found.finishedAt = todayStr();
      saveDB(db);
      setSaved(v => !v);
    }
  }

  // ── 기록 타임라인 드래그 앤 드롭 재정렬 핸들러 ──
  function handleNotePointerDown(e: React.PointerEvent<HTMLSpanElement>, noteId: number, currentOrder: BookNote[]) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragNotes(currentOrder);
    setDraggingNoteId(noteId);
  }

  function handleNotePointerMove(e: React.PointerEvent<HTMLSpanElement>, noteId: number) {
    if (draggingNoteId !== noteId) return;
    const y = e.clientY;
    setDragNotes(prev => {
      if (!prev) return prev;
      const idx = prev.findIndex(n => n.id === noteId);
      if (idx === -1) return prev;
      if (idx > 0) {
        const aboveEl = noteRefs.current.get(prev[idx - 1].id);
        if (aboveEl) {
          const rect = aboveEl.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (y < mid) {
            const next = [...prev];
            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            return next;
          }
        }
      }
      if (idx < prev.length - 1) {
        const belowEl = noteRefs.current.get(prev[idx + 1].id);
        if (belowEl) {
          const rect = belowEl.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (y > mid) {
            const next = [...prev];
            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
            return next;
          }
        }
      }
      return prev;
    });
  }

  function handleNotePointerUp(e: React.PointerEvent<HTMLSpanElement>, noteId: number) {
    if (draggingNoteId !== noteId) return;
    setDraggingNoteId(null);
    setDragNotes(finalOrder => {
      if (finalOrder) {
        const db = loadDB();
        finalOrder.forEach((n, idx) => {
          const found = db.bookNotes.find(x => x.id === n.id);
          if (found) found.order = idx;
        });
        saveDB(db);
        setBookNotes(db.bookNotes);
      }
      return null;
    });
  }

  const selectedBook = books.find(b => b.id === selectedId) || null;

  if (selectedBook) {
    const timeline = getBookNotes(bookNotes, selectedBook.id);
    const displayTimeline = dragNotes ?? timeline;
    return (
      <div>
        <button
          onClick={() => setSelectedId(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim-star)', fontSize: 12, padding: 0, marginBottom: 14 }}
        >
          ← 목록으로
        </button>

        <div className="px-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="px-sec-title" style={{ marginBottom: 0 }}>{selectedBook.title}</span>
            <StatusBadge status={selectedBook.status} />
          </div>
          {selectedBook.author && (
            <div style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 8 }}>{selectedBook.author}</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--dim-star)', marginBottom: 12 }}>
            시작 {fmtDate(selectedBook.startedAt)}
            {selectedBook.finishedAt && ` · 완독 ${fmtDate(selectedBook.finishedAt)}`}
          </div>
          {selectedBook.status === '읽는 중' && (
            <button className="px-btn-ghost" style={{ fontSize: 12 }} onClick={() => handleMarkFinished(selectedBook.id)}>
              ✦ 완독으로 표시
            </button>
          )}
        </div>

        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 기록 추가</div>
          <form onSubmit={e => handleAddNote(selectedBook.id, e)}>
            <div style={{ marginBottom: 10 }}>
              <label className="px-label">진도 <span style={{ fontSize: 10, color: 'var(--dim-star)', fontWeight: 400 }}>(선택)</span></label>
              <input className="px-input" placeholder="예: 120쪽까지" value={progress} onChange={e => setProgress(e.target.value)} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label className="px-label">느낀 점</label>
              <textarea
                className="px-textarea" rows={4}
                placeholder="오늘 읽으면서 든 생각이나 느낌을 적어보세요..."
                value={noteText} onChange={e => setNoteText(e.target.value)}
                style={{ minHeight: 90 }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="px-label">인상 깊은 구절 <span style={{ fontSize: 10, color: 'var(--dim-star)', fontWeight: 400 }}>(선택)</span></label>
              <textarea
                className="px-textarea" rows={2}
                placeholder="마음에 남은 문장을 옮겨 적어보세요..."
                value={quote} onChange={e => setQuote(e.target.value)}
                style={{ minHeight: 56 }}
              />
            </div>
            <button type="submit" className="px-btn px-btn-accent">✦ 기록 남기기</button>
          </form>
        </div>

        <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ 읽은 기록 ({timeline.length}개)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {timeline.length === 0 && (
            <div className="px-empty">
              <div className="px-empty-icon">册</div>
              <p className="px-empty-text">아직 기록이 없어요<br />아래에서 첫 기록을 남겨보세요</p>
            </div>
          )}
          {displayTimeline.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              dragging={draggingNoteId === note.id}
              itemRef={el => { if (el) noteRefs.current.set(note.id, el); else noteRefs.current.delete(note.id); }}
              onHandlePointerDown={e => handleNotePointerDown(e, note.id, displayTimeline)}
              onHandlePointerMove={e => handleNotePointerMove(e, note.id)}
              onHandlePointerUp={e => handleNotePointerUp(e, note.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>册 책 읽기 기록</div>
      <p className="serif-font" style={{ fontSize: 13, color: 'var(--dim-star)', marginBottom: 20, lineHeight: 1.8 }}>
        지금 읽고 있는 책을 등록하고, 읽어가며 든 생각을 조금씩 기록해보세요.
      </p>

      <div className="px-card" style={{ marginBottom: 24 }}>
        <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 새 책 등록</div>
        <form onSubmit={handleAddBook}>
          <div style={{ marginBottom: 10 }}>
            <label className="px-label">제목</label>
            <input className="px-input" placeholder="책 제목" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="px-label">저자 <span style={{ fontSize: 10, color: 'var(--dim-star)', fontWeight: 400 }}>(선택)</span></label>
            <input className="px-input" placeholder="저자명" value={author} onChange={e => setAuthor(e.target.value)} />
          </div>
          <button type="submit" className="px-btn px-btn-accent">✦ 등록</button>
        </form>
      </div>

      <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ 읽는 중 ({reading.length}개)</div>
      {reading.length === 0 ? (
        <div className="px-empty" style={{ marginBottom: 24 }}>
          <div className="px-empty-icon">册</div>
          <p className="px-empty-text">지금 읽고 있는 책이 없어요<br />위에서 새 책을 등록해보세요</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {reading.map(book => (
            <BookCard
              key={book.id}
              book={book}
              noteCount={bookNotes.filter(n => n.bookId === book.id).length}
              onClick={() => setSelectedId(book.id)}
            />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div>
          <div className="px-sec-title" style={{ marginBottom: 14 }}>✦ 완독 · 중단 ({others.length}개)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {otherGroups.map(group => {
              const isOpen = openMonths.has(group.key);
              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleMonth(group.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'var(--bg-subtle)', border: '1px solid var(--card-border)',
                      borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                      marginBottom: isOpen ? 8 : 0, fontFamily: 'Pretendard, sans-serif',
                    }}
                  >
                    <span className="pixel-font" style={{ fontSize: 9, color: 'var(--card-border)' }}>{isOpen ? '▾' : '▸'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>📁 {group.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim-star)', marginLeft: 'auto' }}>{group.items.length}개</span>
                  </button>
                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {group.items.map(book => (
                        <BookCard
                          key={book.id}
                          book={book}
                          noteCount={bookNotes.filter(n => n.bookId === book.id).length}
                          onClick={() => setSelectedId(book.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
