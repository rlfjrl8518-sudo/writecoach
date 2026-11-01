'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadDB, saveDB, loadSettings, aiReady, mergeExpressions, mergeWeaknesses, type DB, type WritingEntry } from '@/lib/db';
import { analyzeWriting } from '@/lib/openai';
import { pathView, getGame, judgeTrial, todayKey, rankOf, type TrialRecord } from '@/lib/game';
import { CHAPTERS, SPEAKER_NAME } from '@/lib/curriculum';
import { updateJourneyOnWrite } from '@/lib/journey';
import { Monster, Speaker } from '@/components/pixel/Pixel';
import { playScene } from '@/components/game/ScenePlayer';
import PunctBar from '@/components/practice/PunctBar';

type Phase = 'write' | 'judging' | 'hit' | 'won' | 'lost';

export default function TrialPage() {
  const [db, setDb] = useState<DB | null>(null);
  const [chN, setChN] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('write');
  const [err, setErr] = useState('');
  const [stream, setStream] = useState(0);
  const [result, setResult] = useState<{ value: number; need: number; why: string; entry: WritingEntry } | null>(null);
  const [tick, setTick] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setChN(Number(new URLSearchParams(window.location.search).get('ch')) || 0);
    setDb(loadDB());
    const t = setInterval(() => setTick(i => i + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const ch = CHAPTERS.find(c => c.n === chN);
  useEffect(() => {
    if (!db || !ch) return;
    const g = getGame(db);
    playScene({ id: `c${g.cycle}:boss${ch.n}`, title: `${ch.n}장 시련`, lines: [
      { who: 'narr', text: `백지첩 ${ch.n}장 「${ch.title}」의 마지막 장 위로, 하얀 기척이 일어난다.` },
      { who: ch.boss.id, text: ch.boss.taunt[0] },
      { who: 'muk', text: `${ch.dim === '종합' ? '배운 걸 전부' : `이번 장에서 기른 ${ch.dim}`}으로 베게. 주제는 정해져 있네.` },
    ] });
  }, [db, ch]);

  if (!db) return null;
  if (!ch) return <div style={{ maxWidth: 640, margin: '0 auto' }}><Link href="/practice" className="g-btn sm">← 수련</Link><div className="g-panel">시련을 찾을 수 없네.</div></div>;

  const g = getGame(db);
  const cv = pathView(db).chapters.find(c => c.ch.n === ch.n)!;
  const rule = cv.rule;
  const rank = rankOf(db);
  const locked = cv.status === 'locked' || cv.status === 'current';
  const hp = phase === 'won' || cv.trialPassed ? 0 : Math.max(0, 1 - (result ? Math.min(1, result.value / result.need) : cv.bestHit));
  const len = text.trim().length;
  const lenOk = len >= rule.minChars && (!rule.maxChars || len <= rule.maxChars);

  async function submit() {
    if (!ch) return;
    const s = loadSettings();
    if (!aiReady(s)) { setErr('설정에서 AI를 먼저 연결해 주세요.'); return; }
    if (!lenOk) { setErr(rule.maxChars ? `${rule.minChars}~${rule.maxChars}자로 쓰게.` : `${rule.minChars}자 이상 쓰게.`); return; }
    setErr(''); setPhase('judging'); setStream(0);
    try {
      const analysis = await analyzeWriting(s, ch.boss.type, ch.boss.prompt, text.trim(), c => setStream(n => n + c.length));
      const fresh = loadDB();
      const id = Date.now();
      const entry: WritingEntry = { id, date: todayKey(), type: ch.boss.type as WritingEntry['type'], topic: `[${ch.n}장 시련] ${ch.boss.prompt}`, text: text.trim(), status: '분석완료', analysis, createdAt: new Date().toISOString(), trial: `ch-${ch.n}` };
      fresh.writings.push(entry);
      mergeExpressions(fresh, analysis.expressions || []);
      mergeWeaknesses(fresh, analysis.weaknesses || []);
      updateJourneyOnWrite(fresh);
      const gg = getGame(fresh);
      const j = judgeTrial(ch, gg.cycle, entry);
      const rec: TrialRecord = { id: id + 1, cycle: gg.cycle, chapter: ch.n, boss: ch.boss.id, writingId: id, passed: j.passed, value: j.value, createdAt: new Date().toISOString() };
      fresh.game = { ...gg, trials: [...gg.trials, rec] };
      saveDB(fresh);
      setResult({ ...j, entry });
      setPhase('hit');
      setTimeout(() => {
        setPhase(j.passed ? 'won' : 'lost');
        if (j.passed) playScene({ id: `c${gg.cycle}:boss${ch.n}:win`, title: '격파!', lines: ch.boss.win });
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
      <Link href="/practice" className="g-btn sm">← 수련</Link>
      <div className="g-stage" style={{ height: 230, margin: 4, marginTop: 8, background: 'linear-gradient(#141428 0 60%, #2a2238 60%)', boxShadow: '0 0 0 4px var(--bad)' }}>
        <div style={{ position: 'absolute', left: 16, right: 16, top: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ef3e4a', marginBottom: 4 }}><span>{SPEAKER_NAME[ch.boss.id]}</span><span>HP {Math.round(hp * 100)}%</span></div>
          <div className="g-meter" style={{ background: '#101018' }}>{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.ceil(hp * 20) ? 'on' : ''} style={{ '--c': '#ef3e4a' } as React.CSSProperties} />)}</div>
        </div>
        <div style={{ position: 'absolute', right: '12%', bottom: 30 }} className={phase === 'hit' ? 'anim-hit' : phase === 'won' ? 'anim-poof' : 'anim-bob'}>
          <Monster id={ch.boss.id} size={120} />
          {phase === 'hit' && result && <div className="anim-float" style={{ position: 'absolute', top: -10, left: '40%', color: '#f7e26b', fontSize: 18 }}>-{result.value}</div>}
        </div>
        {(phase === 'write' || phase === 'lost') && (
          <div className="g-panel" style={{ position: 'absolute', right: '30%', top: 54, padding: '6px 10px', fontSize: 12, maxWidth: 220, '--frame': '#ef3e4a' } as React.CSSProperties}>
            {phase === 'lost' ? ch.boss.lose : ch.boss.taunt[tick % ch.boss.taunt.length]}
          </div>
        )}
        <div style={{ position: 'absolute', left: '10%', bottom: 30 }}><Speaker id="me" size={84} robe={{ robe: rank.robe, color: rank.color }} emotion={phase === 'won' ? 'happy' : phase === 'lost' ? 'sad' : 'default'} /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, background: '#1a1426' }} />
      </div>

      <div className="g-panel boss" style={{ marginTop: 10 }}>
        <div className="g-h" style={{ color: 'var(--bad)' }}>{ch.n}장 「{ch.title}」 시련</div>
        <div style={{ fontSize: 15, fontFamily: 'var(--font-read)', marginBottom: 6 }}>주제: {ch.boss.prompt}</div>
        <div className="g-dim" style={{ fontSize: 12 }}>격파 조건: {rule.text} · 권장 유형 {ch.boss.type}{g.cycle > 1 ? ` · ${g.cycle}회차` : ''}</div>
        {cv.trialPassed && phase !== 'won' && <div style={{ color: 'var(--good)', fontSize: 12, marginTop: 6 }}>이미 격파한 시련이네. 다시 써서 기록을 남길 수는 있어.</div>}
        {locked && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 6 }}>이 장의 네 수를 먼저 익히게.</div>}
      </div>

      {(phase === 'write' || phase === 'judging') && !locked && (
        <div className="g-panel" style={{ marginTop: 10 }}>
          <textarea ref={ta} className="px-textarea" value={text} onChange={e => setText(e.target.value)} placeholder="완벽하지 않아도 끝까지." disabled={phase === 'judging'} style={{ minHeight: 260 }} />
          {phase === 'write' && <PunctBar target={ta} value={text} onChange={setText} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: lenOk ? 'var(--good)' : 'var(--dim-star)' }}>{len}자 / {rule.maxChars ? `${rule.minChars}~${rule.maxChars}` : `${rule.minChars}+`}자</span>
            <button className="g-btn danger" onClick={submit} disabled={phase === 'judging' || !text.trim()}>{phase === 'judging' ? `먹을 가는 중… ${stream ? `(${stream})` : ''}` : '⚔ 글로 베기'}</button>
          </div>
          {err && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 8 }}>{err}</div>}
        </div>
      )}

      {(phase === 'won' || phase === 'lost') && result && a && (
        <div className={`g-panel ${phase === 'won' ? 'hi' : 'boss'}`} style={{ marginTop: 10 }}>
          <div className="g-h" style={{ color: phase === 'won' ? 'var(--good)' : 'var(--bad)' }}>{phase === 'won' ? '격파!' : '아직 버티고 있다'}</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{result.why}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="g-chip">종합 {a.score}</span>
            {Object.entries(a.score_breakdown).map(([k, v]) => <span key={k} className="g-chip" style={{ color: ch.dim === k ? 'var(--accent)' : undefined }}>{k} {v}</span>)}
          </div>
          {a.weaknesses?.slice(0, 3).map((w, i) => <div key={i} style={{ fontSize: 12, fontFamily: 'var(--font-read)', marginBottom: 4 }}>· {w}</div>)}
          <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
            {phase === 'lost' && <button className="g-btn danger" onClick={() => { setPhase('write'); setResult(null); }}>다시 도전</button>}
            <Link href="/writing" className="g-btn">글방에서 자세히 보기</Link>
            <Link href="/practice" className="g-btn primary">수련으로</Link>
          </div>
        </div>
      )}
    </div>
  );
}
