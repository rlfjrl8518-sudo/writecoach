'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';

/* ── 공통 툴팁 ── */
function CleanTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name?: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--card-border)',
      borderRadius: 10, padding: '8px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      fontSize: 13, color: 'var(--text)', fontFamily: 'Pretendard, sans-serif',
    }}>
      {label && <div style={{ fontSize: 11, color: 'var(--dim-star)', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ fontWeight: 700, color: 'var(--accent)' }}>{p.value}점</div>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--card-border)',
      borderRadius: 10, padding: '8px 14px',
      fontSize: 12, color: 'var(--text)', fontFamily: 'Pretendard, sans-serif',
    }}>
      {label && <div style={{ fontSize: 11, color: 'var(--dim-star)', marginBottom: 2 }}>{label}</div>}
      <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{payload[0].value}회</div>
    </div>
  );
}

/* ── 점수 추이 ── */
export function ScoreChart({ data }: { data: { date: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="0" stroke="var(--card-border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="date" tick={{ fill: 'var(--dim-star)', fontSize: 10 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          domain={[40, 100]} tick={{ fill: 'var(--dim-star)', fontSize: 10 }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CleanTooltip />} />
        <Line
          type="monotone" dataKey="score" stroke="var(--secondary)" strokeWidth={2.5}
          dot={{ fill: 'var(--secondary)', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: 'var(--moon)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── 문장 구조 분포 ── */
export function StructureChart({ data }: { data: { name: string; v: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="0" stroke="var(--card-border)" strokeOpacity={0.5} horizontal={false} />
        <XAxis type="number" tick={{ fill: 'var(--dim-star)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={80} tick={{ fill: 'var(--text)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<BarTooltip />} />
        <Bar dataKey="v" fill="var(--accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 감각 표현 레이더 ── */
export function SenseChart({ data }: { data: { subject: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="var(--card-border)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--dim-star)', fontSize: 11 }} />
        <Radar dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── 월별 글 수 ── */
export function MonthlyCountChart({ data }: { data: { month: string; count: number; avg: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="0" stroke="var(--card-border)" strokeOpacity={0.5} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'var(--dim-star)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--dim-star)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '8px 14px', fontSize: 12 }}>
                <div style={{ color: 'var(--dim-star)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 700, color: 'var(--good)' }}>{payload[0].value}편</div>
              </div>
            );
          }}
        />
        <Bar dataKey="count" fill="var(--good)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
