'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { loadDB, saveDB, loadSettings, aiReady, mergeExpressions, mergeWeaknesses, type DB, type WritingEntry, type WritingAnalysis } from '@/lib/db';
import { analyzeWriting, evaluateWarmup, type WarmupFeedback } from '@/lib/openai';
import { pathView, todayView, todayKey, dayKey, getGame, type Step } from '@/lib/game';
import { CHAPTERS, ALL_SU, QUESTIONS, WORDS, EPILOGUE, chapterOf, type Su } from '@/lib/curriculum';
import { updateJourneyOnWrite } from '@/lib/journey';
import { Speaker, Monster } from '@/components/pixel/Pixel';
import DrillBox from '@/components/practice/DrillBox';
import Missions from '@/components/practice/Missions';
import PunctBar from '@/components/practice/PunctBar';
import { playScene } from '@/components/game/ScenePlayer';
import { confirmDialog } from '@/components/ConfirmDialog';

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function logStep(su: number, step: Step, avg: number, drill: string) {
  const db = loadDB();
  db.drillLogs = [...(db.drillLogs ?? []), { id: Date.now(), drill, avg, createdAt: new Date().toISOString(), su, step }];
  saveDB(db);
}

/** 오늘 이 수에서 한 단계 */
function todaySteps(db: DB, n: number): Record<Step, boolean> {
  const t = todayKey();
  const s: Record<Step, boolean> = { warmup: false, drill: false, write: false };
  (db.drillLogs ?? []).forEach(d => { if (d.su === n && d.step && dayKey(d.createdAt) === t) s[d.step] = true; });
  db.writings.forEach(w => { if (w.su === n && dayKey(w.createdAt) === t) s.write = true; });
  return s;
}

const STEP_LABEL: Record<Step | 'teach', string> = { teach: '가르침', warmup: '워밍업', drill: '사진 훈련', write: '짧은 글' };

/* ── ① 가르침 ── */
function Teach({ su }: { su: Su }) {
  return (
    <div>
      <div className="g-dialog">
        <Speaker id="muk" size={56} />
        <div className="txt">{su.teach.map((t, i) => <p key={i} style={{ margin: '0 0 8px' }}>{t}</p>)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 8 }}>
        <div style={{ padding: 10, boxShadow: '0 0 0 2px var(--bad)' }}>
          <div style={{ fontSize: 11, color: 'var(--bad)', marginBottom: 4 }}>전</div>
          <div style={{ fontFamily: 'var(--font-read)', fontSize: 14, lineHeight: 1.7 }}>{su.example.before}</div>
        </div>
        <div style={{ padding: 10, boxShadow: '0 0 0 2px var(--good)' }}>
          <div style={{ fontSize: 11, color: 'var(--good)', marginBottom: 4 }}>후</div>
          <div style={{ fontFamily: 'var(--font-read)', fontSize: 14, lineHeight: 1.7 }}>{su.example.after}</div>
        </div>
      </div>
    </div>
  );
}

