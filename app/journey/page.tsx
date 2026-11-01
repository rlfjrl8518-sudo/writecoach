'use client';
import { useEffect, useState } from 'react';
import { loadDB, saveDB, loadSettings, aiReady, type DB } from '@/lib/db';
import { pathView, getGame, rankOf, currentStreak, bestStreak, practiceDays, weekKey, todayKey, addDays, dayKey } from '@/lib/game';
import { CHAPTERS, SPEAKER_NAME } from '@/lib/curriculum';
import { writeWeeklyLetter } from '@/lib/openai';
import { Speaker, Monster } from '@/components/pixel/Pixel';
import ReportPage from '@/app/report/page';
import CalendarPage from '@/app/calendar/page';

type Tab = 'book' | 'letters' | 'report' | 'calendar';
const TABS: { k: Tab; label: string }[] = [
  { k: 'book', label: '백지첩' }, { k: 'letters', label: '주간 편지' }, { k: 'report', label: '성장 리포트' }, { k: 'calendar', label: '달력' },
];

function weekLabel(w: string) { const e = addDays(w, 6); return `${w.slice(5).replace('-', '/')} ~ ${e.slice(5).replace('-', '/')}`; }

function Letters({ db, reload }: { db: DB; reload: () => void }) {
  const g = getGame(db);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const thisWeek = weekKey(todayKey());
  const weeks = [addDays(thisWeek, -7), thisWeek];
  const writingsOf = (w: string) => db.writings.filter(x => weekKey((x.date || x.createdAt).slice(0, 10)) === w);

  async function request(w: string) {
    const s = loadSettings();
    if (!aiReady(s)) { setErr('설정에서 AI를 먼저 연결해 주세요.'); return; }
    const ws = writingsOf(w);
    if (!ws.length) { setErr('그 주에 쓴 글이 없네.'); return; }
    setBusy(w); setErr('');
    try {
      const pv = pathView(db);
      const learned = pv.chapters.flatMap(c => c.sus).filter(s => s.masteredAt && weekKey(dayKey(s.masteredAt)) === w).map(s => s.su.title);
      const text = await writeWeeklyLetter(s, g.name, weekLabel(w),
        ws.map(x => ({ title: x.topic || x.type, type: x.type, text: x.text, score: x.analysis?.score, weak: x.analysis?.weaknesses })),
        currentStreak(db), learned);
      const fresh = loadDB();
      const gg = getGame(fresh);
      fresh.game = { ...gg, letters: [...gg.letters.filter(l => l.week !== w), { week: w, text, createdAt: new Date().toISOString() }] };
      saveDB(fresh); reload();
    } catch (e) { setErr('오류: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); }
  }

  const letters = [...g.letters].sort((a, b) => b.week.localeCompare(a.week));
  return (
    <div>
      <div className="g-panel">
        <div className="g-dialog"><Speaker id="muk" size={44} />
          <div className="txt" style={{ fontSize: 14 }}>한 주가 끝나면 자네 글을 다 읽고 편지를 쓰겠네. 가장 좋았던 문장 하나, 반복되는 버릇 하나, 다음 주에 해 볼 것 하나.</div></div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
          {weeks.map(w => {
            const n = writingsOf(w).length;
            const has = g.letters.some(l => l.week === w);
            return (
              <button key={w} className={`g-btn sm ${!has && n ? 'primary' : ''}`} disabled={!!busy || !n} onClick={() => request(w)}>
                {busy === w ? '편지를 쓰는 중…' : `${w === thisWeek ? '이번 주(중간)' : '지난주'} 편지 ${has ? '다시 받기' : '받기'} · 글 ${n}편`}
              </button>
            );
          })}
        </div>
        {err && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 6 }}>{err}</div>}
      </div>
      {letters.map(l => (
        <div key={l.week} className="g-panel" style={{ marginTop: 12, background: '#f2ecd8', color: '#2b2433', '--frame': '#c8961e' } as React.CSSProperties}>
          <div style={{ fontSize: 11, color: '#8a6a2a', marginBottom: 8 }}>✉ {weekLabel(l.week)}</div>
          <div style={{ fontFamily: 'var(--font-read)', fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{l.text}</div>
        </div>
      ))}
    </div>
  );
}

function Book({ db }: { db: DB }) {
  const g = getGame(db);
  const pv = pathView(db);
  const rank = rankOf(db);
  const days = practiceDays(db).size;
  const wins = g.trials.filter(t => t.passed);
  return (
    <div>
      <div className="g-panel hi" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Speaker id="me" size={88} robe={{ robe: rank.robe, color: rank.color }} className="anim-bob" />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18 }}>{g.name || '이름 없는 제자'}</div>
          <div style={{ fontSize: 13, color: rank.color, margin: '4px 0 8px' }}>{rank.title}</div>
          <div className="g-dim" style={{ fontSize: 12, lineHeight: 1.8 }}>
            백지첩 {pv.masteredCount}/24{pv.cycle > 1 ? ` (${pv.cycle}회차)` : ''} · 등불 {currentStreak(db)}일 · 최고 {bestStreak(db)}일<br />
            수련한 날 {days}일 · 쓴 글 {db.writings.length}편 · 물리친 요괴 {wins.length}
          </div>
        </div>
      </div>
      {CHAPTERS.map(ch => {
        const cv = pv.chapters.find(c => c.ch.n === ch.n)!;
        return (
          <div key={ch.n} className="g-panel" style={{ marginTop: 12, opacity: cv.status === 'locked' ? 0.5 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="g-h" style={{ margin: 0 }}>{ch.n}장 {ch.title}</span>
              <span className="g-dim" style={{ fontSize: 10 }}>{ch.dim}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }} className="g-dim">
                <Monster id={ch.boss.id} size={22} style={{ opacity: cv.trialPassed ? 1 : 0.3, filter: cv.trialPassed ? 'grayscale(0.7)' : 'brightness(0)' }} />
                {cv.trialPassed ? `${SPEAKER_NAME[ch.boss.id]} 격파` : '시련 전'}
              </span>
            </div>
            {cv.sus.map(sp => (
              <div key={sp.su.n} style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: '2px dashed var(--line-soft)', opacity: sp.mastered ? 1 : 0.5 }}>
                <span style={{ width: 54, fontSize: 11, color: sp.mastered ? 'var(--good)' : 'var(--text-disabled)', flexShrink: 0 }}>제{sp.su.n}수</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{sp.mastered || cv.status !== 'locked' ? sp.su.title : '???'}</div>
                  {sp.mastered && <div style={{ fontSize: 12, color: 'var(--moon)', fontFamily: 'var(--font-read)' }}>「{sp.su.teach[0]}」</div>}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function RecordPage() {
  const [db, setDb] = useState<DB | null>(null);
  const [tab, setTab] = useState<Tab>('book');
  const reload = () => setDb(loadDB());
  useEffect(() => {
    reload();
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    if (t && TABS.some(x => x.k === t)) setTab(t);
    window.addEventListener('db-saved', reload);
    return () => window.removeEventListener('db-saved', reload);
  }, []);
  if (!db) return null;
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 24 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {TABS.map(t => <button key={t.k} className={`g-btn sm ${tab === t.k ? 'primary' : ''}`} onClick={() => setTab(t.k)}>{t.label}</button>)}
      </div>
      {tab === 'book' && <Book db={db} />}
      {tab === 'letters' && <Letters db={db} reload={reload} />}
      {tab === 'report' && <ReportPage />}
      {tab === 'calendar' && <CalendarPage />}
    </div>
  );
}
