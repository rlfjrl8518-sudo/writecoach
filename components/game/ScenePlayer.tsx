'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { loadDB, saveDB } from '@/lib/db';
import { getGame } from '@/lib/game';
import { SPEAKER_NAME, isBoss as isBossId, type Line, type SpeakerId, type Emotion } from '@/lib/curriculum';
import { studyBg } from '@/lib/story';
import { portraitSrc, fallbackTo } from '@/components/art/Art';

/* ═══════════════════════════════════════════════════════════════
   장면 재생기 — 비주얼노벨 방식. window 이벤트 'play-scene'으로 연다.
   배경 그림 · 인물 스탠딩(표정) · 이름표 · 타자 효과 · 기록/자동/건너뛰기/창 숨기기.
   본 장면은 db.game.seenScenes에 기록된다(기기 간 동기화).
═══════════════════════════════════════════════════════════════ */
export interface SceneRequest { id: string; title?: string; lines: Line[]; askName?: boolean; replay?: boolean; bg?: string }

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

function emotionFor(line: Line): Emotion {
  if (line.emo) return line.emo;
  if (line.who === 'narr') return 'default';
  if (/[!！]|훌륭|좋아|고맙|허허|축하|잘했/.test(line.text)) return 'happy';
  if (/…|\.\.\./.test(line.text) && line.who === 'muk') return 'think';
  return 'default';
}
/** 무대 위 자리: 스승 쪽은 왼쪽, 제자는 오른쪽, 요괴는 가운데 */
function slotOf(who: SpeakerId): 'left' | 'right' | 'center' | 'left2' {
  if (who === 'me') return 'right';
  if (who === 'muk') return 'left';
  if (who === 'seoha') return 'left2';
  return 'center';
}

