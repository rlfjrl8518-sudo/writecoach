'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { loadDB, type DB } from '@/lib/db';
import { snapshot, pathView, getGame, rankOf, type GameSnapshot } from '@/lib/game';
import { PROLOGUE, EPILOGUE, ALL_SU } from '@/lib/curriculum';
import { playScene, hasSeen } from './ScenePlayer';
import { Speaker } from '@/components/pixel/Pixel';

/* ═══════════════════════════════════════════════════════════════
   게임 레이어 — 기록이 저장될 때마다(db-saved) 이전 스냅샷과 비교해
   '등불이 켜졌다', '백지첩 한 장 복원', '장 수료(칭호·도포 변경)'를 알린다.
   서재(/)·수련(/practice)에서는 안 본 장면(프롤로그·장 도입·에필로그)을 재생한다.
═══════════════════════════════════════════════════════════════ */
const SNAP_KEY = 'wc_game_snap_v2';
interface Toast { id: number; text: string; color: string }
type Big = { kind: 'page'; n: number; title: string; lesson: string } | { kind: 'chapter'; title: string; robe: string; color: string };

export function queuePendingScenes(db: DB) {
  const g = getGame(db);
  if (g.cycle === 1 && !hasSeen('c1:prologue')) playScene({ id: 'c1:prologue', title: '산마루 서재', lines: PROLOGUE, askName: !g.name });
  const pv = pathView(db);
  const cur = pv.chapters.find(c => c.status === 'current' || c.status === 'trial');
  if (cur) {
    const id = `c${g.cycle}:ch${cur.ch.n}`;
    if (!hasSeen(id)) playScene({ id, title: `${cur.ch.n}장 · ${cur.ch.title}`, lines: cur.ch.intro });
  } else if (pv.cycleDone && !hasSeen(`c${g.cycle}:epilogue`)) {
    playScene({ id: `c${g.cycle}:epilogue`, title: '백지첩 · 끝', lines: EPILOGUE });
  }
}

export default function GameLayer() {
  const path = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [big, setBig] = useState<Big | null>(null);
  const tid = useRef(1);

  function toast(text: string, color = 'var(--accent)') {
    const id = tid.current++;
    setToasts(t => [...t, { id, text, color }].slice(-4));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    function check(db: DB) {
      let prev: GameSnapshot | null = null;
      try { prev = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch { /* */ }
      const now = snapshot(db);
      localStorage.setItem(SNAP_KEY, JSON.stringify(now));
      if (!prev || prev.cycle !== now.cycle) return;
      if (now.lit && !prev.lit) toast('◆ 오늘의 등불이 켜졌다', 'var(--accent)');
      if (now.mastered > prev.mastered) {
        const pv = pathView(db);
        const last = pv.chapters.flatMap(c => c.sus).filter(s => s.mastered).sort((a, b) => (b.masteredAt ?? '').localeCompare(a.masteredAt ?? ''))[0];
        const su = last ? ALL_SU.find(s => s.n === last.su.n) : null;
        if (su) setBig({ kind: 'page', n: su.n, title: su.title, lesson: su.teach[0] });
      }
      if (now.chapters > prev.chapters) {
        const r = rankOf(db);
        setTimeout(() => setBig({ kind: 'chapter', title: r.title, robe: r.robe, color: r.color }), 400);
      }
      if (now.chapters !== prev.chapters && (path === '/' || path === '/practice')) queuePendingScenes(db);
    }
    check(loadDB());
    const onSaved = (e: Event) => check((e as CustomEvent<DB>).detail ?? loadDB());
    window.addEventListener('db-saved', onSaved);
    return () => window.removeEventListener('db-saved', onSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    if (path === '/' || path === '/practice') {
      const t = setTimeout(() => queuePendingScenes(loadDB()), 300);
      return () => clearTimeout(t);
    }
  }, [path]);

  return (
    <>
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 650, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', alignItems: 'flex-end' }}>
        {toasts.map(t => (
          <div key={t.id} className="g-panel anim-in" style={{ '--frame': t.color, padding: '8px 12px', fontSize: 12, color: t.color, margin: 4 } as React.CSSProperties}>{t.text}</div>
        ))}
      </div>
      {big && (
        <div onClick={() => setBig(null)} style={{ position: 'fixed', inset: 0, zIndex: 590, background: 'rgba(8,8,16,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="g-panel hi anim-in" style={{ maxWidth: 360, width: '100%', textAlign: 'center', padding: '26px 20px' }} onClick={e => e.stopPropagation()}>
            {big.kind === 'page' ? (
              <>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 12 }}>━ 백지첩 한 장이 돌아왔다 ━</div>
                <div style={{ margin: '0 auto 14px', width: 120, padding: '16px 10px', background: '#f2ecd8', color: '#2b2433', boxShadow: '0 0 0 4px #c8961e', fontFamily: 'var(--font-read)' }}>
                  <div style={{ fontSize: 11 }}>제{big.n}수</div>
                  <div style={{ fontSize: 16, margin: '6px 0' }}>{big.title}</div>
                </div>
                <div className="g-dialog" style={{ textAlign: 'left' }}><Speaker id="muk" emotion="happy" size={40} />
                  <div className="txt" style={{ fontSize: 13 }}>{big.lesson} 이제 이 수는 자네 것일세.</div></div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 12 }}>━ 장을 마쳤다 ━</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
                  <Speaker id="muk" emotion="happy" size={72} />
                  <Speaker id="me" emotion="happy" size={72} robe={{ robe: big.robe, color: big.color }} className="anim-bob" />
                </div>
                <div style={{ fontSize: 16, color: big.color, marginBottom: 8 }}>{big.title}</div>
                <div className="g-dim" style={{ fontSize: 13, fontFamily: 'var(--font-read)' }}>묵당 선생: &ldquo;도포를 새로 맞췄네. 어울리는군.&rdquo;</div>
              </>
            )}
            <div style={{ marginTop: 14 }}>
              <button className="g-btn primary" onClick={() => { setBig(null); router.push('/practice'); }}>수련으로</button>
              <button className="g-btn" onClick={() => setBig(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