/* ── ② 워밍업 ── */
function Warmup({ su, db, onDone }: { su: Su; db: DB; onDone: () => void }) {
  // 모아 둔 문장(옛 문장 수집)과 서고 인용문은 '필사 변주' 재료가 된다
  const material = useMemo(() => [
    ...db.sentences.map(s => ({ text: s.sentence, from: s.source })),
    ...(db.bookNotes ?? []).filter(n => n.quote).map(n => ({ text: n.quote!, from: db.books.find(b => b.id === n.bookId)?.title ?? '서고' })),
  ].filter(x => x.text && x.text.length < 200), [db]);
  const seed = hash(todayKey() + su.n);
  const [mode, setMode] = useState<'fix' | 'copy'>('fix');
  const [pick, setPick] = useState(seed);
  const item = su.warmup.items[pick % su.warmup.items.length];
  const mat = material.length ? material[pick % material.length] : null;
  const task = mode === 'fix' ? su.warmup.task : `이 문장의 뼈대(길이·리듬·구조)를 빌려, 오늘 배운 「${su.title}」을 써서 내 이야기 한 문장을 지어 보게.`;
  const original = mode === 'fix' ? item : mat?.text ?? '';
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<WarmupFeedback | null>(null);
  const [err, setErr] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const s = loadSettings();
    if (!aiReady(s)) { setErr('설정에서 AI를 먼저 연결해 주세요.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await evaluateWarmup(s, su.title, su.teach.join(' '), task, original, answer.trim());
      setFb(r);
      logStep(su.n, 'warmup', r.applied ? 7 : 4, mode === 'fix' ? '워밍업' : '필사 변주');
      onDone();
    } catch (e) { setErr('오류: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {material.length > 0 && !fb && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button className={`g-btn sm ${mode === 'fix' ? 'primary' : ''}`} onClick={() => setMode('fix')}>고쳐 쓰기</button>
          <button className={`g-btn sm ${mode === 'copy' ? 'primary' : ''}`} onClick={() => setMode('copy')}>모은 문장으로 필사 변주</button>
        </div>
      )}
      <div style={{ fontSize: 13, marginBottom: 6 }}>{task}</div>
      <div className="g-panel" style={{ fontFamily: 'var(--font-read)', fontSize: 15, lineHeight: 1.7 }}>
        {original}
        {mode === 'copy' && mat && <div className="g-dim" style={{ fontSize: 11, marginTop: 4 }}>— {mat.from}</div>}
      </div>
      {!fb && <button className="g-btn sm" onClick={() => setPick(p => p + 1)}>다른 문장</button>}
      <textarea ref={ta} className="px-textarea" value={answer} onChange={e => setAnswer(e.target.value)} disabled={!!fb} style={{ minHeight: 70, marginTop: 6 }} placeholder="한두 문장으로 쓰게." />
      {!fb && <PunctBar target={ta} value={answer} onChange={setAnswer} />}
      {!fb && <button className="g-btn primary" disabled={busy || !answer.trim()} onClick={submit}>{busy ? '스승이 읽는 중…' : '스승에게 보이기'}</button>}
      {err && <div style={{ color: 'var(--bad)', fontSize: 12 }}>{err}</div>}
      {fb && (
        <div className="anim-in" style={{ marginTop: 10 }}>
          <div className="g-dialog"><Speaker id="muk" size={36} emotion={fb.applied ? 'happy' : 'think'} />
            <div className="txt" style={{ fontSize: 14 }}>{fb.feedback}</div></div>
          {fb.better && <div style={{ marginTop: 6, fontSize: 13, fontFamily: 'var(--font-read)' }}><span style={{ color: 'var(--moon)' }}>본보기 </span>{fb.better}</div>}
        </div>
      )}
    </div>
  );
}

