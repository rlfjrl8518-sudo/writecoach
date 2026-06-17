'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';

type TooltipProps = { active?: boolean; payload?: { value: number }[]; label?: string };

function DarkTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--accent)',
      padding: '8px 12px', fontSize: 11, color: 'var(--text)',
    }}>
      {label && <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="pixel-font" style={{ fontSize: 9, color: 'var(--moon)' }}>{p.value}</div>
      ))}
    </div>
  );
}

interface Props {
  last30: { date: string; score: number }[];
  structures: { name: string; v: number }[];
  senses: { subject: string; value: number }[];
}

export default function DashboardCharts({ last30, structures, senses }: Props) {
  const noSenses = senses.every(s => s.value === 0);

  return (
    <>
      {/* 점수 추이 */}
      {last30.length > 1 && (
        <div className="px-card" style={{ marginBottom: 18 }}>
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 14 }}>✦ 최근 30일 점수 추이</div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={last30} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,90,0.8)" />
              <XAxis dataKey="date" tick={{ fill: '#c3daf5', fontSize: 8, fontFamily: 'monospace' }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#c3daf5', fontSize: 8, fontFamily: 'monospace' }} />
              <Tooltip content={<DarkTooltip />} />
              <Line type="monotone" dataKey="score" stroke="#a78bfa" strokeWidth={2}
                dot={{ fill: '#a78bfa', r: 3 }} activeDot={{ r: 5, fill: '#ffd97d' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 구조 분포 + 감각 레이더 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }} className="grid-2">
        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 문장 구조 분포</div>
          {structures.length === 0
            ? <p style={{ fontSize: 11, color: 'var(--card-border)' }}>아직 데이터가 없어요</p>
            : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={structures} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(42,42,90,0.7)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#c3daf5', fontSize: 8 }} />
                  <YAxis type="category" dataKey="name" width={76} tick={{ fill: '#e8dcc8', fontSize: 9 }} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="v" fill="#a78bfa" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        <div className="px-card">
          <div className="pixel-font" style={{ fontSize: 7, color: 'var(--dim-star)', marginBottom: 12 }}>✦ 감각 표현 분포</div>
          {noSenses
            ? <p style={{ fontSize: 11, color: 'var(--card-border)' }}>아직 데이터가 없어요</p>
            : (
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={senses} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                  <PolarGrid stroke="rgba(42,42,90,0.8)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#c3daf5', fontSize: 10 }} />
                  <Radar dataKey="value" stroke="#ffd97d" fill="#ffd97d" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>
    </>
  );
}
