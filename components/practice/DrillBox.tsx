'use client';
import { useEffect, useRef, useState } from 'react';
import { loadSettings, aiReady } from '@/lib/db';
import { evaluateDrill, type DrillEvaluation } from '@/lib/openai';
import type { Su } from '@/lib/curriculum';
import { Speaker } from '@/components/art/Art';
import PunctBar from './PunctBar';

/* ═══════════════════════════════════════════════════════════════
   ③ 사진 훈련 — 그 수 전용으로 생성한 이미지(Vertex) 또는 고쳐 쓸 원문을 두고 쓴다.
   이미지는 서버가 커리큘럼에서 프롬프트를 만들어 생성·캐시한다(/api/image).
═══════════════════════════════════════════════════════════════ */

function Bar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const col = pct >= 70 ? 'var(--good)' : pct >= 45 ? 'var(--moon)' : 'var(--bad)';
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span className="g-dim">{label}</span><span style={{ color: col }}>{value}{max === 100 ? '%' : '/10'}</span>
      </div>
      <div className="g-meter" style={{ marginTop: 2 }}>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.round(pct / 10) ? 'on' : ''} style={{ '--c': col } as React.CSSProperties} />)}</div>
    </div>
  );
}

export function DrillResultView({ r }: { r: DrillEvaluation }) {
  const s = r.scores;
  return (
    <div className="anim-in" style={{ marginTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '2px 16px' }}>
        <Bar label="관찰력" value={s.관찰력} /><Bar label="구체성" value={s.구체성} /><Bar label="표현 다양성" value={s.표현다양성} />
        <Bar label="감정 전달력" value={s.감정전달력} /><Bar label="문장 밀도" value={s.문장밀도} /><Bar label="독창성" value={s.독창성} />
      </div>
      {r.feedback && (
        <div className="g-dialog" style={{ marginTop: 10 }}>
          <Speaker id="muk" size={36} />
          <div className="txt" style={{ fontSize: 14 }}>{r.feedback}</div>
        </div>
      )}
      {(r.strengths.length > 0 || r.improvements.length > 0) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
          {r.strengths.map((x, i) => <span key={`s${i}`} className="g-chip" style={{ color: 'var(--good)' }}>{x}</span>)}
          {r.improvements.map((x, i) => <span key={`i${i}`} className="g-chip" style={{ color: 'var(--moon)' }}>{x}</span>)}
        </div>
      )}
      {r.modelAnswer && (
        <div style={{ marginTop: 8 }}>
          <div className="g-h" style={{ color: 'var(--moon)' }}>스승의 본보기</div>
          <div className="t-read" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-read)', fontSize: 14, lineHeight: 1.8 }}>{r.modelAnswer}</div>
          {r.explanation && <div className="g-dim" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>{r.explanation}</div>}
        </div>
      )}
    </div>
  );
}

export default function DrillBox({ su, onDone }: { su: Su; onDone: (r: DrillEvaluation, imageUrl?: string) => void }) {
  const d = su.drill;
  const [variant, setVariant] = useState(() => Math.floor(Math.random() * 40));
  const [img, setImg] = useState<string | null>(null);
  const [imgState, setImgState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<'write' | 'judging' | 'done'>('write');
  const [result, setResult] = useState<DrillEvaluation | null>(null);
  const [err, setErr] = useState('');
  const [secs, setSecs] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!d.image) return;
    let cancelled = false;
    setImgState('loading'); setImg(null); setSecs(0);
    const t = setInterval(() => setSecs(x => x + 1), 1000);
    fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ su: su.n, variant }) })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => { if (!cancelled) { setImg(j.url); setImgState('idle'); } })
      .catch(() => { if (!cancelled) setImgState('error'); })
      .finally(() => clearInterval(t));
    // 다음 변형을 미리 만들어 둔다 — '다른 사진'이 바로 뜨게
    fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ su: su.n, variant: variant + 1 }) }).catch(() => {});
    return () => { cancelled = true; clearInterval(t); };
  }, [su.n, variant, d.image]);

  async function judge() {
    const s = loadSettings();
    if (!aiReady(s)) { setErr('설정에서 AI를 먼저 연결해 주세요.'); return; }
    if (!answer.trim()) return;
    setPhase('judging'); setErr('');
    try {
      const r = await evaluateDrill(s, d.name, d.purpose, d.scene ?? `「${su.title}」 훈련 사진`, d.instruction, d.constraints ?? [], answer.trim(), undefined, img ?? undefined);
      setResult(r); setPhase('done');
      onDone(r, img ?? undefined);
    } catch (e) {
      setErr('채점 오류: ' + (e instanceof Error ? e.message : String(e)));
      setPhase('write');
    }
  }

  return (
    <div>
      {d.image ? (
        <div style={{ position: 'relative', margin: '4px 4px 10px', boxShadow: '0 0 0 4px var(--card-border)', background: 'var(--bg-subtle)', aspectRatio: '16 / 9' }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={`${su.title} 훈련 사진`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12 }} className="g-dim">
              {imgState === 'error' ? (
                <>사진을 그리지 못했네. <button className="g-btn sm" onClick={() => setVariant(v => v + 1)}>다시 그리기</button></>
              ) : (
                <><div className="anim-bob"><Speaker id="muk" emotion="think" size={44} /></div>오늘 훈련에 맞는 장면을 그리는 중… {secs}초</>
              )}
            </div>
          )}
          {phase === 'write' && img && (
            <button className="g-btn sm" style={{ position: 'absolute', top: 6, right: 6 }} onClick={() => setVariant(v => v + 2)}>↻ 다른 장면</button>
          )}
        </div>
      ) : (
        <div className="g-panel" style={{ fontFamily: 'var(--font-read)', fontSize: 15, lineHeight: 1.7 }}>{d.scene}</div>
      )}
      <div style={{ fontSize: 14, lineHeight: 1.7, margin: '6px 0', fontFamily: 'var(--font-read)' }}>{d.instruction}</div>
      {d.constraints && d.constraints.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--bad)', margin: '4px 0 8px' }}>금지어: {d.constraints.map(c => `"${c}"`).join(' ')}</div>
      )}
      <textarea ref={ta} className="px-textarea" value={answer} onChange={e => setAnswer(e.target.value)} disabled={phase !== 'write'} placeholder="여기에 쓰게." style={{ minHeight: 120 }} />
      {phase === 'write' && <PunctBar target={ta} value={answer} onChange={setAnswer} />}
      {phase !== 'done' && (
        <button className="g-btn primary" onClick={judge} disabled={phase === 'judging' || !answer.trim() || (!!d.image && !img)}>
          {phase === 'judging' ? '스승이 읽는 중…' : '스승에게 보이기'}
        </button>
      )}
      {err && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 6 }}>{err}</div>}
      {result && <DrillResultView r={result} />}
    </div>
  );
}