export default function ScenePlayer() {
  const [queue, setQueue] = useState<SceneRequest[]>([]);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [name, setName] = useState('');
  const [look, setLook] = useState<'a' | 'b'>('a');
  const [auto, setAuto] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cur = queue[0];
  const line = cur?.lines[idx];
  const full = line ? line.text.replace(/\{name\}/g, name || '제자') : '';
  const typing = shown < full.length;
  const atEnd = !!cur && idx >= cur.lines.length - 1 && !typing;

  // 지금까지의 배경과, 무대에 오른 인물들의 마지막 표정
  const stage = useMemo(() => {
    if (!cur) return { bg: '', cast: new Map<SpeakerId, Emotion>() };
    let bg = cur.bg ?? studyBg();
    const cast = new Map<SpeakerId, Emotion>();
    cur.lines.slice(0, idx + 1).forEach(l => {
      if (l.bg) bg = l.bg;
      if (l.who !== 'narr') cast.set(l.who, emotionFor(l));
    });
    return { bg, cast };
  }, [cur, idx]);

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
    const g = getGame(loadDB());
    setName(g.name);
    setLook(g.look ?? 'a');
    setHidden(false); setLogOpen(false);
  }, [cur]);

  // 타자 효과
  useEffect(() => {
    if (!line) return;
    setShown(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setShown(s => { if (s >= full.length) { if (timer.current) clearInterval(timer.current); return s; } return s + 1; });
    }, 26);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [line, full]);

  const finish = useCallback(() => {
    if (!cur) return;
    if (cur.askName) {
      const db = loadDB();
      db.game = { ...getGame(db), name: name.trim().slice(0, 12) || getGame(db).name, look };
      saveDB(db);
    }
    if (!cur.replay) markSeen(cur.id);
    setQueue(q => q.slice(1));
    setIdx(0); setAuto(false);
  }, [cur, name, look]);

  const advance = useCallback(() => {
    if (!cur) return;
    if (hidden) { setHidden(false); return; }
    if (typing) { setShown(full.length); return; }
    if (idx < cur.lines.length - 1) setIdx(i => i + 1);
    else if (!cur.askName) finish();
  }, [cur, typing, full, idx, finish, hidden]);

  // 자동 진행
  useEffect(() => {
    if (!auto || typing || !cur || atEnd) return;
    const t = setTimeout(advance, 1400 + full.length * 22);
    return () => clearTimeout(t);
  }, [auto, typing, cur, atEnd, advance, full]);

  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
      if (e.key === 'Escape') { if (logOpen) setLogOpen(false); else if (cur.replay) finish(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, advance, finish, logOpen]);

  if (!cur || !line) return null;
  const nameOf = (who: SpeakerId) => (who === 'me' ? (name || '나') : SPEAKER_NAME[who]);
  const speaking = line.who;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="vn-root" onClick={advance} role="dialog" aria-label={cur.title ?? '이야기'}>
      {/* 배경 (바뀔 때 번지듯) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={stage.bg} src={`/art/${stage.bg}.webp`} alt="" className="vn-bg anim-in" />
      <div className="vn-shade" />

      {cur.title && idx === 0 && <div key={cur.id} className="vn-title anim-in"><span>{cur.title}</span></div>}

      {/* 인물 */}
      <div className="vn-cast">
        {Array.from(stage.cast.entries()).map(([who, emo]) => {
          const slot = slotOf(who);
          const active = who === speaking;
          const boss = isBossId(who);
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={who} src={portraitSrc(who, emo, look)} onError={fallbackTo(portraitSrc(who, 'default', look))} alt={nameOf(who)} draggable={false}
              className={`vn-actor vn-${slot} ${boss ? 'vn-boss anim-float' : 'anim-bob'} ${active ? 'on' : ''}`} />
          );
        })}
      </div>

      {/* 빠른 메뉴 */}
      <div className="vn-menu" onClick={stop}>
        <button onClick={() => setLogOpen(o => !o)}>기록</button>
        <button className={auto ? 'on' : ''} onClick={() => setAuto(a => !a)}>자동</button>
        <button onClick={() => setHidden(h => !h)}>창 숨기기</button>
        {(cur.replay || hasSeen(cur.id) || !cur.askName) && <button onClick={() => (cur.askName ? setIdx(cur.lines.length - 1) : finish())}>건너뛰기</button>}
      </div>

      {/* 대사창 */}
      {!hidden && (
        <div className="vn-box" onClick={e => { stop(e); advance(); }}>
          {line.who !== 'narr' && <div className={`vn-name ${isBossId(line.who) ? 'boss' : ''}`}>{nameOf(line.who)}</div>}
          <div className={`vn-text ${line.who === 'narr' ? 'narr' : ''}`}>{full.slice(0, shown)}{!typing && !atEnd && <span className="g-next"> ▾</span>}</div>

          {atEnd && cur.askName && (
            <div className="vn-ask" onClick={stop}>
              <div className="g-dim" style={{ fontSize: 13, marginBottom: 8 }}>문하에 들 사람의 모습과 이름</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {(['a', 'b'] as const).map(k => (
                  <button key={k} onClick={() => setLook(k)} className={`vn-look ${look === k ? 'on' : ''}`} aria-pressed={look === k}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/art/me_${k}.webp`} alt="" />
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input autoFocus value={name} maxLength={12} onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) finish(); }}
                  className="px-input" style={{ width: 200, padding: '9px 12px', fontSize: 15 }} placeholder="이름을 적게" />
                <button className="g-btn primary" disabled={!name.trim()} onClick={finish}>문하에 들기</button>
              </div>
            </div>
          )}
          {!(atEnd && cur.askName) && <div className="vn-foot">{idx + 1} / {cur.lines.length}</div>}
        </div>
      )}

      {/* 대사 기록 */}
      {logOpen && (
        <div className="vn-log" onClick={stop}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="g-h" style={{ margin: 0 }}>대사 기록</span>
            <button className="g-btn sm" onClick={() => setLogOpen(false)}>닫기</button>
          </div>
          {cur.lines.slice(0, idx + 1).map((l, i) => (
            <div key={i} style={{ padding: '8px 0', borderTop: '1px solid var(--line-soft)' }}>
              {l.who !== 'narr' && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--seal)' }}>{nameOf(l.who)}</div>}
              <div className="t-read" style={{ fontSize: 15, lineHeight: 1.8, color: l.who === 'narr' ? 'var(--dim-star)' : undefined }}>{l.text.replace(/\{name\}/g, name || '제자')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
