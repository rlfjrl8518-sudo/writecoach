'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  loadDB, type DB,
  computeXP, computeStreak, computeDailyChars, getWriterRank,
  loadGamification,
} from '@/lib/db';

function getHeroContent(streak: number, totalWritings: number) {
  if (streak >= 30) return {
    badge: `🔥 ${streak}일 연속`,
    title: '진짜 습관이 됐네요.',
    sub: '대단해요. 오늘도 한 편 더 써봐요.',
  };
  if (streak >= 7) return {
    badge: `🔥 ${streak}일 연속`,
    title: '일주일 넘게 이어왔어요.',
    sub: '조금만 더, 습관이 완성되고 있어요.',
  };
  if (streak >= 3) return {
    badge: `🔥 ${streak}일 연속`,
    title: '이제 감이 잡히고 있어요.',
    sub: '오늘도 한 편, 꾸준히 써봐요.',
  };
  if (streak >= 1) return {
    badge: '✏ 오늘의 글쓰기',
    title: '오늘도 쓰고 있군요.',
    sub: '매일 쓰면 실력이 됩니다.',
  };
  if (totalWritings === 0) return {
    badge: '✏ 글쓰기 시작',
    title: '글습관에 오신 걸 환영해요.',
    sub: '첫 글부터 시작해봐요. 딱 한 편이면 돼요.',
  };
  const h = new Date().getHours();
  const greeting = h < 12 ? '좋은 아침이에요.' : h < 18 ? '오늘 한 편 어때요?' : '오늘 하루를 글로 마무리해요.';
  return {
    badge: '✏ 오늘의 글쓰기',
    title: greeting,
    sub: '매일 한 편씩, 글이 습관이 됩니다.',
  };
}

function FeatureCard({ icon, title, desc, href, color }: {
  icon: string; title: string; desc: string; href: string; color: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div className="home-feature-card">
        <div style={{ fontSize: 22, color, marginBottom: 10, fontWeight: 700, lineHeight: 1 }}>
          {icon}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.01em' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--dim-star)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [db, setDb] = useState<DB | null>(null);

  useEffect(() => { setDb(loadDB()); }, []);

  if (!db) return null;

  const streak = computeStreak(db.writings);
  const xp = computeXP(db);
  const rank = getWriterRank(xp);
  const dailyChars = computeDailyChars(db.writings);
  const dailyGoal = loadGamification().dailyGoal;
  const dailyPct = Math.min(100, Math.round((dailyChars / dailyGoal) * 100));
  const dailyDone = dailyChars >= dailyGoal;
  const { badge, title, sub } = getHeroContent(streak, db.writings.length);
  const pendingMissions = db.missions.filter(m => !m.completed).length;
  const exprCount = Object.keys(db.expressions).length;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* ── Hero ── */}
      <div style={{ padding: '44px 0 36px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent-dim)', color: 'var(--accent)',
          fontSize: 13, fontWeight: 600,
          padding: '5px 14px', borderRadius: 100, marginBottom: 18,
        }}>
          {badge}
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: 'var(--text)',
          margin: '0 0 10px', lineHeight: 1.3, letterSpacing: '-0.03em',
        }}>
          {title}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--dim-star)', margin: '0 0 32px', lineHeight: 1.7 }}>
          {sub}
        </p>
        <Link href="/writing" className="btn-cta">글쓰기 시작</Link>
      </div>

      {/* ── 일일 목표 ── */}
      <div className="px-card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{dailyDone ? '✅' : '🎯'}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'Pretendard, sans-serif' }}>
              {dailyDone ? '오늘 목표 달성!' : '오늘의 목표'}
            </span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: dailyDone ? 'var(--good)' : 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif' }}>
            {dailyChars.toLocaleString()} / {dailyGoal.toLocaleString()}자
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: dailyDone ? 'var(--good)' : 'var(--accent)',
            width: `${dailyPct}%`,
            transition: 'width 0.5s ease',
          }} />
        </div>
        {!dailyDone && (
          <div style={{ fontSize: 11, color: 'var(--dim-star)', marginTop: 6, fontFamily: 'Pretendard, sans-serif' }}>
            {(dailyGoal - dailyChars).toLocaleString()}자 더 쓰면 달성이에요
          </div>
        )}
      </div>

      {/* ── Quick Stats ── */}
      <div className="px-card" style={{ display: 'flex', padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        {[
          { label: '작성 글', value: db.writings.length, unit: '편' },
          { label: '누적 XP', value: xp, unit: 'XP', color: rank.color },
          { label: rank.label, value: rank.nextXP ? `${rank.progress}%` : 'MAX', unit: '', color: rank.color },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', padding: '18px 8px',
            borderRight: i < 2 ? '1px solid var(--card-border)' : 'none',
          }}>
            <div style={{
              fontSize: 22, fontWeight: 700,
              color: (s as { color?: string }).color || 'var(--text)',
              letterSpacing: '-0.02em', lineHeight: 1,
            }}>
              {s.value}
              {s.unit && <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 2 }}>{s.unit}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim-star)', marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Feature Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FeatureCard
          icon="文" title="문장 수집"
          desc="좋은 문장 수집·분석"
          href="/sentence" color="var(--accent)"
        />
        <FeatureCard
          icon="広" title="카피 수집"
          desc="광고 카피 해부"
          href="/copy" color="var(--moon)"
        />
        <FeatureCard
          icon="◎" title="훈련 과제"
          desc={pendingMissions > 0 ? `${pendingMissions}개 진행 중` : '맞춤 과제 생성'}
          href="/training" color="var(--good)"
        />
        <FeatureCard
          icon="◈" title="성장 리포트"
          desc="내 글쓰기 전체 분석"
          href="/report" color="var(--dim-star)"
        />
      </div>
    </div>
  );
}
