'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadDB, saveDB, loadSettings, aiReady, mergeExpressions, mergeWeaknesses, type DB, type WritingEntry } from '@/lib/db';
import { analyzeWriting } from '@/lib/openai';
import { pathView, getGame, judgeTrial, todayKey, type TrialRecord } from '@/lib/game';
import { CHAPTERS, SPEAKER_NAME } from '@/lib/curriculum';
import { updateJourneyOnWrite } from '@/lib/journey';
import { Monster, Speaker } from '@/components/art/Art';
import { playScene } from '@/components/game/ScenePlayer';
import PunctBar from '@/components/practice/PunctBar';

type Phase = 'write' | 'judging' | 'hit' | 'won' | 'lost';

/* 요괴의 의도 — 쓰기 전에 무엇을 노리는지 알려 준다(채점 기준을 미리 공개) */
const INTENT: Record<string, string> = {
  durumung: '"좋았다·아름다웠다" 같은 뭉뚱그린 말이 나오면 그 안개 속에 숨는다. 본 것을 셀 수 있게 쓰면 숨을 데가 없다.',
  ppeonhan: '누구나 쓰는 상투어와 감정 이름("행복했다")을 먹고 자란다. 내 생활에서 나온 장면으로 보여 주면 흉내 내지 못한다.',
  heurisi: '"되었다·있었다·하게 되었다" 같은 힘 빠진 동사를 좋아한다. 주어가 직접 움직이는 동사로 쓰면 눈이 부셔 물러난다.',
  neureoji: '군더더기 말과 긴 문장에 몸을 감는다. 한 문장에 한 생각, 덜어낸 글이면 꼬리를 잡을 수 없다.',
  eotbagi: '문단과 문단이 엇갈리고 이유가 빠진 자리에 실을 엮는다. 첫 문장에 할 말을 세우고 차례대로 이으면 실이 풀린다.',
  baekjigwi: '"완벽하지 않으면 쓰지 마라"고 속삭인다. 이놈은 끝까지 쓴 글, 나만 쓸 수 있는 글에만 베어진다.',
};
const DIMS = ['구체성', '표현력', '전달력', '가독성', '논리성'] as const;
interface Hit { dim: string; score: number; dmg: number; crit: boolean }
function planHits(target: string, breakdown: Record<string, number>, dealt: number): Hit[] {
  const dims = DIMS.filter(d => breakdown[d] != null);
  if (!dims.length) return [{ dim: target, score: 0, dmg: dealt, crit: true }];
  if (target === '종합') {
    const sum = dims.reduce((s, d) => s + Math.max(1, breakdown[d]), 0);
    return dims.map(d => ({ dim: d, score: breakdown[d], dmg: dealt * Math.max(1, breakdown[d]) / sum, crit: breakdown[d] >= 7 }));
  }
  const others = dims.filter(d => d !== target);
  const sum = others.reduce((s, d) => s + Math.max(1, breakdown[d]), 0) || 1;
  return [
    ...others.map(d => ({ dim: d, score: breakdown[d], dmg: dealt * 0.35 * Math.max(1, breakdown[d]) / sum, crit: false })),
    { dim: target, score: breakdown[target] ?? 0, dmg: dealt * 0.65, crit: true },
  ];
}
function grade(ratio: number) { return ratio >= 1.2 ? '妙' : ratio >= 1 ? '好' : ratio >= 0.8 ? '可' : '霧'; }
const GRADE_NAME: Record<string, string> = { '妙': '묘(妙) — 빼어나다', '好': '호(好) — 좋다', '可': '가(可) — 한 걸음 남았다', '霧': '무(霧) — 아직 안개 속' };

