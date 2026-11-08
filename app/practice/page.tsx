'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { loadDB, saveDB, loadSettings, aiReady, mergeExpressions, mergeWeaknesses, type DB, type WritingEntry, type WritingAnalysis } from '@/lib/db';
import { analyzeWriting, evaluateWarmup, evaluateRevision, type WarmupFeedback, type RevisionFeedback } from '@/lib/openai';
import { pathView, todayView, todayKey, dayKey, getGame, type Step } from '@/lib/game';
import { ALL_SU, QUESTIONS, EPILOGUE, chapterOf, findOwnSentences, type Su } from '@/lib/curriculum';
import { updateJourneyOnWrite } from '@/lib/journey';
import { Speaker, Monster } from '@/components/art/Art';
import PunctBar from '@/components/practice/PunctBar';
import { playScene } from '@/components/game/ScenePlayer';
import { confirmDialog } from '@/components/ConfirmDialog';

/* ═══════════════════════════════════════════════════════════════
   오늘의 수련 — ① 배우기 → ② 고쳐 쓰기 → ③ 한 편 쓰기 → ④ 퇴고
   재료는 될 수 있으면 '내 글'. 퇴고에서 남긴 이유는 교정 노트로 쌓인다.
═══════════════════════════════════════════════════════════════ */

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function logStep(su: number, step: Step, avg: number, drill: string) {
  const db = loadDB();
  db.drillLogs = [...(db.drillLogs ?? []), { id: Date.now(), drill, avg, createdAt: new Date().toISOString(), su, step }];
  saveDB(db);
}

/** 오늘 이 수에서 한 단계 (복습용) */
function todaySteps(db: DB, n: number): Record<Step, boolean> {
  const t = todayKey();
  const s: Record<Step, boolean> = { warmup: false, write: false, revise: false };
  (db.drillLogs ?? []).forEach(d => { if (d.su === n && d.step && d.step in s && dayKey(d.createdAt) === t) s[d.step] = true; });
  db.writings.forEach(w => { if (w.su === n && dayKey(w.createdAt) === t) s.write = true; });
  return s;
}

const STEP_LABEL: Record<Step | 'teach', string> = { teach: '배우기', warmup: '고쳐 쓰기', write: '한 편 쓰기', revise: '퇴고' };
const ORDER = ['teach', 'warmup', 'write', 'revise'] as const;

const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* ── ① 배우기 ── */
function Teach({ su }: { su: Su }) {
  return (
    <div>
      <div className="lesson-diagnose">{su.diagnose}</div>
      <div className="g-dialog" style={{ marginTop: 10 }}>
        <Speaker id="muk" size={52} />
        <div className="txt">{su.teach.map((t, i) => <p key={i} style={{ margin: '0 0 8px' }}>{t}</p>)}</div>
      </div>
      <ol className="lesson-steps">
        {su.steps.map((s, i) => <li key={i}><b>{i + 1}</b><span>{s}</span></li>)}
      </ol>
      <div className="lesson-example">
        <div className="ex-before"><span>전</span>{su.example.before}</div>
        <div className="ex-after"><span>후</span>{su.example.after}</div>
        <div className="ex-why">{su.example.why}</div>
      </div>
    </div>
  );
}

