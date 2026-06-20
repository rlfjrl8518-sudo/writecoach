'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  loadDB, loadSettings, getLast30DaysScores, getTopEntries,
  getTopExpressions, getTotalChars, getAvgScore, getMonthlyWritingStats,
  type DB,
} from '@/lib/db';
import { generateMonthlyReport } from '@/lib/openai';

const ScoreChart        = dynamic(() => import('@/components/ReportCharts').then(m => ({ default: m.ScoreChart })),        { ssr: false });
const StructureChart    = dynamic(() => import('@/components/ReportCharts').then(m => ({ default: m.StructureChart })),    { ssr: false });
const SenseChart        = dynamic(() => import('@/components/ReportCharts').then(m => ({ default: m.SenseChart })),        { ssr: false });
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

/* ── 바 리스트 (약점/표현) ── */
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

/* ── 월간 리포트 콘텐츠 렌더링 ── */
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
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.01em' }}>
              {title}
            </div>
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

  useEffect(() => { setDb(loadDB()); }, []);

  async function handleGenerate() {
    const s = loadSettings();
    const hasKey = s.provider === 'gemini' ? !!s.geminiApiKey : !!s.apiKey;
    if (!hasKey) { setErr('설정 탭에서 API 키를 먼저 입력해주세요.'); return; }
    if (!db) return;

    const monthWritings = db.writings.filter(w => w.date.startsWith(month) && w.analysis);
    if (!monthWritings.length) { setErr(`${month}에 분석된 글이 없어요. (최소 1편 필요)`); return; }

    setLoading(true); setErr(''); setReport('');

    const scores      = monthWritings.map(w => w.analysis!.score);
    const partialDB   = { ...db, writings: monthWritings };
    const weakTop5    = getTopEntries(db.weaknesses, 5).map(([k, v]) => `${k}(${v}회)`);
    const exprTop5    = getTopExpressions(partialDB, 5).map(([k, v]) => `${k}(${v.count}회)`);
    const structTop5  = getTopEntries(db.structures, 5).map(([k, v]) => `${k}(${v}회)`);
    const allWords    = monthWritings.flatMap(w => w.analysis!.repeated_words || []);
    const wordCount: Record<string, number> = {};
    allWords.forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });

    const payload = {
      year: month.slice(0, 4), month: month.slice(5, 7),
      total_count: monthWritings.length,
      avg_score:   Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      max_score:   Math.max(...scores), min_score: Math.min(...scores),
      top5_weaknesses: weakTop5, top5_expressions: exprTop5, top5_structures: structTop5,
      sense_distribution:        db.senses,
      top10_repeated_words:      Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w),
      total_writings_lifetime:   db.writings.length,
      total_sentences_collected: db.sentences.length,
      total_copies_collected:    db.copies.length,
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
  const structures   = getTopEntries(db.structures, 7).map(([k, v]) => ({ name: k, v }));
  const senses       = ['시각', '청각', '후각', '미각', '촉각'].map(k => ({ subject: k, value: db.senses[k] || 0 }));
  const weakTop      = getTopEntries(db.weaknesses, 5).map(([k, v]) => ({ name: k, count: v }));
  const exprTop      = getTopExpressions(db, 5).map(([k, v]) => ({ name: k, count: v.count }));
  const noData       = db.writings.length === 0;

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
              <StatChip label="총 작성 글"  value={db.writings.length} unit="편" />
              <StatChip label="분석 완료"   value={analyzed.length}    unit="편"  color="var(--accent)" />
              <StatChip label="평균 점수"   value={avgScore ?? '—'}    unit={avgScore ? '점' : ''}  color={avgScore && avgScore >= 70 ? 'var(--good)' : 'var(--moon)'} />
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

          {/* ── 4. 약점 & 표현 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }} className="grid-2">
            <div className="px-card">
              <SectionHeader title="주요 약점" sub="반복적으로 지적된 항목" />
              <BarList items={weakTop} color="var(--bad)" />
            </div>
            <div className="px-card">
              <SectionHeader title="누적 표현" sub="자주 수집한 표현" />
              <BarList items={exprTop} color="var(--accent)" />
            </div>
          </div>

          {/* ── 5. 구조 & 감각 ── */}
          {(structures.length > 0 || senses.some(s => s.value > 0)) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }} className="grid-2">
              <div className="px-card">
                <SectionHeader title="문장 구조" sub={
                  <span>가장 많이 쓴 구조 · <Link href="/guide#structure" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>용어 설명 →</Link></span>
                } />
                {structures.length > 0
                  ? <StructureChart data={structures} />
                  : <p style={{ fontSize: 13, color: 'var(--dim-star)' }}>아직 데이터가 없어요</p>
                }
              </div>
              <div className="px-card">
                <SectionHeader title="감각 표현" sub="5감 활용 현황" />
                {senses.some(s => s.value > 0)
                  ? <SenseChart data={senses} />
                  : <p style={{ fontSize: 13, color: 'var(--dim-star)' }}>아직 데이터가 없어요</p>
                }
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
