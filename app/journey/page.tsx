'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDB, saveDB, loadSettings, aiReady, type DB, type WritingEntry } from '@/lib/db';
import { pathView, getGame, rankOf, streakInfo, practiceDays, weekKey, todayKey, addDays, dayKey } from '@/lib/game';
import { CHAPTERS, SPEAKER_NAME } from '@/lib/curriculum';
import { MEMORIES, OBJECTS, studyObjects } from '@/lib/story';
import { writeWeeklyLetter } from '@/lib/openai';
import { Speaker, Monster, Art } from '@/components/art/Art';
import { playScene } from '@/components/game/ScenePlayer';
import ReportPage from '@/app/report/page';
import CalendarPage from '@/app/calendar/page';

type Tab = 'map' | 'memories' | 'letters' | 'report' | 'calendar';
const TABS: { k: Tab; label: string }[] = [
  { k: 'map', label: '산마루 지도' }, { k: 'memories', label: '기억첩' }, { k: 'letters', label: '주간 편지' }, { k: 'report', label: '성장 리포트' }, { k: 'calendar', label: '달력' },
];

function weekLabel(w: string) { const e = addDays(w, 6); return `${w.slice(5).replace('-', '/')} ~ ${e.slice(5).replace('-', '/')}`; }

/* ── 주간 편지 + 답장 ── */
function Letters({ db, reload }: { db: DB; reload: () => void }) {
  const g = getGame(db);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [reply, setReply] = useState<Record<string, string>>({});
  const thisWeek = weekKey(todayKey());
  const weeks = [addDays(thisWeek, -7), thisWeek];
  const writingsOf = (w: string) => db.writings.filter(x => weekKey((x.date || x.createdAt).slice(0, 10)) === w && !x.topic.startsWith('[답장]'));

  async function request(w: string) {
    const s = loadSettings();
    if (!aiReady(s)) { setErr('설정에서 AI를 먼저 연결해 주세요.'); return; }
    const ws = writingsOf(w);
    if (!ws.length) { setErr('그 주에 쓴 글이 없군.'); return; }
    setBusy(w); setErr('');
    try {
      const pv = pathView(db);
      const learned = pv.chapters.flatMap(c => c.sus).filter(s => s.masteredAt && weekKey(dayKey(s.masteredAt)) === w).map(s => s.su.title);
      const prevReply = [...g.letters].filter(l => l.week < w && l.reply).sort((a, b) => b.week.localeCompare(a.week))[0]?.reply?.text;
      const text = await writeWeeklyLetter(s, g.name, weekLabel(w),
        ws.map(x => ({ title: x.topic || x.type, type: x.type, text: x.text, score: x.analysis?.score, weak: x.analysis?.weaknesses })),
        streakInfo(db).streak, learned, prevReply);
      const fresh = loadDB();
      const gg = getGame(fresh);
      const old = gg.letters.find(l => l.week === w);
      fresh.game = { ...gg, letters: [...gg.letters.filter(l => l.week !== w), { week: w, text, createdAt: new Date().toISOString(), reply: old?.reply }] };
      saveDB(fresh); reload();
    } catch (e) { setErr('오류: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); }
  }

  function sendReply(week: string) {
    const text = (reply[week] ?? '').trim();
    if (text.length < 30) { setErr('답장은 30자 이상 써 주게.'); return; }
    const fresh = loadDB();
    const gg = getGame(fresh);
    const id = Date.now();
    const entry: WritingEntry = { id, date: todayKey(), type: '에세이', topic: `[답장] 묵당 선생께 (${weekLabel(week)} 편지)`, text, status: '미분석', createdAt: new Date().toISOString() };
    fresh.writings.push(entry);
    fresh.game = { ...gg, letters: gg.letters.map(l => (l.week === week ? { ...l, reply: { text, at: new Date().toISOString(), writingId: id } } : l)) };
    saveDB(fresh); setErr(''); reload();
  }

  const letters = [...g.letters].sort((a, b) => b.week.localeCompare(a.week));
  return (
    <div>
      <div className="g-panel">
        <div className="g-dialog"><Speaker id="muk" size={52} />
          <div className="txt" style={{ fontSize: 15 }}>한 주가 끝나면 자네 글을 다 읽고 편지를 쓰지. 가장 좋았던 문장 하나, 반복되는 버릇 하나, 다음 주에 해 볼 것 하나. 답장을 주면 다음 편지에서 읽겠다.</div></div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 12 }}>
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
        {err && <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 6 }}>{err}</div>}
      </div>
      {letters.map((l, i) => (
        <div key={l.week} className="letter anim-in">
          <div style={{ fontSize: 12, color: '#a8772c', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}><span>{weekLabel(l.week)}</span><span className="seal" style={{ fontSize: 12 }}>墨堂</span></div>
          <div className="t-read" style={{ fontSize: 16, lineHeight: 2, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>{l.text}</div>
          {l.reply ? (
            <div className="letter-reply"><div style={{ fontSize: 12, color: '#7b6f60', marginBottom: 6 }}>나의 답장 · {l.reply.at.slice(0, 10)}</div><div className="t-read" style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.9 }}>{l.reply.text}</div></div>
          ) : i === 0 && (
            <div className="letter-reply">
              <div style={{ fontSize: 12.5, color: '#7b6f60', marginBottom: 6 }}>답장 쓰기 — 이것도 오늘의 글로 남는다</div>
              <textarea className="px-textarea" style={{ minHeight: 140, width: '100%', background: 'transparent' }} value={reply[l.week] ?? ''} onChange={e => setReply(r => ({ ...r, [l.week]: e.target.value }))} placeholder="선생님께," />
              <button className="g-btn primary sm" onClick={() => sendReply(l.week)}>답장 보내기</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── 산마루 지도: 6장이 산길의 여섯 구역 ── */
const ZONES: [number, number][] = [[48, 86], [52, 71], [55, 57], [55, 45], [47, 34], [51, 16]];
function MapView({ db }: { db: DB }) {
  const g = getGame(db);
  const pv = pathView(db);
  const rank = rankOf(db);
  const si = streakInfo(db);
  const days = practiceDays(db).size;
  const wins = g.trials.filter(t => t.passed);
  const curIdx = Math.max(0, pv.chapters.findIndex(c => c.status === 'current' || c.status === 'trial'));
  const here = pv.cycleDone ? 5 : curIdx;
  return (
    <div className="map-wrap">
      <div className="map-col">
        <div className="map-img">
          <Art id="map" className="stage-img" />
          {pv.chapters.map((cv, i) => {
            const [x, y] = ZONES[i];
            return (
              <div key={cv.ch.n} className={`map-pin ${cv.status === 'done' ? 'done' : ''} ${cv.status === 'locked' ? 'locked' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} title={`${cv.ch.n}장 ${cv.ch.title}`}>
                <span>{cv.ch.n}</span>
              </div>
            );
          })}
          <div className="map-me anim-float" style={{ left: `${ZONES[here][0] + 9}%`, top: `${ZONES[here][1] - 6}%` }}><Speaker id="me" size={46} /></div>
        </div>
      </div>
      <div className="map-side">
        <div className="g-panel hi" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Speaker id="me" size={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-title" style={{ fontSize: 19 }}>{g.name || '이름 없는 제자'}</div>
            <div style={{ margin: '6px 0 8px' }}><span className="seal" style={{ fontSize: 12 }}>{rank.title}</span></div>
            <div className="g-dim" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
              백지첩 {pv.masteredCount}/24{pv.cycle > 1 ? ` (${pv.cycle}회차)` : ''} · 등불 {si.streak}일 · 최고 {si.best}일{si.drops ? ` · 먹 한 방울 ${si.drops}` : ''}<br />
              수련한 날 {days}일 · 쓴 글 {db.writings.length}편 · 놓아 보낸 요괴 {wins.length}
            </div>
          </div>
        </div>
        {CHAPTERS.map(ch => {
          const cv = pv.chapters.find(c => c.ch.n === ch.n)!;
          return (
            <div key={ch.n} className="g-panel" style={{ marginTop: 10, opacity: cv.status === 'locked' ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Monster id={ch.boss.id} size={40} style={{ opacity: cv.status === 'locked' ? 0.25 : cv.trialPassed ? 0.45 : 1, filter: cv.status === 'locked' ? 'grayscale(1) brightness(0.6)' : cv.trialPassed ? 'grayscale(0.8)' : undefined }} />
                <div style={{ flex: 1 }}>
                  <div className="t-title" style={{ fontSize: 15 }}>{ch.n}장 {ch.title} <span className="g-dim" style={{ fontSize: 12, fontWeight: 400 }}>· {ch.dim}</span></div>
                  <div className="g-dim" style={{ fontSize: 12 }}>{cv.trialPassed ? `${SPEAKER_NAME[ch.boss.id]} — 놓아 보냄` : cv.status === 'locked' ? '아직 안개 속' : `${SPEAKER_NAME[ch.boss.id]}이(가) 기다린다`}</div>
                </div>
              </div>
              {cv.sus.map(sp => (
                <div key={sp.su.n} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: '1px dashed var(--line-soft)', opacity: sp.mastered ? 1 : 0.55 }}>
                  <span style={{ width: 46, fontSize: 12, color: sp.mastered ? 'var(--seal)' : 'var(--text-disabled)', flexShrink: 0, fontWeight: 600 }}>제{sp.su.n}수</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5 }}>{sp.mastered || cv.status !== 'locked' ? sp.su.title : '???'}</div>
                    {sp.mastered && <div className="t-read" style={{ fontSize: 13, color: 'var(--dim-star)' }}>「{sp.su.teach[0]}」</div>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 기억첩: 묵당의 기억 20편 + 서재의 물건 ── */
function Memories({ db }: { db: DB }) {
  const days = practiceDays(db).size;
  const objs = studyObjects(days);
  return (
    <div>
      <div className="g-panel" style={{ marginBottom: 12 }}>
        <div className="g-dialog"><Speaker id="muk" emotion="think" size={52} />
          <div className="txt" style={{ fontSize: 15 }}>자주 오는 사람에게만 꺼내는 이야기가 있지. 수련한 날이 쌓일 때마다 하나씩 들려주지. (지금 {days}일)</div></div>
      </div>
      <div className="mem-grid">
        {MEMORIES.map(m => {
          const open = m.day <= days;
          return (
            <button key={m.id} className={`mem-card ${open ? '' : 'locked'}`} disabled={!open}
              onClick={() => playScene({ id: `mem:${m.id}`, title: `묵당의 기억 · ${m.title}`, lines: m.lines, bg: m.bg, replay: true })}>
              <div className="mem-thumb">{open && m.bg ? <Art id={m.bg} className="stage-img" /> : open && m.obj ? <Art id={`obj_${m.obj}`} style={{ height: '78%', margin: 'auto', display: 'block', paddingTop: '6%' }} /> : <span>{open ? '墨' : '?'}</span>}</div>
              <div style={{ padding: '8px 10px 10px', textAlign: 'left' }}>
                <div style={{ fontSize: 11.5, color: 'var(--dim-star)' }}>{m.day}일째</div>
                <div className="t-title" style={{ fontSize: 14 }}>{open ? m.title : '아직 열리지 않은 기억'}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="g-h" style={{ marginTop: 22 }}>서재의 물건 · {objs.length}/{Object.keys(OBJECTS).length}</div>
      <div className="obj-grid">
        {Object.values(OBJECTS).map(o => {
          const have = objs.some(x => x.id === o.id);
          return (
            <div key={o.id} className={`g-panel obj-card ${have ? '' : 'locked'}`}>
              <Art id={`obj_${o.id}`} style={{ width: 72, height: 72, objectFit: 'contain', filter: have ? undefined : 'grayscale(1) brightness(0.3) opacity(0.35)' }} />
              <div><div className="t-title" style={{ fontSize: 14 }}>{have ? o.name : '???'}</div><div className="g-dim t-read" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{have ? o.note : '기억이 열리면 서재에 놓인다.'}</div></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RecordPage() {
  const [db, setDb] = useState<DB | null>(null);
  const [tab, setTab] = useState<Tab>('map');
  const reload = () => setDb(loadDB());
  useEffect(() => {
    reload();
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && TABS.some(x => x.k === t)) setTab(t as Tab);
    window.addEventListener('db-saved', reload);
    return () => window.removeEventListener('db-saved', reload);
  }, []);
  if (!db) return null;
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', paddingBottom: 24 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map(t => <button key={t.k} className={`g-btn sm ${tab === t.k ? 'primary' : ''}`} onClick={() => setTab(t.k)}>{t.label}</button>)}
        <Link href="/writing/book" className="g-btn sm" style={{ marginLeft: 'auto' }}>나의 문집 →</Link>
      </div>
      {tab === 'map' && <MapView db={db} />}
      {tab === 'memories' && <Memories db={db} />}
      {tab === 'letters' && <Letters db={db} reload={reload} />}
      {tab === 'report' && <ReportPage />}
      {tab === 'calendar' && <CalendarPage />}
    </div>
  );
}