/* ── ④ 짧은 글 ── */
function ShortWrite({ su, imageUrl, onDone }: { su: Su; imageUrl?: string; onDone: () => void }) {
  const [mode, setMode] = useState<'su' | 'q' | 'words'>('su');
  const [roll, setRoll] = useState(0);
  const seed = hash(todayKey()) + roll;
  const question = QUESTIONS[seed % QUESTIONS.length];
  const words = useMemo(() => {
    const pool = [...WORDS]; const out: string[] = [];
    let x = seed;
    for (let i = 0; i < 3; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; out.push(pool.splice(x % pool.length, 1)[0]); }
    return out;
  }, [seed]);
  const topic = mode === 'su' ? su.write.prompt : mode === 'q' ? question : `글감 낱말: ${words.join(' · ')}`;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState(0);
  const [res, setRes] = useState<WritingAnalysis | null>(null);
  const [err, setErr] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  const min = su.write.min;

  async function submit() {
    const s = loadSettings();
    if (!aiReady(s)) { setErr('설정에서 AI를 먼저 연결해 주세요.'); return; }
    if (text.trim().length < min) { setErr(`${min}자 이상 쓰게. (지금 ${text.trim().length}자)`); return; }
    setBusy(true); setErr(''); setStream(0);
    try {
      const a = await analyzeWriting(s, su.write.type, topic, text.trim(), c => setStream(n => n + c.length));
      const db = loadDB();
      const entry: WritingEntry = {
        id: Date.now(), date: todayKey(), type: su.write.type as WritingEntry['type'], topic: `[제${su.n}수 ${su.title}] ${topic}`,
        text: text.trim(), status: '분석완료', analysis: a, createdAt: new Date().toISOString(), su: su.n, imageUrl,
      };
      db.writings.push(entry);
      mergeExpressions(db, a.expressions || []);
      mergeWeaknesses(db, a.weaknesses || []);
      updateJourneyOnWrite(db);
      saveDB(db);
      setRes(a);
      onDone();
    } catch (e) { setErr('분석 오류: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {!res && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <button className={`g-btn sm ${mode === 'su' ? 'primary' : ''}`} onClick={() => setMode('su')}>오늘의 수 주제</button>
          <button className={`g-btn sm ${mode === 'q' ? 'primary' : ''}`} onClick={() => setMode('q')}>오늘의 질문</button>
          <button className={`g-btn sm ${mode === 'words' ? 'primary' : ''}`} onClick={() => setMode('words')}>글감 낱말 3개</button>
          {mode !== 'su' && <button className="g-btn sm" onClick={() => setRoll(r => r + 1)}>↻</button>}
        </div>
      )}
      <div className="g-panel" style={{ fontFamily: 'var(--font-read)', fontSize: 15 }}>
        {topic}
        <div className="g-dim" style={{ fontSize: 11, marginTop: 4 }}>오늘의 수 「{su.title}」를 적용하게 — {su.write.check}</div>
      </div>
      <textarea ref={ta} className="px-textarea" value={text} onChange={e => setText(e.target.value)} disabled={busy || !!res} style={{ minHeight: 200 }} placeholder="5~10분. 완벽하지 않아도 끝까지." />
      {!res && <PunctBar target={ta} value={text} onChange={setText} />}
      {!res && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="g-btn primary" disabled={busy || !text.trim()} onClick={submit}>{busy ? `스승이 읽는 중… ${stream ? `(${stream})` : ''}` : '다 썼네'}</button>
          <span style={{ fontSize: 12, color: text.trim().length >= min ? 'var(--good)' : 'var(--dim-star)' }}>{text.trim().length} / {min}자</span>
        </div>
      )}
      {err && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 6 }}>{err}</div>}
      {res && (
        <div className="anim-in" style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="g-chip" style={{ color: 'var(--accent)' }}>종합 {res.score}</span>
            {Object.entries(res.score_breakdown).map(([k, v]) => <span key={k} className="g-chip">{k} {v}</span>)}
          </div>
          {res.strengths?.[0] && <div style={{ fontSize: 13, color: 'var(--good)', marginBottom: 4 }}>잘된 점 · {res.strengths[0]}</div>}
          {res.weaknesses?.slice(0, 2).map((w, i) => <div key={i} style={{ fontSize: 13, color: 'var(--moon)', marginBottom: 4, fontFamily: 'var(--font-read)' }}>다듬을 점 · {w}</div>)}
          <Link href="/writing" className="g-btn sm">글방에서 전체 분석·첨삭 보기 →</Link>
        </div>
      )}
    </div>
  );
}

