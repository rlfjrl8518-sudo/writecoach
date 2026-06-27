'use client';
import React, { useState, useEffect } from 'react';
import {
  loadDB, saveDB, loadSettings, getLast30DaysScores, getTopEntries,
  getTotalChars, getAvgScore, getMonthlyWritingStats,
  type DB, type WeaknessSynthesis,
} from '@/lib/db';
import { generateMonthlyReport, synthesizeWeaknesses } from '@/lib/openai';
import dynamic from 'next/dynamic';

const ScoreChart        = dynamic(() => import('@/components/ReportCharts').then(m => ({ default: m.ScoreChart })),        { ssr: false });
const MonthlyCountChart = dynamic(() => import('@/components/ReportCharts').then(m => ({ default: m.MonthlyCountChart })), { ssr: false });

/* ── 섹션 헤더 ── */
function SectionHeader({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--dim-star)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ── 통계 칩 ── */
function StatChip({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}<span style={{ fontSize: 14, fontWeight: 500, marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--dim-star)', marginTop: 5 }}>{label}</div>
    </div>
  );
}

/* ── 바 리스트 ── */
function BarList({ items, color }: { items: { name: string; count: number }[]; color: string }) {
  if (!items.length) return <p style={{ fontSize: 13, color: 'var(--dim-star)' }}>아직 데이터가 없어요</p>;
  const max = items[0].count;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(item => (
        <div key={item.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{item.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color }}>{item.count}회</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-input)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(item.count / max) * 100}%`, background: color, borderRadius: 100, transition: 'width 0.7s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 강점 태그 리스트 ── */
function StrengthTags({ items }: { items: { name: string; count: number }[] }) {
  if (!items.length) return <p style={{ fontSize: 13, color: 'var(--dim-star)' }}>아직 데이터가 없어요</p>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(item => (
        <span key={item.name} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 20,
          background: 'var(--good-dim)', border: '1px solid var(--good-border)',
          fontSize: 13, color: 'var(--good)', fontFamily: 'Pretendard, sans-serif', fontWeight: 500,
        }}>
          {item.name}
          <span style={{ fontSize: 11, opacity: 0.7 }}>{item.count}회</span>
        </span>
      ))}
    </div>
  );
}

/* ── 월간 리포트 콘텐츠 ── */
function ReportContent({ text }: { text: string }) {
  const sections = text.split(/^###\s+/m).filter(Boolean);
  if (!sections.length) {
    return <p style={{ fontSize: 14, lineHeight: 2, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{text}</p>;
  }
  return (
    <div>
      {sections.map((sec, i) => {
        const nl    = sec.indexOf('\n');
        const title = nl === -1 ? sec : sec.slice(0, nl).trim();
        const body  = nl === -1 ? '' : sec.slice(nl + 1).trim();
        return (
          <div key={i} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: i < sections.length - 1 ? '1px solid var(--card-border)' : 'none' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.01em' }}>{title}</div>
            <p style={{ fontSize: 14, color: 'var(--dim-star)', lineHeight: 1.9, margin: 0, whiteSpace: 'pre-wrap' }}>{body}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── 로더 ── */
function Loader() {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(n => (n + 1) % 3), 500); return () => clearInterval(t); }, []);
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 22, color: 'var(--moon)', letterSpacing: 8, marginBottom: 14 }}>
        {['● ○ ○', '● ● ○', '● ● ●'][f]}
      </div>
      <p style={{ fontSize: 14, color: 'var(--dim-star)' }}>데이터를 분석하고 있어요...</p>
    </div>
  );
}

export default function ReportPage() {
  const [db, setDb] = useState<DB | null>(null);
  const [report, setReport]   = useState('');
  const [loading, setLoading] = useState(false);
  const [month, setMonth]     = useState(() => new Date().toISOString().slice(0, 7));
  const [err, setErr]         = useState('');
  const [weakLoading, setWeakLoading] = useState(false);
  const [weakErr, setWeakErr]         = useState('');

  useEffect(() => { setDb(loadDB()); }, []);

  async function handleGenerate() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    if (!db) return;

    const monthWritings = db.writings.filter(w => w.date.startsWith(month) && w.analysis);
    if (!monthWritings.length) { setErr(`${month}에 분석된 글이 없어요. (최소 1편 필요)`); return; }

    setLoading(true); setErr(''); setReport('');

    const scores = monthWritings.map(w => w.analysis!.score);

    const mWeaknesses: Record<string, number> = {};
    monthWritings.forEach(w => {
      (w.analysis!.weaknesses || []).forEach(wk => {
        const k = wk.trim().toLowerCase().replace(/\s+/g, ' ');
        mWeaknesses[k] = (mWeaknesses[k] || 0) + 1;
      });
    });

    const mExpressions: Record<string, number> = {};
    monthWritings.forEach(w => {
      (w.analysis!.expressions || []).forEach(e => {
        if (e.text) { const k = e.text.trim(); mExpressions[k] = (mExpressions[k] || 0) + 1; }
      });
    });

    // 이번 달 문장 역할 분포
    const monthSentences = db.sentences.filter(s => s.createdAt?.startsWith(month) && s.analysis?.sentenceRole);
    const mRoles: Record<string, number> = {};
    monthSentences.forEach(s => {
      const r = s.analysis!.sentenceRole!;
      mRoles[r] = (mRoles[r] || 0) + 1;
    });

    const weakTop5 = getTopEntries(mWeaknesses, 5).map(([k, v]) => `${k}(${v}회)`);
    const exprTop5 = Object.entries(mExpressions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v}회)`);
    const roleTop  = getTopEntries(mRoles, 7).map(([k, v]) => `${k}(${v}회)`);

    const payload = {
      year: month.slice(0, 4), month: month.slice(5, 7),
      total_count:              monthWritings.length,
      avg_score:                Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      max_score:                Math.max(...scores),
      min_score:                Math.min(...scores),
      top5_weaknesses:          weakTop5,
      top5_expressions:         exprTop5,
      sentence_role_distribution: roleTop,
      total_writings_lifetime:    db.writings.length,
      total_sentences_collected:  db.sentences.length,
      total_copies_collected:     db.copies.length,
    };

    try {
      const text = await generateMonthlyReport(s, payload);
      setReport(text);
    } catch (e: unknown) {
      setErr('오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  }

  if (!db) return null;

  const analyzed     = db.writings.filter(w => w.analysis);
  const avgScore     = getAvgScore(db);
  const totalChars   = getTotalChars(db);
  const last30       = getLast30DaysScores(db);
  const monthlyStats = getMonthlyWritingStats(db);

  // 약점 집계 (현재 저장된 writings 기준)
  const liveWeaknesses: Record<string, number> = {};
  analyzed.forEach(w => {
    (w.analysis!.weaknesses || []).forEach(s => {
      const k = s.trim().toLowerCase().replace(/\s+/g, ' ');
      liveWeaknesses[k] = (liveWeaknesses[k] || 0) + 1;
    });
  });

  // 강점 집계
  const liveStrengths: Record<string, number> = {};
  analyzed.forEach(w => {
    (w.analysis!.strengths || []).forEach(s => {
      const k = s.trim().toLowerCase().replace(/\s+/g, ' ');
      liveStrengths[k] = (liveStrengths[k] || 0) + 1;
    });
  });

  // 학습 제안 (최근 분석글에서 중복 제거)
  const suggestionSet = new Set<string>();
  const liveSuggestions: string[] = [];
  [...analyzed].reverse().forEach(w => {
    (w.analysis!.improvement_suggestions || []).forEach(sg => {
      const k = sg.trim();
      if (k && !suggestionSet.has(k)) { suggestionSet.add(k); liveSuggestions.push(k); }
    });
  });

  const weakTop     = getTopEntries(liveWeaknesses, 5).map(([k, v]) => ({ name: k, count: v }));
  const strengthTop = getTopEntries(liveStrengths, 8).map(([k, v]) => ({ name: k, count: v }));
  const noData      = db.writings.length === 0;
  const weakSynth: WeaknessSynthesis[] | null = db.weaknessSynthesis?.length ? db.weaknessSynthesis : null;

  async function handleSynthesizeWeaknesses() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setWeakErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    setWeakLoading(true); setWeakErr('');
    try {
      const items = getTopEntries(liveWeaknesses, 15).map(([text, count]) => ({ text, count }));
      const res = await synthesizeWeaknesses(s, items);
      const fresh = loadDB();
      fresh.weaknessSynthesis = res;
      fresh.weaknessSynthesisAt = new Date().toISOString();
      saveDB(fresh);
      setDb(fresh);
    } catch (e: unknown) {
      setWeakErr('오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setWeakLoading(false); }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 28 }}>
        성장 리포트
      </div>

      {noData ? (
        <div className="px-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>◈</div>
          <p style={{ fontSize: 15, color: 'var(--dim-star)', lineHeight: 1.8 }}>
            아직 데이터가 없어요.<br />글을 쓰고 AI 분석을 받으면 리포트가 채워져요.
          </p>
        </div>
      ) : (
        <>
          {/* ── 1. 전체 통계 ── */}
          <div className="px-card" style={{ marginBottom: 20 }}>
            <SectionHeader title="전체 현황" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <StatChip label="총 작성 글"  value={db.writings.length}  unit="편" />
              <StatChip label="분석 완료"   value={analyzed.length}     unit="편"  color="var(--accent)" />
              <StatChip label="평균 점수"   value={avgScore ?? '—'}     unit={avgScore ? '점' : ''} color={avgScore && avgScore >= 70 ? 'var(--good)' : 'var(--moon)'} />
              <StatChip label="누적 글자"   value={totalChars >= 10000 ? `${(totalChars / 10000).toFixed(1)}만` : totalChars.toLocaleString()} unit="자" color="var(--dim-star)" />
            </div>
          </div>

          {/* ── 2. 점수 추이 ── */}
          {last30.length > 1 && (
            <div className="px-card" style={{ marginBottom: 20 }}>
              <SectionHeader title="점수 추이" sub="최근 30일 AI 분석 점수 변화" />
              <ScoreChart data={last30} />
            </div>
          )}

          {/* ── 3. 월별 글 수 ── */}
          {monthlyStats.length > 1 && (
            <div className="px-card" style={{ marginBottom: 20 }}>
              <SectionHeader title="월별 작성량" sub="월마다 쓴 글 편수" />
              <MonthlyCountChart data={monthlyStats} />
            </div>
          )}

          {/* ── 4. 약점 종합 진단 ── */}
          <div className="px-card" style={{ marginBottom: 20 }}>
            <SectionHeader title="주요 약점" sub="AI가 반복된 피드백을 종합한 핵심 진단" />
            {weakTop.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--dim-star)' }}>아직 데이터가 없어요</p>
            ) : weakSynth ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {weakSynth.map((w, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', background: 'var(--bad-dim)',
                    borderLeft: '3px solid var(--bad-border)', borderRadius: '0 8px 8px 0',
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--bad)', marginBottom: 6 }}>{i + 1}. {w.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.8, marginBottom: 7 }}>{w.explanation}</div>
                    <div style={{ fontSize: 12, color: 'var(--accent)', lineHeight: 1.7, fontWeight: 500 }}>→ {w.suggestion}</div>
                  </div>
                ))}
                <button className="px-btn-ghost-sm" onClick={handleSynthesizeWeaknesses} disabled={weakLoading} style={{ alignSelf: 'flex-start' }}>
                  {weakLoading ? '★ 다시 진단 중...' : '↻ 다시 진단받기'}
                </button>
              </div>
            ) : (
              <div>
                <button className="px-btn px-btn-accent" onClick={handleSynthesizeWeaknesses} disabled={weakLoading}>
                  {weakLoading ? '★ 진단 중...' : '✦ AI로 약점 진단받기'}
                </button>
                {weakErr && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--bad)', padding: '8px 12px', borderLeft: '2px solid var(--bad-border)', background: 'var(--bad-dim)' }}>
                    {weakErr}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 5. 강점 ── */}
          <div className="px-card" style={{ marginBottom: 20 }}>
            <SectionHeader title="강점" sub="AI가 반복적으로 칭찬한 요소" />
            {strengthTop.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--dim-star)' }}>아직 데이터가 없어요</p>
            ) : (
              <StrengthTags items={strengthTop} />
            )}
          </div>

          {/* ── 6. 학습 제안 ── */}
          {liveSuggestions.length > 0 && (
            <div className="px-card" style={{ marginBottom: 20 }}>
              <SectionHeader title="학습 제안" sub="최근 분석에서 나온 개선 방향" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {liveSuggestions.slice(0, 6).map((sg, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '10px 14px',
                    background: 'var(--accent-dim)',
                    borderLeft: '3px solid var(--accent)',
                    borderRadius: '0 8px 8px 0',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 18, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, fontFamily: 'Pretendard, sans-serif' }}>{sg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 6. 월간 AI 리포트 ── */}
      <div className="px-card" style={{ marginBottom: 20 }}>
        <SectionHeader title="월간 AI 리포트" sub="해당 월의 글쓰기 데이터를 AI가 종합 분석해요" />

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: err ? 12 : 0 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--dim-star)', marginBottom: 6, fontWeight: 500 }}>분석 월</div>
            <input
              className="px-input"
              type="month" value={month}
              onChange={e => setMonth(e.target.value)}
              style={{ width: 160, fontSize: 14 }}
            />
          </div>
          <button className="btn-cta" onClick={handleGenerate} disabled={loading}
            style={{ width: 'auto', padding: '12px 24px', fontSize: 15, maxWidth: 'none' }}>
            {loading ? '분석 중...' : 'AI 리포트 생성'}
          </button>
          {report && (
            <button className="px-btn-ghost" onClick={() => {
              const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `글습관_리포트_${month}.txt`;
              a.click();
            }}>
              ↓ 저장
            </button>
          )}
        </div>

        {err && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--bad)', padding: '10px 14px', background: 'var(--bad-dim)', borderRadius: 10 }}>
            {err}
          </div>
        )}

        {loading && <Loader />}

        {!loading && report && (
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--card-border)' }}>
            <ReportContent text={report} />
          </div>
        )}

        {!loading && !report && (
          <div style={{ marginTop: 20, textAlign: 'center', padding: '24px 0', color: 'var(--dim-star)', fontSize: 13 }}>
            월을 선택하고 리포트를 생성해보세요
          </div>
        )}
      </div>
    </div>
  );
}