/* ── ② 고쳐 쓰기 ── */
type FixMode = 'mine' | 'given' | 'copy';
function Fix({ su, db, onDone }: { su: Su; db: DB; onDone: () => void }) {
  const mine = useMemo(() => findOwnSentences(su, db.writings), [su, db.writings]);
  const quotes = useMemo(() => [
    ...(db.bookNotes ?? []).filter(n => n.quote).map(n => ({ text: n.quote!, from: db.books.find(b => b.id === n.bookId)?.title ?? '서고' })),
    ...db.sentences.map(s => ({ text: s.sentence, from: s.source })),
  ].filter(x => x.text && x.text.length >= 8 && x.text.length < 220), [db]);
  const [mode, setMode] = useState<FixMode>(mine.length ? 'mine' : 'given');
  const [pick, setPick] = useState(() => hash(todayKey() + su.n));
  const pool = mode === 'mine' ? mine : mode === 'copy' ? quotes : su.fix.items.map(t => ({ text: t, from: '' }));
  const item = pool.length ? pool[pick % pool.length] : null;
  const task = mode === 'copy'
    ? `이 문장이 왜 좋은지 한 줄로 적고, 그 구조(길이·리듬·뼈대)를 빌려 내 이야기 한 문장을 지어 보게. 오늘 배운 「${su.title}」을 섞으면 더 좋다.`
    : su.fix.task;
  const [why, setWhy] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<WarmupFeedback | null>(null);
  const [msg, setMsg] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const s = loadSettings();
    if (!aiReady(s)) { setMsg('설정에서 AI를 먼저 연결해 주세요.'); return; }
    if (!item) return;
    if (mode === 'copy' && !why.trim()) { setMsg('왜 좋은지 한 줄부터 적게.'); return; }
    setBusy(true); setMsg('');
    try {
      const ans = mode === 'copy' ? `[왜 좋은가] ${why.trim()}\n[구조를 빌린 내 문장] ${answer.trim()}` : answer.trim();
      const r = await evaluateWarmup(s, su.title, `${su.diagnose} ${su.teach.join(' ')} 방법: ${su.steps.join(' / ')}`, task, item.text, ans);
      setFb(r);
      logStep(su.n, 'warmup', r.applied ? 7 : 4, mode === 'mine' ? '내 글 고쳐 쓰기' : mode === 'copy' ? '필사 분석' : '고쳐 쓰기');
      onDone();
    } catch (e) { setMsg('오류: ' + err(e)); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {!fb && (
        <div className="seg">
          {mine.length > 0 && <button className={mode === 'mine' ? 'on' : ''} onClick={() => { setMode('mine'); setAnswer(''); }}>내 글에서 <small>{mine.length}</small></button>}
          <button className={mode === 'given' ? 'on' : ''} onClick={() => { setMode('given'); setAnswer(''); }}>제시 문장</button>
          {quotes.length > 0 && <button className={mode === 'copy' ? 'on' : ''} onClick={() => { setMode('copy'); setAnswer(''); }}>필사 분석</button>}
        </div>
      )}
      <div style={{ fontSize: 13, margin: '8px 0 6px', lineHeight: 1.6 }}>{task}</div>
      {item ? (
        <div className="g-panel fix-source">
          {item.text}
          {item.from && <div className="g-dim" style={{ fontSize: 11, marginTop: 4 }}>— {mode === 'mine' ? `내 글 · ${item.from}` : item.from}</div>}
        </div>
      ) : <div className="g-dim" style={{ fontSize: 13 }}>고칠 문장이 없다.</div>}
      {!fb && pool.length > 1 && <button className="g-btn sm" onClick={() => { setPick(p => p + 1); setAnswer(''); }}>다른 문장</button>}
      {mode === 'copy' && (
        <input className="px-input" value={why} onChange={e => setWhy(e.target.value)} disabled={!!fb} placeholder="이 문장이 좋은 이유 한 줄" style={{ width: '100%', marginTop: 8 }} />
      )}
      <textarea ref={ta} className="px-textarea" value={answer} onChange={e => setAnswer(e.target.value)} disabled={!!fb} style={{ minHeight: 76, marginTop: 6 }}
        placeholder={mode === 'copy' ? '구조를 빌린 내 문장' : '고친 문장을 쓰게. 한두 문장이면 된다.'} />
      {!fb && <PunctBar target={ta} value={answer} onChange={setAnswer} />}
      {!fb && <button className="g-btn primary" disabled={busy || !answer.trim() || !item} onClick={submit}>{busy ? '스승이 읽는 중…' : '스승에게 보이기'}</button>}
      {msg && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 6 }}>{msg}</div>}
      {fb && (
        <div className="anim-in" style={{ marginTop: 10 }}>
          <div className="g-dialog"><Speaker id="muk" size={36} emotion={fb.applied ? 'happy' : 'think'} />
            <div className="txt" style={{ fontSize: 14 }}>{fb.feedback}</div></div>
          {fb.better && <div className="fix-better"><span>본보기</span>{fb.better}</div>}
        </div>
      )}
    </div>
  );
}

