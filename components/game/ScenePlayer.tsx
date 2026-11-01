'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { loadDB, saveDB } from '@/lib/db';
import { getGame, levelInfo, computeInk } from '@/lib/game';
import { SPEAKERS, type Line, type SpeakerId } from '@/lib/story';
import { Speaker } from '@/components/pixel/Pixel';
import type { Emotion } from '@/components/pixel/sprites';

/* ═══════════════════════════════════════════════════════════════
   장면 재생기 — RPG 대화창. window 이벤트 'play-scene'으로 연다.
   본 장면은 db.game.seenScenes에 기록된다(기기 간 동기화).
═══════════════════════════════════════════════════════════════ */
export interface SceneRequest { id: string; title?: string; lines: Line[]; askName?: boolean; replay?: boolean }

export function playScene(req: SceneRequest) {
  window.dispatchEvent(new CustomEvent<SceneRequest>('play-scene', { detail: req }));
}
export function markSeen(id: string) {
  const db = loadDB();
  const g = getGame(db);
  if (g.seenScenes.includes(id)) return;
  db.game = { ...g, seenScenes: [...g.seenScenes, id] };
  saveDB(db);
}
export function hasSeen(id: string) { return getGame(loadDB()).seenScenes.includes(id); }

function emotionFor(who: SpeakerId, text: string): Emotion {
  if (who === 'narr') return 'default';
  if (/[!！]|훌륭|좋아|고맙|허허|축하/.test(text)) return 'happy';
  if (/…|\.\.\./.test(text) && who === 'muk') return 'think';
  return 'default';
}

export default function ScenePlayer() {
  const [queue, setQueue] = useState<SceneRequest[]>([]);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [name, setName] = useState('');
  const [robe, setRobe] = useState({ robe: '#5a5a8a', color: '#8f8fb8' });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cur = queue[0];
  const line = cur?.lines[idx];
  const full = line ? line.text.replace(/\{name\}/g, name || '제자') : '';
  const typing = shown < full.length;
  const atEnd = !!cur && idx >= cur.lines.length - 1 && !typing;

  useEffect(() => {
    const onPlay = (e: Event) => {
      const req = (e as CustomEvent<SceneRequest>).detail;
      if (!req.replay && hasSeen(req.id)) return;
      setQueue(q => (q.some(x => x.id === req.id) ? q : [...q, req]));
    };
    window.addEventListener('play-scene', onPlay);
    return () => window.removeEventListener('play-scene', onPlay);
  }, []);

  useEffect(() => {
    if (!cur) return;
    const db = loadDB();
    setName(getGame(db).name);
    const r = levelInfo(computeInk(db).total).rank;
    setRobe({ robe: r.robe, color: r.color });
  }, [cur]);

  // 타자기 효과 (steps 느낌으로 2글자씩)
  useEffect(() => {
    if (!line) return;
    setShown(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setShown(s => { if (s >= full.length) { if (timer.current) clearInterval(timer.current); return s; } return s + 2; });
    }, 40);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [line, full]);

  const finish = useCallback(() => {
    if (!cur) return;
    if (cur.askName && name.trim()) {
      const db = loadDB();
      db.game = { ...getGame(db), name: name.trim().slice(0, 12) };
      saveDB(db);
    }
    if (!cur.replay) markSeen(cur.id);
    setQueue(q => q.slice(1));
    setIdx(0);
  }, [cur, name]);

  const advance = useCallback(() => {
    if (!cur) return;
    if (typing) { setShown(full.length); return; }
    if (idx < cur.lines.length - 1) setIdx(i => i + 1);
    else if (!cur.askName) finish();
  }, [cur, typing, full, idx, finish]);

  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
      if (e.key === 'Escape' && cur.replay) finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, advance, finish]);

  if (!cur || !line) return null;
  const sp = SPEAKERS[line.who];
  const speakerName = line.who === 'me' ? (name || '나') : sp.name;
  const isBoss = !['narr', 'me', 'muk', 'yoon', 'chekhov', 'hemingway', 'woolf', 'yeonam', 'kimyujeong', 'orwell', 'yisang'].includes(line.who);

  return (
    <div
      onClick={advance}
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,8,16,0.72)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16 }}
    >
      {cur.title && (
        <div style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: '#f7e26b', fontSize: 12 }}>
          ━ {cur.title} ━
        </div>
      )}
      {/* 무대 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 12 }}>
        {line.who !== 'narr' && (
          <div key={`${idx}-${line.who}`} className={isBoss ? 'anim-shake' : 'anim-in'}>
            <Speaker id={line.who} emotion={emotionFor(line.who, line.text)} size={isBoss ? 176 : 144} robe={robe} className="anim-bob" />
          </div>
        )}
      </div>
      <div className="g-panel hi" style={{ maxWidth: 720, width: '100%', margin: '0 auto 8px', minHeight: 140 }} onClick={e => { e.stopPropagation(); advance(); }}>
        <div className="g-dialog">
          <div style={{ flex: 1, minWidth: 0 }}>
            {speakerName && <div className="who" style={{ color: line.who === 'me' ? robe.color : sp.color }}>{speakerName}</div>}
            <div className="txt" style={{ color: line.who === 'narr' ? 'var(--dim-star)' : 'var(--text)', fontStyle: line.who === 'narr' ? 'italic' : undefined }}>
              {full.slice(0, shown)}
            </div>
          </div>
        </div>
        {atEnd && cur.askName ? (
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <span className="g-dim" style={{ fontSize: 12 }}>문하생 이름</span>
            <input
              autoFocus value={name} maxLength={12} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) finish(); }}
              className="px-input" style={{ width: 180, padding: '6px 10px', fontSize: 14 }} placeholder="이름을 적게"
            />
            <button className="g-btn primary" disabled={!name.trim()} onClick={finish}>문하에 들기</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11 }} className="g-dim">
            <span>{idx + 1} / {cur.lines.length}</span>
            <span>{cur.replay && <button className="g-btn sm" onClick={e => { e.stopPropagation(); finish(); }}>건너뛰기</button>}<span className="g-next">▼</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