export default function PracticePage() {
  const [db, setDb] = useState<DB | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [open, setOpen] = useState<Step | 'teach' | null>(null);
  const [drillImg, setDrillImg] = useState<string | undefined>();
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
    : { warmup: false, drill: false, write: false };
  const nextStep: Step | 'teach' = !steps.warmup ? 'warmup' : !steps.drill ? 'drill' : !steps.write ? 'write' : 'write';
  const shown = open ?? (steps.warmup || steps.drill ? nextStep : 'teach');
  const allDone = steps.warmup && steps.drill && steps.write;

  async function startNextCycle() {
    if (!await confirmDialog(`${g.cycle + 1}회차를 시작할까? 같은 24수를 더 높은 기준으로 다시 도네. (지난 기록은 그대로 남네)`, { confirmLabel: '시작' })) return;
    const fresh = loadDB();
    const gg = getGame(fresh);
    fresh.game = { ...gg, cycle: gg.cycle + 1, cycleStart: new Date().toISOString() };
    saveDB(fresh);
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 24 }}>
      {/* 머리 */}
      <div className="g-panel hi" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Speaker id="muk" size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="g-dim" style={{ fontSize: 11 }}>{pv.cycle > 1 ? `${pv.cycle}회차 · ` : ''}백지첩 {pv.masteredCount} / 24</div>
          <div style={{ fontSize: 18 }}>{su ? `제${su.n}수 「${su.title}」` : pv.trialChapter ? `시련 · ${pv.trialChapter.ch.title}` : '백지첩을 모두 되살렸네'}</div>
          {ch && <div className="g-dim" style={{ fontSize: 11 }}>{ch.n}장 {ch.title} · 기르는 힘: {ch.dim}{selected && !isCurrent ? ' · 복습' : ''}</div>}
        </div>
        {tv.done && !selected && <span className="g-chip" style={{ color: 'var(--good)' }}>오늘 등불 ◆</span>}
      </div>

      {/* 시련 대기 */}
      {!su && pv.trialChapter && (
        <div className="g-panel boss" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <Monster id={pv.trialChapter.ch.boss.id} size={72} className="anim-bob" />
          <div style={{ flex: 1 }}>
            <div className="g-h" style={{ color: 'var(--bad)' }}>{pv.trialChapter.ch.n}장 시련</div>
            <div style={{ fontSize: 13, marginBottom: 6, fontFamily: 'var(--font-read)' }}>{pv.trialChapter.ch.title}의 네 수를 모두 익혔네. 이 장의 약점이 요괴가 되어 기다리고 있어.</div>
            <div className="g-dim" style={{ fontSize: 11, marginBottom: 6 }}>조건: {pv.trialChapter.rule.text}</div>
            <Link href={`/practice/trial?ch=${pv.trialChapter.ch.n}`} className="g-btn danger">⚔ 시련에 들기</Link>
          </div>
        </div>
      )}

      {/* 회차 끝 */}
      {!su && pv.cycleDone && (
        <div className="g-panel hi" style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>백지첩 스물네 장이 모두 돌아왔네.</div>
          <button className="g-btn" onClick={() => playScene({ id: `c${pv.cycle}:epilogue`, title: '백지첩 · 끝', lines: EPILOGUE, replay: true })}>에필로그</button>
          <button className="g-btn primary" onClick={startNextCycle}>{pv.cycle + 1}회차 시작 →</button>
        </div>
      )}

      {/* 오늘 마침 */}
      {su && tv.done && !selected && isCurrent && !steps.warmup && (
        <div className="g-panel" style={{ marginTop: 12, '--frame': 'var(--good)' } as React.CSSProperties}>
          <div className="g-dialog"><Speaker id="muk" emotion="happy" size={40} />
            <div className="txt" style={{ fontSize: 14 }}>오늘 등불은 켜졌네. 쉬어도 좋고, 기운이 남았으면 다음 수를 미리 봐도 좋아.</div></div>
        </div>
      )}

      {/* 수련 4단계 */}
      {su && (
        <div key={`${su.n}-${nonce}`}>
          <div style={{ display: 'flex', gap: 4, margin: '12px 0 4px', flexWrap: 'wrap' }}>
            {(['teach', 'warmup', 'drill', 'write'] as const).map((k, i) => {
              const done = k === 'teach' ? (steps.warmup || steps.drill || steps.write) : steps[k];
              return (
                <button key={k} className={`g-btn sm ${shown === k ? 'primary' : ''}`} onClick={() => setOpen(k)} style={{ flex: '1 1 120px' }}>
                  <span style={{ color: done && shown !== k ? 'var(--good)' : undefined }}>{done ? '■' : '□'}</span> {i + 1}. {STEP_LABEL[k]}
                </button>
              );
            })}
          </div>
          <div className="g-panel">
            {shown === 'teach' && <>
              <Teach su={su} />
              <button className="g-btn primary" style={{ marginTop: 10 }} onClick={() => setOpen('warmup')}>익혔네 → 워밍업</button>
            </>}
            {shown === 'warmup' && <>
              <div className="g-h">② 워밍업 · 2분</div>
              <Warmup su={su} db={db} onDone={() => {}} />
              {steps.warmup && <button className="g-btn primary" style={{ marginTop: 10 }} onClick={() => setOpen('drill')}>다음 → 사진 훈련</button>}
            </>}
            {shown === 'drill' && <>
              <div className="g-h">③ 사진 훈련 · 5분</div>
              <DrillBox su={su} onDone={(r, img) => {
                const v = [r.scores.관찰력, r.scores.구체성, r.scores.표현다양성, r.scores.감정전달력, r.scores.문장밀도, r.scores.독창성];
                logStep(su.n, 'drill', Math.round(v.reduce((a, b) => a + (b || 0), 0) / v.length * 10) / 10, su.drill.name);
                setDrillImg(img);
              }} />
              {steps.drill && <button className="g-btn primary" style={{ marginTop: 10 }} onClick={() => setOpen('write')}>다음 → 짧은 글</button>}
            </>}
            {shown === 'write' && <>
              <div className="g-h">④ 짧은 글 · 5~10분</div>
              <ShortWrite su={su} imageUrl={drillImg} onDone={() => setSelected(su.n) /* 마친 수를 그대로 보여 준다 — '한 장 복원'은 GameLayer가 알린다 */} />
            </>}
          </div>
          {allDone && (
            <div className="g-panel" style={{ marginTop: 8, '--frame': 'var(--good)' } as React.CSSProperties}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>제{su.n}수를 마쳤네.</div>
              {pv.current && pv.current.su.n !== su.n && <button className="g-btn primary" onClick={() => { setSelected(pv.current!.su.n); setOpen('teach'); setNonce(n => n + 1); }}>다음 수 「{pv.current.su.title}」 보기</button>}
              <button className="g-btn" onClick={() => { setOpen('warmup'); setNonce(n => n + 1); }}>같은 수 한 번 더</button>
              <Link href="/" className="g-btn">서재로</Link>
            </div>
          )}
        </div>
      )}

      {/* 백지첩 목차 */}
      <div className="g-panel" style={{ marginTop: 16 }}>
        <div className="g-h">백지첩 목차 <span className="g-dim" style={{ marginLeft: 'auto', fontSize: 10 }}>익힌 수는 언제든 복습</span></div>
        {pv.chapters.map(cv => (
          <div key={cv.ch.n} style={{ padding: '8px 0', borderTop: '2px dashed var(--line-soft)', opacity: cv.status === 'locked' ? 0.45 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: cv.status === 'done' ? 'var(--good)' : cv.status === 'locked' ? 'var(--text-disabled)' : 'var(--accent)' }}>{cv.ch.n}장 {cv.ch.title}</span>
              <span className="g-dim" style={{ fontSize: 10 }}>{cv.ch.dim}</span>
              <Monster id={cv.ch.boss.id} size={22} style={{ marginLeft: 'auto', opacity: cv.trialPassed ? 0.3 : 1, filter: cv.status === 'locked' ? 'brightness(0)' : undefined }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 4 }}>
              {cv.sus.map(sp => {
                const unlocked = sp.mastered || pv.current?.su.n === sp.su.n;
                const active = su?.n === sp.su.n;
                return (
                  <button key={sp.su.n} className={`g-btn sm ${active ? 'primary' : ''}`} disabled={!unlocked} style={{ justifyContent: 'flex-start', margin: 2 }}
                    onClick={() => { setSelected(pv.current?.su.n === sp.su.n ? null : sp.su.n); setOpen('teach'); setNonce(n => n + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <span style={{ color: sp.mastered && !active ? 'var(--good)' : undefined }}>{sp.mastered ? '■' : '□'}</span>
                    {sp.su.n}. {unlocked ? sp.su.title : '???'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 보충 과제 */}
      <div className="g-panel" style={{ marginTop: 12 }}>
        <div className="g-h">보충 과제 <span className="g-dim" style={{ marginLeft: 'auto', fontSize: 10 }}>내 글의 약점으로 AI가 내는 과제</span></div>
        <Missions />
      </div>
    </div>
  );
}
