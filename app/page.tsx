'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  loadDB, getLast30DaysScores, getAnalyzedWritings, getTopEntries,
  getTopExpressions, getTotalChars, getAvgScore, type DB,
} from '@/lib/db';

/* recharts는 ~95KB — 동적 임포트로 초기 번들에서 제외 */
const DashboardCharts = dynamic(() => import('@/components/DashboardCharts'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', animation: 'twinkle 1.5s ease-in-out infinite' }}>
        ✦ 차트 로딩 중...
      </div>
    </div>
  ),
});

function StatCard({ label, value, unit, color }: {
  label: string; value: string | number; unit?: string; color?: string;
}) {
  return (
    <div className="px-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
      <div className="pixel-font" style={{ fontSize: 20, color: color || 'var(--moon)', marginBottom: 6 }}>
        {value}
        {unit && <span style={{ fontSize: 9, marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--dim-star)' }}>{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [db, setDb] = useState<DB | null>(null);

  useEffect(() => { setDb(loadDB()); }, []);

  if (!db) return null;

  const analyzed = getAnalyzedWritings(db);
  const isEmpty  = db.writings.length === 0;

  if (isEmpty) {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto 0', textAlign: 'center' }}>
        <div className="px-card-accent" style={{ padding: '60px 30px' }}>
          <div className="pixel-font" style={{ fontSize: 22, color: 'var(--moon)', marginBottom: 20, animation: 'twinkle 3s ease-in-out infinite' }}>✦</div>
          <p className="serif-font" style={{ fontSize: 16, lineHeight: 2, color: 'var(--text)', marginBottom: 8 }}>
            별헤는 밤에 오신 걸 환영해요.<br />글쓰기를 시작하면 이 곳에 데이터가 쌓여요.
          </p>
          <p className="pixel-font" style={{ fontSize: 6.5, color: 'var(--dim-star)', lineHeight: 2.2, marginBottom: 28 }}>
            WRITE → 글쓰기 &amp; AI분석 · SENT → 좋은 문장 수집<br />
            COPY → 카피 분석 · REDO → 다시쓰기 · TRAIN → 맞춤훈련
          </p>
          <Link href="/writing" className="px-btn px-btn-accent">✏ 첫 글 쓰러 가기</Link>
        </div>
      </div>
    );
  }

  const last30     = getLast30DaysScores(db);
  const weakTop    = getTopEntries(db.weaknesses, 10).map(([k, v]) => ({ name: k, v }));
  const exprTop    = getTopExpressions(db, 10);
  const structures = getTopEntries(db.structures, 7).map(([k, v]) => ({ name: k, v }));
  const senses     = ['시각', '청각', '후각', '미각', '촉각'].map(k => ({ subject: k, value: db.senses[k] || 0 }));
  const copyTypes  = getTopEntries(db.copyTypes, 9).map(([k, v]) => ({ name: k, v }));
  const missions   = db.missions.filter(m => !m.completed).slice(0, 3);
  const totalChars = getTotalChars(db);
  const avgScore   = getAvgScore(db);

  return (
    <div>
      <div className="px-sec-title" style={{ marginBottom: 18 }}>★ DASHBOARD</div>

      {/* 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        <StatCard label="총 작성 글" value={db.writings.length} unit="편" />
        <StatCard label="분석 완료" value={analyzed.length} unit="편" color="var(--accent)" />
        <StatCard label="수집 문장" value={db.sentences.length} unit="개" color="var(--dim-star)" />
        <StatCard label="카피 수집" value={db.copies.length} unit="개" color="var(--moon)" />
        <StatCard label="누적 글자" value={totalChars >= 10000 ? (totalChars / 10000).toFixed(1) + '만' : totalChars.toLocaleString()} unit="자" color="var(--dim-star)" />
        <StatCard label="평균 점수" value={avgScore ?? '—'} unit={avgScore ? 'pt' : ''} color={avgScore && avgScore >= 70 ? 'var(--good)' : 'var(--moon)'} />
      </div>

      {/* 점수 추이 (동적 로딩) */}
      <DashboardCharts last30={last30} structures={structures} senses={senses} />

      {/* 약점 + 표현 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }} className="grid-2">
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 약점 TOP10</div>
          {weakTop.length === 0
            ? <p style={{ fontSize: 11, color: 'var(--card-border)' }}>아직 데이터가 없어요</p>
            : weakTop.map((w, i) => (
              <div key={w.name} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>
                    <span className="pixel-font" style={{ fontSize: 6, color: 'var(--bad)', marginRight: 5 }}>{i + 1}.</span>
                    {w.name}
                  </span>
                  <span className="pixel-font" style={{ fontSize: 7, color: 'var(--bad)' }}>{w.v}회</span>
                </div>
                <div className="px-bar-wrap-thin">
                  <div className="px-bar-fill-bad" style={{ width: `${(w.v / weakTop[0].v) * 100}%` }} />
                </div>
              </div>
            ))
          }
        </div>

        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 누적 표현 TOP10</div>
          {exprTop.length === 0
            ? <p style={{ fontSize: 11, color: 'var(--card-border)' }}>아직 데이터가 없어요</p>
            : exprTop.map(([expr, rec], i) => (
              <div key={expr} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>
                    <span className="pixel-font" style={{ fontSize: 6, color: 'var(--accent)', marginRight: 5 }}>{i + 1}.</span>
                    {expr}
                    <span style={{ fontSize: 9, color: 'var(--card-border)', marginLeft: 4 }}>[{rec.category}]</span>
                  </span>
                  <span className="pixel-font" style={{ fontSize: 7, color: 'var(--accent)' }}>{rec.count}회</span>
                </div>
                <div className="px-bar-wrap-thin">
                  <div className="px-bar-fill" style={{ width: `${(rec.count / exprTop[0][1].count) * 100}%` }} />
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* 카피 유형 + 훈련 과제 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="grid-2">
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 카피 유형 분포</div>
          {copyTypes.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontSize: 11, color: 'var(--card-border)', marginBottom: 12 }}>아직 카피 분석 데이터가 없어요</p>
                <Link href="/copy" className="px-btn-ghost-sm">카피 분석하러 가기 →</Link>
              </div>
            )
            : copyTypes.map(c => (
              <div key={c.name} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>{c.name}</span>
                  <span className="pixel-font" style={{ fontSize: 7, color: 'var(--moon)' }}>{c.v}회</span>
                </div>
                <div className="px-bar-wrap-thin">
                  <div className="px-bar-fill-moon" style={{ width: `${(c.v / copyTypes[0].v) * 100}%` }} />
                </div>
              </div>
            ))
          }
        </div>

        <div className="px-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)' }}>✦ 훈련 과제</div>
            <Link href="/training" className="px-btn-ghost-sm">전체 보기 →</Link>
          </div>
          {missions.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontSize: 11, color: 'var(--card-border)', marginBottom: 12 }}>진행 중인 과제가 없어요</p>
                <Link href="/training" className="px-btn-ghost-sm">과제 생성하러 가기 →</Link>
              </div>
            )
            : missions.map(m => (
              <div key={m.id} style={{
                marginBottom: 10, padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)', borderLeft: '2px solid var(--accent)',
              }}>
                <div className="pixel-font" style={{ fontSize: 6.5, color: 'var(--accent)', marginBottom: 4 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: 'var(--dim-star)', lineHeight: 1.65 }}>
                  {m.description.length > 65 ? m.description.slice(0, 65) + '…' : m.description}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
