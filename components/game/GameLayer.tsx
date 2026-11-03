'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { loadDB, type DB } from '@/lib/db';
import { snapshot, pathView, getGame, rankOf, practiceDays, type GameSnapshot } from '@/lib/game';
import { PROLOGUE, EPILOGUE, ALL_SU } from '@/lib/curriculum';
import { unlockedMemories, currentTerm, OBJECTS } from '@/lib/story';
import { playScene, hasSeen } from './ScenePlayer';
import { Speaker } from '@/components/art/Art';

/* ═══════════════════════════════════════════════════════════════
   게임 레이어 — 기록이 저장될 때마다(db-saved) 이전 스냅샷과 비교해
   '등불이 켜졌다', '백지첩 한 장 복원', '장 수료(칭호 변경)'를 알린다.
   서재(/)·수련(/practice)에서는 아직 안 본 장면을 순서대로 재생한다:
   프롤로그 → 묵당의 기억(수련한 날 수로 열림) → 장 도입 → 에필로그 → 절기 인사.
═══════════════════════════════════════════════════════════════ */
const SNAP_KEY = 'wc_game_snap_v3';
interface Toast { id: number; text: string }
type Big = { kind: 'page'; n: number; title: string; lesson: string } | { kind: 'chapter'; title: string };

export function queuePendingScenes(db: DB, replay = false) {
  const g = getGame(db);
  const seen = (id: string) => !replay && hasSeen(id);
  if (g.cycle === 1 && (replay || !hasSeen('c1:prologue'))) playScene({ id: 'c1:prologue', title: '산마루 서재', lines: PROLOGUE, askName: !g.name || !g.look, bg: 'cg_prologue', replay: replay && !!g.name });
  if (!replay && hasSeen('c1:prologue') && !g.look) playScene({ id: 'look:pick', title: '새로 단장한 서재', lines: [{ who: 'muk', text: '서재를 새로 단장했네. 창호지도 갈고, 그림도 새로 걸었지.', emo: 'happy' }, { who: 'muk', text: '자네 모습도 다시 한번 보세. 이름도 그대로면 되네.' }], askName: true });
  if (!replay) {
    const days = practiceDays(db).size;
    unlockedMemories(days).forEach(m => {
      const id = `mem:${m.id}`;
      if (!hasSeen(id)) playScene({ id, title: `묵당의 기억 · ${m.title}`, lines: m.obj ? [...m.lines, { who: 'narr', text: `서재에 「${OBJECTS[m.obj].name}」이(가) 놓였다.` }] : m.lines, bg: m.bg });
    });
  }
  const pv = pathView(db);
  const cur = pv.chapters.find(c => c.status === 'current' || c.status === 'trial');
  if (cur) {
    const id = `c${g.cycle}:ch${cur.ch.n}`;
    if (!seen(id)) playScene({ id, title: `${cur.ch.n}장 · ${cur.ch.title}`, lines: cur.ch.intro, bg: `cg_ch${cur.ch.n}`, replay });
  } else if (pv.cycleDone && !seen(`c${g.cycle}:epilogue`)) {
    playScene({ id: `c${g.cycle}:epilogue`, title: '백지첩 · 끝', lines: EPILOGUE, bg: 'cg_epilogue', replay });
  }
  // 절기 인사 — 한 번이라도 수련한 뒤부터, 절기마다 한 번
  if (!replay && (db.writings.length || (db.drillLogs ?? []).length)) {
    const t = currentTerm();
    const id = `term:${t.year}:${t.name}`;
    if (!hasSeen(id)) playScene({ id, title: `절기 · ${t.name}`, lines: [{ who: 'muk', text: t.line, emo: 'think' }, { who: 'muk', text: `이번 절기 글감일세. "${t.prompt}" — 짧은 글에서 고를 수 있네.` }] });
  }
}

export default function GameLayer() {
  const path = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [big, setBig] = useState<Big | null>(null);
  const tid = useRef(1);

  function toast(text: string) {
    const id = tid.current++;
    setToasts(t => [...t, { id, text }].slice(-4));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400);
  }

  useEffect(() => {
    function check(db: DB) {
      let prev: GameSnapshot | null = null;
      try { prev = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch { /* */ }
      const now = snapshot(db);
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(now)); } catch { /* */ }
      if (!prev || prev.cycle !== now.cycle) return;
      if (now.lit && !prev.lit) toast('오늘의 등불이 켜졌다');
      if (now.mastered > prev.mastered) {
        const pv = pathView(db);
        const last = pv.chapters.flatMap(c => c.sus).filter(s => s.mastered).sort((a, b) => (b.masteredAt ?? '').localeCompare(a.masteredAt ?? ''))[0];
        const su = last ? ALL_SU.find(s => s.n === last.su.n) : null;
        if (su) setBig({ kind: 'page', n: su.n, title: su.title, lesson: su.teach[0] });
      }
      if (now.chapters > prev.chapters) setTimeout(() => setBig({ kind: 'chapter', title: rankOf(db).title }), 400);
      if (path === '/') setTimeout(() => queuePendingScenes(db), 600);
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
          <div key={t.id} className="g-panel anim-in" style={{ padding: '10px 16px', fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--moon)', boxShadow: '0 0 10px 2px rgba(224,191,122,0.7)' }} />{t.text}
          </div>
        ))}
      </div>
      {big && (
        <div onClick={() => setBig(null)} className="big-wrap">
          <div className="big-card anim-in" onClick={e => e.stopPropagation()}>
            {big.kind === 'page' ? (
              <>
                <div className="g-dim" style={{ fontSize: 13, letterSpacing: '0.1em', marginBottom: 14 }}>백지첩 한 장이 돌아왔다</div>
                <div className="big-page">
                  <div style={{ fontSize: 12, color: '#7b6f60' }}>제{big.n}수</div>
                  <div className="t-title" style={{ fontSize: 24, margin: '10px 0 14px', fontFamily: 'var(--font-title)' }}>{big.title}</div>
                  <div className="t-read" style={{ fontSize: 14, lineHeight: 1.8, color: '#4a4136' }}>{big.lesson}</div>
                  <span className="seal anim-stamp" style={{ position: 'absolute', right: 16, bottom: 14, fontSize: 18, padding: '6px 8px', animationDelay: '380ms' }}>得</span>
                </div>
                <div className="g-dialog" style={{ textAlign: 'left', marginTop: 16 }}><Speaker id="muk" emotion="happy" size={48} />
                  <div className="txt" style={{ fontSize: 14.5 }}>이제 이 수는 자네 것일세.</div></div>
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/art/cg_win.webp" alt="" style={{ width: '100%', borderRadius: 10, aspectRatio: '16/9', objectFit: 'cover' }} />
                <div className="g-dim" style={{ fontSize: 13, letterSpacing: '0.1em', margin: '14px 0 6px' }}>한 장(章)을 마쳤다</div>
                <div className="t-title" style={{ fontSize: 22, fontFamily: 'var(--font-title)' }}><span className="seal" style={{ fontSize: 16, marginRight: 8 }}>號</span>{big.title}</div>
                <div className="g-dim t-read" style={{ fontSize: 14, marginTop: 8 }}>묵당 선생: &ldquo;새 호(號)를 내리겠네. 어울리는군.&rdquo;</div>
              </>
            )}
            <div style={{ marginTop: 16 }}>
              <button className="g-btn primary" onClick={() => { setBig(null); router.push('/practice'); }}>수련으로</button>
              <button className="g-btn" onClick={() => setBig(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
