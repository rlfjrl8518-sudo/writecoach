'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { loadDB, type DB } from '@/lib/db';
import { snapshot, storyView, getGame, levelInfo, SEALS, questsFor, todayKey, type GameSnapshot } from '@/lib/game';
import { getYear, yearTitle } from '@/lib/story';
import { playScene, hasSeen } from './ScenePlayer';
import { Speaker } from '@/components/pixel/Pixel';

/* ═══════════════════════════════════════════════════════════════
   게임 레이어 — 기록이 저장될 때마다(db-saved) 이전 스냅샷과 비교해
   먹 획득·숙제 완료·인장·레벨업·새 장을 알린다. 서재(/)·이야기(/story)
   화면에서는 아직 안 본 장면을 자동 재생한다.
═══════════════════════════════════════════════════════════════ */
const SNAP_KEY = 'wc_game_snap';

interface Toast { id: number; text: string; color: string }

export function sceneIdsFor(db: DB) {
  const g = getGame(db);
  return { prologue: `prologue-${g.year}`, epilogue: `epilogue-${g.year}`, chapter: (cid: string) => `${g.year}:${cid}` };
}

/** 안 본 장면을 순서대로 큐에 넣는다 */
export function queuePendingScenes(db: DB) {
  const g = getGame(db);
  const ids = sceneIdsFor(db);
  const year = getYear(g.year);
  if (!hasSeen(ids.prologue)) {
    playScene({ id: ids.prologue, title: yearTitle(g.year), lines: year.prologue, askName: g.year === 1 && !g.name });
  }
  const sv = storyView(db);
  // 이미 조건을 채운 장도 장면은 순서대로 보여 준다 (한 번에 최대 3장면 — 나머지는 다음 방문 때)
  const pending = sv.chapters.filter(c => c.status !== 'locked' && !hasSeen(ids.chapter(c.chapter.id))).slice(0, 3);
  pending.forEach(c => playScene({ id: ids.chapter(c.chapter.id), title: c.chapter.title, lines: c.chapter.scene }));
  if (!sv.current && sv.yearDone && !hasSeen(ids.epilogue) && !pending.length) {
    playScene({ id: ids.epilogue, title: `${yearTitle(g.year)} · 끝`, lines: year.epilogue });
  }
}

export default function GameLayer() {
  const path = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<{ level: number; title: string; color: string; robe: string } | null>(null);
  const tid = useRef(1);

  function toast(text: string, color = 'var(--accent)') {
    const id = tid.current++;
    setToasts(t => [...t, { id, text, color }].slice(-5));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    function check(db: DB) {
      let prev: GameSnapshot | null = null;
      try { prev = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch { /* */ }
      const now = snapshot(db);
      localStorage.setItem(SNAP_KEY, JSON.stringify(now));
      if (!prev) return; // 첫 실행 — 기준점만 저장
      const gained = now.ink - prev.ink;
      if (gained > 0) toast(`+${gained} 먹`, 'var(--accent)');
      const quests = questsFor(todayKey());
      now.quests.filter(q => !prev!.quests.includes(q)).forEach(q => {
        const def = quests.find(x => x.id === q);
        if (def) toast(`숙제 완료 · ${def.label}`, 'var(--good)');
      });
      now.seals.filter(s => !prev!.seals.includes(s)).forEach(s => {
        const def = SEALS.find(x => x.id === s);
        if (def) toast(`인장 획득 · 「${def.name}」`, 'var(--moon)');
      });
      if (now.level > prev.level) {
        const li = levelInfo(now.ink);
        setLevelUp({ level: li.level, title: li.rank.title, color: li.rank.color, robe: li.rank.robe });
      }
      if (now.chapterId !== prev.chapterId) {
        if (prev.chapterId) toast('장을 마쳤다! 다음 이야기가 열렸다', 'var(--good)');
        if (path === '/' || path === '/story') queuePendingScenes(db);
      }
      if (now.yearDone && !prev.yearDone) toast('한 해의 이야기를 모두 마쳤다!', 'var(--moon)');
    }
    check(loadDB());
    const onSaved = (e: Event) => check((e as CustomEvent<DB>).detail ?? loadDB());
    window.addEventListener('db-saved', onSaved);
    return () => window.removeEventListener('db-saved', onSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // 서재·이야기 화면 진입 시 안 본 장면 재생
  useEffect(() => {
    if (path === '/' || path === '/story') {
      const t = setTimeout(() => queuePendingScenes(loadDB()), 300);
      return () => clearTimeout(t);
    }
  }, [path]);

  return (
    <>
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 650, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', alignItems: 'flex-end' }}>
        {toasts.map(t => (
          <div key={t.id} className="g-panel anim-in" style={{ '--frame': t.color, padding: '8px 12px', fontSize: 12, color: t.color, margin: 4 } as React.CSSProperties}>
            {t.text}
          </div>
        ))}
      </div>
      {levelUp && (
        <div onClick={() => setLevelUp(null)} style={{ position: 'fixed', inset: 0, zIndex: 590, background: 'rgba(8,8,16,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="g-panel hi anim-in" style={{ maxWidth: 340, width: '100%', textAlign: 'center', padding: '28px 20px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 12 }}>━ LEVEL UP ━</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'flex-end', marginBottom: 14 }}>
              <Speaker id="muk" emotion="happy" size={80} />
              <Speaker id="me" emotion="happy" size={80} robe={{ robe: levelUp.robe, color: levelUp.color }} className="anim-bob" />
            </div>
            <div style={{ fontSize: 22, marginBottom: 4 }}>Lv.{levelUp.level}</div>
            <div style={{ fontSize: 14, color: levelUp.color, marginBottom: 12 }}>{levelUp.title}</div>
            <div className="g-dim" style={{ fontSize: 13, fontFamily: 'var(--font-read)', marginBottom: 16 }}>
              묵당 선생: &ldquo;{levelUp.level % 5 === 0 ? '먹이 제법 진해졌군. 도포를 새로 맞춰야겠어.' : '어제보다 한 뼘. 그거면 충분하네.'}&rdquo;
            </div>
            <button className="g-btn primary" onClick={() => { setLevelUp(null); router.push('/journey'); }}>수련 기록 보기</button>
            <button className="g-btn" onClick={() => setLevelUp(null)}>닫기</button>
          </div>
        </div>
      )}
    </>
  );
}
