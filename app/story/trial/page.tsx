'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadDB, saveDB, loadSettings, aiReady, mergeExpressions, mergeWeaknesses, type DB, type WritingEntry } from '@/lib/db';
import { analyzeWriting } from '@/lib/openai';
import { storyView, getGame, judgeTrial, todayKey, computeInk, levelInfo, type TrialRecord } from '@/lib/game';
import { updateJourneyOnWrite } from '@/lib/journey';
import { SPEAKERS } from '@/lib/story';
import { Monster, Speaker } from '@/components/pixel/Pixel';
import { playScene } from '@/components/game/ScenePlayer';

const TYPES = ['묘사문', '설명문', '감상문', '의견문', '기사 리드', '카피라이팅', '에세이', '스토리텔링'];

type Phase = 'write' | 'judging' | 'hit' | 'won' | 'lost';

export default function TrialPage() {
  const [db, setDb] = useState<DB | null>(null);
  const [chId, setChId] = useState('');
  const [text, setText] = useState('');
  const [type, setType] = useState('');
  const [phase, setPhase] = useState<Phase>('write');
  const [err, setErr] = useState('');
  const [stream, setStream] = useState(0);
  const [result, setResult] = useState<{ value: number; need: number; why: string; entry: WritingEntry } | null>(null);
  const [tauntIdx, setTauntIdx] = useState(0);

  useEffect(() => {
    setChId(new URLSearchParams(window.location.search).get('ch') ?? '');
    setDb(loadDB());
    const t = setInterval(() => setTauntIdx(i => i + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const view = useMemo(() => db ? storyView(db).chapters.find(c => c.chapter.id === chId) : undefined, [db, chId]);
  useEffect(() => { if (view?.trial && !type) setType(view.trial.type); }, [view, type]);
  // 시련 장의 도입 장면을 아직 안 봤다면 먼저 보여 준다
  useEffect(() => {
    if (!db || !view) return;
    playScene({ id: `${getGame(db).year}:${view.chapter.id}`, title: view.chapter.title, lines: view.chapter.scene });
  }, [db, view]);

  if (!db) return null;
  if (!view || !view.trial) {
    return <div style={{ maxWidth: 640, margin: '0 auto' }}><Link href="/story" className="g-btn sm">← 이야기</Link><div className="g-panel">시련을 찾을 수 없어요.</div></div>;
  }
  const trial = view.trial;
  const g = getGame(db);
  const boss = SPEAKERS[trial.boss];
  const rank = levelInfo(computeInk(db).total).rank;
  const locked = view.status === 'locked' || !view.reqsDone;
  const hp = phase === 'won' || view.trialPassed ? 0 : Math.max(0, 1 - (result ? Math.min(1, result.value / result.need) : view.bestHit));
  const len = text.length;
  const lenOk = len >= trial.minChars && (!trial.maxChars || len <= trial.maxChars);

  async function submit() {
    if (!trial) return;
    const s = loadSettings();
    if (!aiReady(s)) { setErr('설정에서 AI를 먼저 연결해 주세요.'); return; }
    if (!lenOk) { setErr(trial.maxChars ? `${trial.minChars}~${trial.maxChars}자로 써 주세요.` : `${trial.minChars}자 이상 써 주세요.`); return; }
    setErr(''); setPhase('judging'); setStream(0);
    try {
      const analysis = await analyzeWriting(s, type, trial.prompt, text, c => setStream(n => n + c.length));
      const fresh = loadDB();
      const id = Date.now();
      const entry: WritingEntry = {
        id, date: todayKey(), type: type as WritingEntry['type'], topic: `[시련] ${trial.prompt}`, text,
        status: '분석완료', analysis, createdAt: new Date().toISOString(), trial: view!.chapter.id,
      };
      fresh.writings.push(entry);
      mergeExpressions(fresh, analysis.expressions || []);
      mergeWeaknesses(fresh, analysis.weaknesses || []);
      updateJourneyOnWrite(fresh);
      const j = judgeTrial(trial, entry);
      const gg = getGame(fresh);
      const rec: TrialRecord = { id: id + 1, year: gg.year, chapterId: view!.chapter.id, boss: trial.boss, writingId: id, passed: j.passed, value: j.value, createdAt: new Date().toISOString() };
      fresh.game = { ...gg, trials: [...gg.trials, rec] };
      saveDB(fresh);
      setResult({ ...j, entry });
      setPhase('hit');
      setTimeout(() => {
        setPhase(j.passed ? 'won' : 'lost');
        if (j.passed) playScene({ id: `${gg.year}:${view!.chapter.id}:win`, title: '격파!', lines: trial.win });
        setDb(loadDB());
      }, 900);
    } catch (e) {
      setErr('채점 오류: ' + (e instanceof Error ? e.message : String(e)));
      setPhase('write');
    }
  }

  const a = result?.entry.analysis;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 24 }}>
      <Link href="/story" className="g-btn sm">← 이야기</Link>

      {/* 전투 무대 */}
      <div className="g-stage" style={{ height: 230, margin: 4, marginTop: 8, background: 'linear-gradient(#141428 0 60%, #2a2238 60%)', boxShadow: '0 0 0 4px var(--bad)' }}>
        {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ position: 'absolute', left: `${(i * 37) % 100}%`, top: `${(i * 13) % 50}%`, width: 3, height: 3, background: '#f7e26b', opacity: 0.6 }} />)}
        <div style={{ position: 'absolute', left: 16, right: 16, top: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ef3e4a', marginBottom: 4 }}>
            <span>{boss.name}</span><span>HP {Math.round(hp * 100)}%</span>
          </div>
          <div className="g-meter" style={{ background: '#101018' }}>{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.ceil(hp * 20) ? 'on' : ''} style={{ '--c': '#ef3e4a' } as React.CSSProperties} />)}</div>
        </div>
        <div style={{ position: 'absolute', right: '12%', bottom: 30 }} className={phase === 'hit' ? 'anim-hit' : phase === 'won' ? 'anim-poof' : 'anim-bob'}>
          <Monster id={trial.boss} size={120} />
          {phase === 'hit' && result && <div className="anim-float" style={{ position: 'absolute', top: -10, left: '40%', color: '#f7e26b', fontSize: 18 }}>-{result.value}</div>}
        </div>
        {phase === 'write' && (
          <div className="g-panel" style={{ position: 'absolute', right: '30%', top: 54, padding: '6px 10px', fontSize: 12, maxWidth: 200, '--frame': '#ef3e4a' } as React.CSSProperties}>
            {trial.taunt[tauntIdx % trial.taunt.length]}
          </div>
        )}
        {phase === 'lost' && <div className="g-panel" style={{ position: 'absolute', right: '30%', top: 54, padding: '6px 10px', fontSize: 12, maxWidth: 220 }}>{trial.lose}</div>}
        <div style={{ position: 'absolute', left: '10%', bottom: 30 }} className={phase === 'judging' ? 'anim-bob' : ''}>
          <Speaker id="me" size={84} robe={{ robe: rank.robe, color: rank.color }} emotion={phase === 'won' ? 'happy' : phase === 'lost' ? 'sad' : 'default'} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, background: '#1a1426' }} />
      </div>

      {/* 시련 안내 */}
      <div className="g-panel boss" style={{ marginTop: 10 }}>
        <div className="g-h" style={{ color: 'var(--bad)' }}>시련 · {trial.title}</div>
        <div style={{ fontSize: 15, fontFamily: 'var(--font-read)', marginBottom: 6 }}>주제: {trial.prompt}</div>
        <div className="g-dim" style={{ fontSize: 12 }}>격파 조건: {trial.rule} · 권장 유형 {trial.type}{g.year > 2 ? ' · 심화' : ''}</div>
        {view.trialPassed && phase !== 'won' && <div style={{ color: 'var(--good)', fontSize: 12, marginTop: 6 }}>이미 격파한 시련입니다. 다시 써서 기록을 남길 수 있어요.</div>}
        {locked && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 6 }}>아직 이 장의 조건을 채우지 못했어요. 이야기 화면에서 조건을 확인하세요.</div>}
      </div>

      {/* 쓰기 */}
      {(phase === 'write' || phase === 'judging') && !locked && (
        <div className="g-panel" style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {TYPES.map(t => <button key={t} className={`g-btn sm ${type === t ? 'primary' : ''}`} onClick={() => setType(t)}>{t}</button>)}
          </div>
          <textarea className="px-textarea" value={text} onChange={e => setText(e.target.value)} placeholder="여기에 시련의 글을 쓰게. 완벽하지 않아도 끝까지." disabled={phase === 'judging'} style={{ minHeight: 260 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: lenOk ? 'var(--good)' : 'var(--dim-star)' }}>{len}자 / {trial.minChars}{trial.maxChars ? `~${trial.maxChars}` : '+'}자</span>
            <button className="g-btn danger" onClick={submit} disabled={phase === 'judging' || !text.trim()}>
              {phase === 'judging' ? `먹을 가는 중… ${stream ? `(${stream})` : ''}` : '⚔ 글로 베기'}
            </button>
          </div>
          {err && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 8 }}>{err}</div>}
        </div>
      )}

      {/* 결과 */}
      {(phase === 'won' || phase === 'lost') && result && a && (
        <div className={`g-panel ${phase === 'won' ? 'hi' : 'boss'}`} style={{ marginTop: 10 }}>
          <div className="g-h" style={{ color: phase === 'won' ? 'var(--good)' : 'var(--bad)' }}>{phase === 'won' ? '격파!' : '아직 버티고 있다'}</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{result.why}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6, marginBottom: 10 }}>
            <span className="g-chip">종합 {a.score}</span>
            {Object.entries(a.score_breakdown).map(([k, v]) => (
              <span key={k} className="g-chip" style={{ color: trial.dim === k ? 'var(--accent)' : undefined }}>{k} {v}</span>
            ))}
          </div>
          {a.weaknesses?.slice(0, 3).map((w, i) => <div key={i} style={{ fontSize: 12, fontFamily: 'var(--font-read)', marginBottom: 4 }}>· {w}</div>)}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10 }}>
            <Speaker id={view.chapter.mentor === 'muk' ? 'muk' : view.chapter.mentor} size={44} />
            <div style={{ fontSize: 13, fontFamily: 'var(--font-read)' }}>
              {phase === 'won' ? '잘했네. 이 글은 「글방」 기록에도 남았네. 첨삭도 받아 보게.' : '분석에서 짚은 약점을 고쳐서 다시 써 보게. 한 번 쓴 글은 먹이 되어 쌓였네.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
            {phase === 'lost' && <button className="g-btn danger" onClick={() => { setPhase('write'); setResult(null); }}>다시 도전</button>}
            <Link href="/writing" className="g-btn">글방에서 자세히 보기</Link>
            <Link href="/" className="g-btn primary">서재로</Link>
          </div>
        </div>
      )}
    </div>
  );
}
