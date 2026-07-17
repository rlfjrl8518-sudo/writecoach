'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { loadDB, computeXP, computeStreak, getWriterRank } from '@/lib/db';
import type { SyncStatus } from '@/components/CloudSync';

const TABS = [
  { href: '/',         icon: '⌂',  label: '홈',    matches: ['/'] },
  { href: '/writing',  icon: '✏',  label: '글쓰기', matches: ['/writing', '/expressions'] },
  { href: '/sentence', icon: '文',  label: '수집',   matches: ['/sentence', '/copy'] },
  { href: '/calendar', icon: '暦',  label: '달력',   matches: ['/calendar'] },
  { href: '/training', icon: '◎',  label: '훈련',   matches: ['/training'] },
  { href: '/books',    icon: '册',  label: '책',    matches: ['/books'] },
  { href: '/settings', icon: '⚙',  label: '설정',   matches: ['/settings'] },
];

function isActive(tab: typeof TABS[0], path: string) {
  if (tab.href === '/') return path === '/';
  return tab.matches.some(m => path.startsWith(m));
}

function SyncBadge() {
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const handler = (e: Event) => setStatus((e as CustomEvent<SyncStatus>).detail);
    window.addEventListener('sync-status', handler);
    return () => window.removeEventListener('sync-status', handler);
  }, []);

  if (!mounted || !isSupabaseConfigured) return null;

  const cfg: Record<SyncStatus, { icon: string; color: string; title: string }> = {
    synced:  { icon: '☁', color: '#7C3B49', title: '동기화됨 · 계정 설정'  },
    syncing: { icon: '↻', color: '#F0A500', title: '동기화 중...'            },
    error:   { icon: '☁', color: '#B14B42', title: '동기화 오류 · 설정 확인' },
    offline: { icon: '☁', color: 'var(--card-border)', title: '로그인하고 동기화하기' },
  };
  const { icon, color, title } = cfg[status];

  return (
    <button
      title={title}
      onClick={() => router.push(status === 'offline' ? '/login' : '/settings')}
      style={{
        width: 28, height: 28, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        animation: status === 'syncing' ? 'spin 1s linear infinite' : undefined,
      }}
    >
      {icon}
    </button>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  if (!mounted) return <div style={{ width: 36, height: 36, flexShrink: 0 }} />;

  return (
    <button onClick={toggle} title={dark ? '라이트 모드' : '다크 모드'} style={{
      background: 'var(--bg-subtle)', border: '1px solid var(--card-border)',
      borderRadius: 10, width: 36, height: 36, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', fontSize: 15, color: 'var(--dim-star)',
      transition: 'background 0.12s',
    }}>
      {dark ? '☀' : '☾'}
    </button>
  );
}

function CoachChatButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => setOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener('coach-chat-state', handler);
    return () => window.removeEventListener('coach-chat-state', handler);
  }, []);
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('toggle-coach-chat'))}
      title="AI 코치에게 물어보기"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: open ? 'var(--accent-dim)' : 'transparent',
        border: open ? '1.5px solid var(--accent)' : '1.5px solid var(--card-border)',
        borderRadius: 20, padding: '3px 10px 3px 3px',
        cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      {/* 프로필 이미지 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/character-default.png.png"
        alt="코치"
        style={{
          width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', display: 'block',
          border: `2px solid ${open ? 'var(--accent)' : 'var(--card-border)'}`,
          transition: 'border-color 0.15s',
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 600, color: open ? 'var(--accent)' : 'var(--dim-star)', transition: 'color 0.15s', fontFamily: 'Pretendard, sans-serif' }}>
        코치
      </span>
    </button>
  );
}

function GamificationBar() {
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    setMounted(true);
    function refresh() {
      const db = loadDB();
      setStreak(computeStreak(db.writings));
      setXp(computeXP(db));
    }
    refresh();
    window.addEventListener('db-saved', refresh);
    return () => window.removeEventListener('db-saved', refresh);
  }, []);

  if (!mounted) return null;

  const rank = getWriterRank(xp);

  return (
    <div style={{
      margin: '12px 0 4px',
      padding: '10px 14px',
      background: 'var(--bg-subtle)',
      border: '1px solid var(--card-border)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* 스트릭 + 등급 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 15 }}>{streak > 0 ? '🔥' : '💤'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: streak > 0 ? '#F0A500' : 'var(--dim-star)', fontFamily: 'Pretendard, sans-serif' }}>
            {streak > 0 ? `${streak}일 연속` : '오늘 첫 글을'}
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: rank.color, fontFamily: 'Pretendard, sans-serif' }}>
          {rank.label}
        </span>
      </div>
      {/* XP 진행 바 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="pixel-font" style={{ fontSize: 6, color: 'var(--dim-star)' }}>XP</span>
          <span className="pixel-font" style={{ fontSize: 6, color: 'var(--dim-star)' }}>
            {xp}{rank.nextXP ? ` / ${rank.nextXP}` : ' MAX'}
          </span>
        </div>
        <div style={{ height: 5, background: 'var(--bg-input)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: rank.color,
            width: `${rank.progress}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

export default function Navigation() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem('wc_nav_collapsed') === 'true');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('wc_nav_collapsed', collapsed ? 'true' : 'false');
    document.documentElement.setAttribute('data-nav-collapsed', collapsed ? 'true' : 'false');
  }, [collapsed, mounted]);

  return (
    <nav className="nav-root">
      <button
        className="nav-collapse-btn"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
      >
        {collapsed ? '›' : '‹'}
      </button>
      {/* 로고 영역 */}
      <div className="nav-top">
        <div>
          <Link href="/" className="nav-logo">✦ 글<span>습관</span></Link>
          <div className="nav-logo-sub">AI 글쓰기 훈련</div>
        </div>
        {/* 모바일 전용: 우측 액션 */}
        <div className="nav-top-actions">
          <SyncBadge />
          <CoachChatButton />
          <ThemeToggle />
        </div>
      </div>

      {/* 스트릭 / XP 바 (사이드바 전용) */}
      <div className="nav-gamification">
        <GamificationBar />
      </div>

      {/* 탭 (데스크톱: 세로 사이드바 / 모바일: 하단 고정) */}
      <div className="nav-tabs">
        {TABS.map(tab => {
          const active = isActive(tab, path);
          return (
            <Link key={tab.href} href={tab.href} className={`nav-link${active ? ' active' : ''}`}>
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* 데스크톱 전용: 사이드바 하단 */}
      <div className="nav-sidebar-footer">
        <SyncBadge />
        <ThemeToggle />
      </div>
    </nav>
  );
}