export default function TrialPage() {
  const [db, setDb] = useState<DB | null>(null);
  const [chN, setChN] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('write');
  const [err, setErr] = useState('');
  const [stream, setStream] = useState(0);
  const [result, setResult] = useState<{ value: number; need: number; why: string; entry: WritingEntry } | null>(null);
  const [tick, setTick] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [hitIdx, setHitIdx] = useState(-1);
  const [hp, setHp] = useState(1);
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
    playScene({ id: `c${g.cycle}:boss${ch.n}`, title: `${ch.n}장 시련`, bg: `cg_ch${ch.n}`, lines: [
      { who: 'narr', text: `백지첩 ${ch.n}장 「${ch.title}」의 마지막 장 위로, 하얀 기척이 일어난다.` },
      ...(g.cycle > 1 ? [{ who: 'narr' as const, text: `${g.cycle}회차. 한 번 놓아 보냈던 ${SPEAKER_NAME[ch.boss.id]}이(가) 더 짙은 모습으로 돌아왔다. 기준도 한 칸 높아졌다.` }] : []),
      { who: ch.boss.id, text: ch.boss.taunt[0] },
      { who: 'muk', text: `${ch.dim === '종합' ? '배운 걸 전부' : `이번 장에서 기른 ${ch.dim}`}으로 베게. 주제는 정해져 있네.` },
    ] });
  }, [db, ch]);

  if (!db) return null;
  if (!ch) return <div style={{ maxWidth: 640, margin: '0 auto' }}><Link href="/practice" className="g-btn sm">← 수련</Link><div className="g-panel">시련을 찾을 수 없네.</div></div>;

  const g = getGame(db);
  const cv = pathView(db).chapters.find(c => c.ch.n === ch.n)!;
  const rule = cv.rule;
  const locked = cv.status === 'locked' || cv.status === 'current';
  const shownHp = phase === 'won' ? 0 : phase === 'write' ? (cv.trialPassed ? 0 : 1) : hp;
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
      // 타격 연출: 항목마다 한 번씩. 통과하면 HP 0, 아니면 기준 대비 모자란 만큼 남는다.
      const end = j.passed ? 0 : Math.max(0.05, 1 - (j.need ? j.value / j.need : 0));
      const plan = planHits(ch.dim, (analysis.score_breakdown ?? {}) as unknown as Record<string, number>, 1 - end);
      setHits(plan); setHp(1); setHitIdx(-1); setPhase('hit');
      let left = 1;
      plan.forEach((h, i) => setTimeout(() => { left -= h.dmg; setHitIdx(i); setHp(Math.max(0, left)); }, 500 + i * 720));
      setTimeout(() => {
        setHp(end);
        setPhase(j.passed ? 'won' : 'lost');
        if (j.passed) setTimeout(() => playScene({ id: `c${gg.cycle}:boss${ch.n}:win`, title: `${SPEAKER_NAME[ch.boss.id]}을(를) 놓아 보냈다`, lines: [...ch.boss.win, { who: 'narr', text: '요괴는 흩어지며 하얀 종이가 되었다. 종이마다 잃어버렸던 낱말들이 번져 올라왔다.' }], bg: 'cg_win' }), 1600);
        setDb(loadDB());
      }, 500 + plan.length * 720 + 500);
    } catch (e) {
      setErr('채점 오류: ' + (e instanceof Error ? e.message : String(e)));
      setPhase('write');
    }
  }
  const a = result?.entry.analysis;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 24 }}>
      <Link href="/practice" className="g-btn sm">← 수련</Link>
      <div className={`g-stage arena ${phase === 'hit' && hitIdx >= 0 && hits[hitIdx]?.crit ? 'anim-shake' : ''}`} key={`arena-${hitIdx}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/art/cg_ch${ch.n}.webp`} alt="" className="stage-img" style={{ filter: 'brightness(0.62) saturate(0.8)' }} />
        <div className="arena-hud">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span className="t-title" style={{ fontSize: 16 }}>{SPEAKER_NAME[ch.boss.id]}</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>{shownHp === 0 ? '놓아 보냄' : `기운 ${Math.round(shownHp * 100)}%`}</span>
          </div>
          <div className="arena-hp"><i style={{ width: `${shownHp * 100}%` }} /></div>
        </div>
        <div className={`arena-boss ${phase === 'won' ? 'anim-release' : cv.trialPassed && phase === 'write' ? '' : 'anim-float'}`} style={cv.trialPassed && phase === 'write' ? { opacity: 0.35, filter: 'grayscale(0.6)' } : undefined}>
          <div key={hitIdx} className={phase === 'hit' && hitIdx >= 0 ? 'anim-hit' : ''}>
            <Monster id={ch.boss.id} size={240} style={{ width: '100%', height: 'auto' }} />
          </div>
          {phase === 'hit' && hitIdx >= 0 && hits[hitIdx] && (
            <>
              <div key={`d${hitIdx}`} className={`arena-dmg ${hits[hitIdx].crit ? 'crit' : ''}`}>
                <small>{hits[hitIdx].dim} {hits[hitIdx].score}</small>
                {hits[hitIdx].crit ? '급소! ' : ''}−{Math.max(1, Math.round(hits[hitIdx].dmg * 100))}
              </div>
              {Array.from({ length: hits[hitIdx].crit ? 7 : 4 }, (_, i) => (
                <i key={`s${hitIdx}-${i}`} className="arena-splat" style={{ left: `${30 + ((i * 37) % 45)}%`, top: `${25 + ((i * 53) % 50)}%`, width: 14 + (i % 3) * 10, ['--r' as string]: `${i * 51}deg` }} />
              ))}
            </>
          )}
        </div>
        {phase === 'won' && Array.from({ length: 16 }, (_, i) => (
          <i key={`p${i}`} className="arena-page" style={{ ['--dx' as string]: `${(i % 2 ? 1 : -1) * (60 + i * 17)}px`, ['--dy' as string]: `${-140 - (i * 23) % 160}px`, ['--rot' as string]: `${(i * 67) % 360}deg`, animationDelay: `${i * 40}ms` }} />
        ))}
        {(phase === 'write' || phase === 'lost') && !(cv.trialPassed && phase === 'write') && (
          <div className="arena-taunt anim-in" key={`${phase}-${tick}`}>{phase === 'lost' ? ch.boss.lose : ch.boss.taunt[tick % ch.boss.taunt.length]}</div>
        )}
        <div className="arena-me"><Speaker id="me" full size={300} style={{ height: '100%' }} emotion={phase === 'won' ? 'happy' : phase === 'lost' ? 'sad' : phase === 'hit' ? 'angry' : 'default'} /></div>
        {result && (phase === 'won' || phase === 'lost') && (
          <div className="arena-grade anim-stamp"><span>{grade(result.need ? result.value / result.need : 0)}</span></div>
        )}
      </div>
      {phase === 'write' && !locked && (
        <div className="g-panel" style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span className="seal" style={{ fontSize: 13, padding: '4px 6px', flexShrink: 0 }}>意</span>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--seal)', marginBottom: 2 }}>요괴의 의도</div><div className="t-read" style={{ fontSize: 14, lineHeight: 1.75 }}>{INTENT[ch.boss.id]}</div></div>
        </div>
      )}

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
            <button className="g-btn danger" onClick={submit} disabled={phase === 'judging' || !text.trim()}>{phase === 'judging' ? `묵당이 읽는 중… ${stream ? `(${stream})` : ''}` : '이 글로 겨루기'}</button>
          </div>
          {err && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 8 }}>{err}</div>}
        </div>
      )}

      {(phase === 'won' || phase === 'lost') && result && a && (
        <div className={`g-panel ${phase === 'won' ? 'hi' : 'boss'}`} style={{ marginTop: 10 }}>
          <div className="g-h" style={{ color: phase === 'won' ? 'var(--good)' : 'var(--bad)' }}>{phase === 'won' ? '놓아 보냈다' : '아직 버티고 있다'} · 판정 {GRADE_NAME[grade(result.need ? result.value / result.need : 0)]}</div>
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