/* ── ③ 한 편 쓰기 ── */
type WriteMode = 'su' | 'q' | 'photo' | 'gift';
function Compose({ su, onDone }: { su: Su; onDone: () => void }) {
  const [gift] = useState(() => { try { return localStorage.getItem('wc_gift_word') || ''; } catch { return ''; } });
  const [mode, setMode] = useState<WriteMode>(gift ? 'gift' : 'su');
  const [roll, setRoll] = useState(0);
  const question = QUESTIONS[(hash(todayKey()) + roll) % QUESTIONS.length];
  const [variant, setVariant] = useState(() => Math.floor(Math.random() * 40));
  const [img, setImg] = useState<string | null>(null);
  const [imgState, setImgState] = useState<'idle' | 'loading' | 'error'>('idle');
  const past = useMemo(() => loadDB().writings.filter(w => w.su === su.n).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0], [su.n]);
  const topic = mode === 'su' ? su.write.prompt : mode === 'q' ? question : mode === 'gift' ? `먹물이 물어 온 낱말: ${gift}` : `사진 속 장면으로 — 「${su.title}」을 써서`;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState(0);
  const [res, setRes] = useState<WritingAnalysis | null>(null);
  const [msg, setMsg] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  const min = su.write.min;

  useEffect(() => {
    if (mode !== 'photo' || !su.photo) return;
    let cancelled = false;
    setImgState('loading'); setImg(null);
    fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ su: su.n, variant }) })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => { if (!cancelled) { setImg(j.url); setImgState('idle'); } })
      .catch(() => { if (!cancelled) setImgState('error'); });
    return () => { cancelled = true; };
  }, [mode, su.n, su.photo, variant]);

  async function submit() {
    const s = loadSettings();
    if (!aiReady(s)) { setMsg('설정에서 AI를 먼저 연결해 주세요.'); return; }
    if (text.trim().length < min) { setMsg(`${min}자 이상 쓰게. (지금 ${text.trim().length}자)`); return; }
    setBusy(true); setMsg(''); setStream(0);
    try {
      const a = await analyzeWriting(s, su.write.type, topic, text.trim(), c => setStream(n => n + c.length), { title: su.title, checks: su.write.checks });
      const db = loadDB();
      const entry: WritingEntry = {
        id: Date.now(), date: todayKey(), type: su.write.type as WritingEntry['type'], topic: `[제${su.n}수 ${su.title}] ${topic}`,
        text: text.trim(), status: '분석완료', analysis: a, createdAt: new Date().toISOString(), su: su.n, imageUrl: mode === 'photo' ? img ?? undefined : undefined,
      };
      db.writings.push(entry);
      mergeExpressions(db, a.expressions || []);
      mergeWeaknesses(db, a.weaknesses || []);
      updateJourneyOnWrite(db);
      saveDB(db);
      setRes(a);
      if (mode === 'gift') { try { localStorage.removeItem('wc_gift_word'); } catch { /* */ } }
      onDone();
    } catch (e) { setMsg('분석 오류: ' + err(e)); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {!res && (
        <div className="seg">
          <button className={mode === 'su' ? 'on' : ''} onClick={() => setMode('su')}>오늘의 주제</button>
          <button className={mode === 'q' ? 'on' : ''} onClick={() => setMode('q')}>오늘의 질문</button>
          {su.photo && <button className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')}>사진 보고</button>}
          {gift && <button className={mode === 'gift' ? 'on' : ''} onClick={() => setMode('gift')}>먹물의 낱말</button>}
        </div>
      )}
      {mode === 'photo' && (
        <div className="compose-photo">
          {img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={img} alt={`${su.title} 글감 사진`} />
            : <div className="g-dim">{imgState === 'error' ? <>사진을 그리지 못했군. <button className="g-btn sm" onClick={() => setVariant(v => v + 1)}>다시</button></> : '장면을 그리는 중… (10초쯤)'}</div>}
          {img && !res && <button className="g-btn sm" onClick={() => setVariant(v => v + 2)}>↻ 다른 장면</button>}
        </div>
      )}
      <div className="g-panel" style={{ fontFamily: 'var(--font-read)', fontSize: 15, marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ flex: 1 }}>{topic}</span>
          {mode === 'q' && !res && <button className="g-btn sm" onClick={() => setRoll(r => r + 1)} aria-label="다른 질문">↻</button>}
        </div>
        <ul className="check-list">{su.write.checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </div>
      {past && !res && (
        <details className="g-panel" style={{ marginTop: 8, padding: '10px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 13 }} className="g-dim">지난번 이 수에서 쓴 글 · {past.createdAt.slice(0, 10)}{past.analysis ? ` · 종합 ${past.analysis.score}` : ''}</summary>
          <div className="t-read" style={{ fontSize: 14, lineHeight: 1.9, whiteSpace: 'pre-wrap', marginTop: 8 }}>{past.revised?.text ?? past.text}</div>
          <div className="g-dim" style={{ fontSize: 12, marginTop: 6 }}>그때의 나보다 한 문장만 더 낫게 쓰면 된다.</div>
        </details>
      )}
      <textarea ref={ta} className="px-textarea" value={text} onChange={e => setText(e.target.value)} disabled={busy || !!res} style={{ minHeight: 220, marginTop: 8, width: '100%' }} placeholder="10분. 완벽하지 않아도 끝까지. 고치는 건 ④에서 한다." />
      {!res && <PunctBar target={ta} value={text} onChange={setText} />}
      {!res && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="g-btn primary" disabled={busy || !text.trim() || (mode === 'photo' && !img)} onClick={submit}>{busy ? `스승이 읽는 중… ${stream ? `(${stream})` : ''}` : '다 썼다'}</button>
          <span style={{ fontSize: 12, color: text.trim().length >= min ? 'var(--good)' : 'var(--dim-star)' }}>{text.trim().length} / {min}자</span>
        </div>
      )}
      {msg && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 6 }}>{msg}</div>}
      {res && (
        <div className="anim-in" style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="g-chip" style={{ color: 'var(--accent)' }}>종합 {res.score}</span>
            {Object.entries(res.score_breakdown).map(([k, v]) => <span key={k} className="g-chip">{k} {v}</span>)}
          </div>
          {res.strengths?.[0] && <div style={{ fontSize: 13, color: 'var(--good)', marginBottom: 4 }}>잘된 점 · {res.strengths[0]}</div>}
          {res.weaknesses?.slice(0, 2).map((w, i) => <div key={i} style={{ fontSize: 13, color: 'var(--moon)', marginBottom: 4, fontFamily: 'var(--font-read)' }}>다듬을 점 · {w}</div>)}
        </div>
      )}
    </div>
  );
}

/* ── ④ 퇴고 ── */
function Revise({ su, db, onDone }: { su: Su; db: DB; onDone: () => void }) {
  const target = useMemo(() => {
    const mine = db.writings.filter(w => w.su === su.n).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mine.find(w => dayKey(w.createdAt) === todayKey()) ?? mine[0] ?? null;
  }, [db.writings, su.n]);
  const [text, setText] = useState(() => target?.revised?.text ?? target?.text ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<RevisionFeedback | null>(null);
  const [msg, setMsg] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setText(target?.revised?.text ?? target?.text ?? ''); }, [target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return <div className="g-dim" style={{ fontSize: 13 }}>먼저 ③ 한 편 쓰기를 마치게. 퇴고는 자네 글로 한다.</div>;
  const pointed = [...(target.analysis?.weaknesses ?? []).slice(0, 2), ...(target.analysis?.improvement_examples ?? []).slice(0, 1)];
  const changed = text.trim() !== target.text.trim();

  async function submit() {
    const s = loadSettings();
    if (!aiReady(s)) { setMsg('설정에서 AI를 먼저 연결해 주세요.'); return; }
    if (!changed) { setMsg('한 곳이라도 고치게.'); return; }
    if (!note.trim()) { setMsg('고친 이유를 한 줄 남기게. 그게 교정 노트가 된다.'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await evaluateRevision(s, su.title, su.write.checks, target!.text, text.trim(), note.trim(), pointed);
      const fresh = loadDB();
      const w = fresh.writings.find(x => x.id === target!.id);
      if (w) w.revised = { text: text.trim(), note: note.trim(), at: new Date().toISOString(), feedback: r.feedback, improved: r.improved };
      saveDB(fresh);
      logStep(su.n, 'revise', r.improved ? 7 : 4, '퇴고');
      setFb(r);
      onDone();
    } catch (e) { setMsg('오류: ' + err(e)); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
        고칠 곳을 찾는 일과 고치는 일을 나누게. 먼저 소리 내어 읽으며 걸리는 곳을 찾고, 아래 기준으로 고치게.
      </div>
      <div className="g-panel" style={{ fontSize: 13 }}>
        <div className="g-h" style={{ marginBottom: 4 }}>볼 곳</div>
        <ul className="check-list" style={{ marginTop: 0 }}>
          {su.write.checks.map((c, i) => <li key={`c${i}`}>{c}</li>)}
          {pointed.map((p, i) => <li key={`p${i}`} className="pointed">{p}</li>)}
        </ul>
      </div>
      <textarea ref={ta} className="px-textarea" value={text} onChange={e => setText(e.target.value)} disabled={busy || !!fb} style={{ minHeight: 220, marginTop: 8, width: '100%' }} />
      {!fb && <PunctBar target={ta} value={text} onChange={setText} />}
      {!fb && (
        <>
          <input className="px-input" value={note} onChange={e => setNote(e.target.value)} placeholder="고친 이유 한 줄 (예: '슬펐다'를 지우고 번호를 못 지운 장면으로)" style={{ width: '100%', marginTop: 6 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <button className="g-btn primary" disabled={busy || !changed || !note.trim()} onClick={submit}>{busy ? '스승이 비교하는 중…' : '고친 글 보이기'}</button>
            <button className="g-btn sm" onClick={() => setText(target.text)} disabled={!changed}>원문으로</button>
          </div>
        </>
      )}
      {msg && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 6 }}>{msg}</div>}
      {fb && (
        <div className="anim-in" style={{ marginTop: 10 }}>
          <div className="g-dialog"><Speaker id="muk" size={36} emotion={fb.improved ? 'happy' : 'think'} />
            <div className="txt" style={{ fontSize: 14 }}>{fb.feedback}</div></div>
          {fb.next && <div className="fix-better"><span>다음엔</span>{fb.next}</div>}
        </div>
      )}
    </div>
  );
}

/* ── 교정 노트 — 퇴고 때 남긴 이유가 모여 '내가 자주 고치는 것'이 된다 ── */
function CorrectionNotes({ db }: { db: DB }) {
  const notes = db.writings.filter(w => w.revised).sort((a, b) => b.revised!.at.localeCompare(a.revised!.at)).slice(0, 8);
  return (
    <div className="g-panel" style={{ marginTop: 12 }}>
      <div className="g-h">교정 노트 <span className="g-dim" style={{ marginLeft: 'auto', fontSize: 10 }}>퇴고 때 남긴 이유</span></div>
      {notes.length === 0
        ? <div className="g-dim" style={{ fontSize: 13 }}>아직 비어 있다. 퇴고할 때마다 한 줄씩 쌓이고, 쌓이면 자네가 반복하는 실수가 보인다.</div>
        : notes.map(w => {
          const s = w.su ? ALL_SU.find(x => x.n === w.su) : null;
          return (
            <div key={w.id} className="note-row">
              <span className="g-dim">{w.revised!.at.slice(5, 10)}{s ? ` · ${s.title}` : ''}</span>
              <span>{w.revised!.note}</span>
              <span style={{ color: w.revised!.improved ? 'var(--good)' : 'var(--moon)' }}>{w.revised!.improved ? '나아짐' : '다시'}</span>
            </div>
          );
        })}
    </div>
  );
}

export default function PracticePage() {
  const [db, setDb] = useState<DB | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [open, setOpen] = useState<Step | 'teach' | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const load = () => setDb(loadDB());
    load();
    window.addEventListener('db-saved', load);
    return () => window.removeEventListener('db-saved', load);
  }, []);
  if (!db) return null;

  const g = getGame(db);
  const pv = pathView(db);
  const tv = todayView(db);
  const activeN = selected ?? tv.su?.n ?? null;
  const su = activeN ? ALL_SU.find(s => s.n === activeN)! : null;
  const ch = su ? chapterOf(su.n) : null;
  const isCurrent = !!su && pv.current?.su.n === su.n;
  const steps: Record<Step, boolean> = su
    ? (isCurrent ? pv.current!.steps : todaySteps(db, su.n))
    : { warmup: false, write: false, revise: false };
  const nextStep: Step = !steps.warmup ? 'warmup' : !steps.write ? 'write' : 'revise';
  const started = steps.warmup || steps.write || steps.revise;
  const shown = open ?? (started ? nextStep : 'teach');
  const allDone = steps.warmup && steps.write && steps.revise;
  const go = (k: Step | 'teach') => { setOpen(k); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  async function startNextCycle() {
    if (!await confirmDialog(`${g.cycle + 1}회차를 시작할까? 같은 24수를 더 높은 기준으로 다시 돈다. (지난 기록은 그대로 남는다)`, { confirmLabel: '시작' })) return;
    const fresh = loadDB();
    const gg = getGame(fresh);
    fresh.game = { ...gg, cycle: gg.cycle + 1, cycleStart: new Date().toISOString() };
    saveDB(fresh);
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 24 }}>
      {/* 머리: 지금 장의 그림 위에 오늘의 수 */}
      <div className="g-stage practice-banner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/art/cg_ch${ch?.n ?? pv.trialChapter?.ch.n ?? 6}.webp`} alt="" className="stage-img" />
        <div className="practice-banner-shade" />
        <div className="practice-banner-text">
          <Speaker id="muk" size={52} style={{ border: '2px solid rgba(251,247,236,0.8)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{pv.cycle > 1 ? `${pv.cycle}회차 · ` : ''}백지첩 {pv.masteredCount} / 24{ch ? ` · ${ch.n}장 ${ch.title} · ${ch.dim}` : ''}{selected && !isCurrent ? ' · 복습' : ''}</div>
            <div className="t-title" style={{ fontSize: 'clamp(20px, 3.4vw, 28px)', margin: '2px 0' }}>{su ? `제${su.n}수 「${su.title}」` : pv.trialChapter ? `시련 · ${pv.trialChapter.ch.title}` : '백지첩을 모두 되살렸다'}</div>
          </div>
          {tv.done && !selected && <span className="seal" style={{ fontSize: 12 }}>오늘 등불</span>}
        </div>
      </div>

      {/* 시련 대기 */}
      {!su && pv.trialChapter && (
        <div className="g-panel boss" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <Monster id={pv.trialChapter.ch.boss.id} size={72} className="anim-bob" />
          <div style={{ flex: 1 }}>
            <div className="g-h" style={{ color: 'var(--bad)' }}>{pv.trialChapter.ch.n}장 시련</div>
            <div style={{ fontSize: 13, marginBottom: 6, fontFamily: 'var(--font-read)' }}>{pv.trialChapter.ch.title}의 네 수를 모두 익혔다. 이 장의 약점이 요괴가 되어 기다리고 있다.</div>
            <div className="g-dim" style={{ fontSize: 11, marginBottom: 6 }}>조건: {pv.trialChapter.rule.text}</div>
            <Link href={`/practice/trial?ch=${pv.trialChapter.ch.n}`} className="g-btn danger">시련에 들기 →</Link>
          </div>
        </div>
      )}

      {/* 회차 끝 */}
      {!su && pv.cycleDone && (
        <div className="g-panel hi" style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>백지첩 스물네 장이 모두 돌아왔다.</div>
          <button className="g-btn" onClick={() => playScene({ id: `c${pv.cycle}:epilogue`, title: '백지첩 · 끝', lines: EPILOGUE, bg: 'cg_epilogue', replay: true })}>에필로그</button>
          <button className="g-btn primary" onClick={startNextCycle}>{pv.cycle + 1}회차 시작 →</button>
        </div>
      )}

      {/* 오늘 마침 */}
      {su && tv.done && !selected && isCurrent && !started && (
        <div className="g-panel" style={{ marginTop: 12, '--frame': 'var(--good)' } as React.CSSProperties}>
          <div className="g-dialog"><Speaker id="muk" emotion="happy" size={40} />
            <div className="txt" style={{ fontSize: 14 }}>오늘 등불은 켜졌다. 쉬어도 좋고, 기운이 남았으면 다음 수를 미리 봐도 좋다.</div></div>
        </div>
      )}

      {/* 수련 4단계 */}
      {su && (
        <div key={`${su.n}-${nonce}`}>
          <div className="step-tabs">
            {ORDER.map((k, i) => {
              const done = k === 'teach' ? started : steps[k];
              return (
                <button key={k} className={`${shown === k ? 'on' : ''}${done ? ' done' : ''}`} onClick={() => setOpen(k)}>
                  <b>{done ? '✓' : i + 1}</b>{STEP_LABEL[k]}
                </button>
              );
            })}
          </div>
          <div className="g-panel">
            {shown === 'teach' && <>
              <Teach su={su} />
              <button className="g-btn primary" style={{ marginTop: 12 }} onClick={() => go('warmup')}>익혔다 → 고쳐 쓰기</button>
            </>}
            {shown === 'warmup' && <>
              <div className="g-h">② 고쳐 쓰기 · 3분</div>
              <Fix su={su} db={db} onDone={() => {}} />
              {steps.warmup && <button className="g-btn primary" style={{ marginTop: 10 }} onClick={() => go('write')}>다음 → 한 편 쓰기</button>}
            </>}
            {shown === 'write' && <>
              <div className="g-h">③ 한 편 쓰기 · 10분</div>
              <Compose su={su} onDone={() => {}} />
              {steps.write && <button className="g-btn primary" style={{ marginTop: 10 }} onClick={() => go('revise')}>다음 → 퇴고</button>}
            </>}
            {shown === 'revise' && <>
              <div className="g-h">④ 퇴고 · 5분</div>
              <Revise su={su} db={db} onDone={() => setSelected(su.n) /* 마친 수를 그대로 보여 준다 — '한 장 복원'은 GameLayer가 알린다 */} />
            </>}
          </div>
          {allDone && (
            <div className="g-panel" style={{ marginTop: 8, '--frame': 'var(--good)' } as React.CSSProperties}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>제{su.n}수를 마쳤다.</div>
              {pv.current && pv.current.su.n !== su.n && <button className="g-btn primary" onClick={() => { setSelected(pv.current!.su.n); setOpen('teach'); setNonce(n => n + 1); }}>다음 수 「{pv.current.su.title}」 보기</button>}
              <button className="g-btn" onClick={() => { setOpen('warmup'); setNonce(n => n + 1); }}>같은 수 한 번 더</button>
              <Link href="/" className="g-btn">서재로</Link>
            </div>
          )}
        </div>
      )}

      <CorrectionNotes db={db} />

      {/* 백지첩 목차 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">백지첩 목차 <span className="g-dim" style={{ marginLeft: 'auto', fontSize: 10 }}>익힌 수는 언제든 복습</span></div>
        {pv.chapters.map(cv => (
          <div key={cv.ch.n} style={{ padding: '8px 0', borderTop: '1px dashed var(--line-soft)', opacity: cv.status === 'locked' ? 0.45 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: cv.status === 'done' ? 'var(--good)' : cv.status === 'locked' ? 'var(--text-disabled)' : 'var(--accent)' }}>{cv.ch.n}장 {cv.ch.title}</span>
              <span className="g-dim" style={{ fontSize: 11 }}>{cv.ch.dim}</span>
              <Monster id={cv.ch.boss.id} size={22} style={{ marginLeft: 'auto', opacity: cv.trialPassed ? 0.3 : 1, filter: cv.status === 'locked' ? 'brightness(0)' : undefined }} />
            </div>
            <div className="toc-grid">
              {cv.sus.map(sp => {
                const unlocked = sp.mastered || pv.current?.su.n === sp.su.n;
                const active = su?.n === sp.su.n;
                return (
                  <button key={sp.su.n} className={`g-btn sm ${active ? 'primary' : ''}`} disabled={!unlocked} style={{ justifyContent: 'flex-start', margin: 0 }}
                    onClick={() => { setSelected(pv.current?.su.n === sp.su.n ? null : sp.su.n); setOpen('teach'); setNonce(n => n + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <span style={{ color: sp.mastered && !active ? 'var(--good)' : undefined }}>{sp.mastered ? '●' : '○'}</span>
                    {sp.su.n}. {unlocked ? sp.su.title : '???'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
