'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { loadDB } from '@/lib/db';
import { rankOf, currentStreak, getGame, pathView } from '@/lib/game';
import { Speaker } from '@/components/art/Art';
import { retrySync } from '@/components/CloudSync';
import type { SyncStatus } from '@/components/CloudSync';

const TABS = [
  { href: '/',         icon: '堂',  label: '서재', matches: ['/'] },
  { href: '/practice', icon: '修',  label: '수련', matches: ['/practice'] },
  { href: '/writing',  icon: '文',  label: '글방', matches: ['/writing'] },
  { href: '/books',    icon: '冊',  label: '서고', matches: ['/books'] },
  { href: '/journey',  icon: '錄',  label: '기록', matches: ['/journey', '/report', '/calendar'], minor: true },
  { href: '/settings', icon: '設',  label: '설정', matches: ['/settings'], minor: true },
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

  if (!mounted || status === 'none') return null;

  const cfg: Record<SyncStatus, { icon: string; color: string; title: string }> = {
    synced:  { icon: '☁', color: 'var(--accent)', title: 'PC·모바일 동기화됨 · 설정'  },
    syncing: { icon: '↻', color: 'var(--moon)',   title: '동기화 중...'            },
    error:   { icon: '⟲', color: 'var(--bad)',    title: '동기화 오류 · 눌러서 재시도' },
    offline: { icon: '☁', color: 'var(--card-border)', title: '동기화 꺼짐 · 오프라인이거나 로그인 전' },
    none:    { icon: '☁', color: 'var(--card-border)', title: '' },
  };
  const { icon, color, title } = cfg[status];

  return (
    <button
      title={title}
      onClick={() => {
        if (status === 'error') { retrySync(); return; }
        router.push(status === 'offline' && isSupabaseConfigured && navigator.onLine ? '/login' : '/settings');
      }}
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
      {/* 묵당 선생 */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${open ? 'var(--accent)' : 'var(--card-border)'}`,
        transition: 'border-color 0.15s',
      }}>
        <Speaker id="muk" size={28} style={{ border: 'none' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: open ? 'var(--accent)' : 'var(--dim-star)', transition: 'color 0.15s', fontFamily: 'Pretendard, sans-serif' }}>
        스승
      </span>
    </button>
  );
}

function GamificationBar() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [st, setSt] = useState({ streak: 0, mastered: 0, title: '견습 제자', color: '#8f8fb8', robe: '#5a5a8a', name: '' });

  useEffect(() => {
    setMounted(true);
    function refresh() {
      const db = loadDB();
      const r = rankOf(db);
      setSt({ streak: currentStreak(db), mastered: pathView(db).masteredCount, title: r.title, color: r.color, robe: r.robe, name: getGame(db).name });
    }
    refresh();
    window.addEventListener('db-saved', refresh);
    return () => window.removeEventListener('db-saved', refresh);
  }, []);

  if (!mounted) return null;

  return (
    <div onClick={() => router.push('/journey')} className="g-panel" style={{ margin: '12px 8px 8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <Speaker id="me" size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.title}</span>
          {st.streak > 0 && <span style={{ fontSize: 11, color: 'var(--moon)', fontWeight: 600 }}>등불 {st.streak}</span>}
        </div>
        <div className="px-bar-wrap" style={{ height: 5 }} title={`백지첩 ${st.mastered}/24`}><div style={{ width: `${st.mastered / 24 * 100}%`, height: '100%', background: 'var(--seal)', borderRadius: 999 }} /></div>
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
          <Link href="/" className="nav-logo">백지<span>첩</span></Link>
          <div className="nav-logo-sub">산마루 서재 · 묵당의 문장 수련</div>
        </div>
        {/* 모바일 전용: 우측 액션 */}
        <div className="nav-top-actions">
          <SyncBadge />
          {TABS.filter(t => t.minor).map(t => (
            <Link key={t.href} href={t.href} title={t.label}
              className={`nav-top-link${isActive(t, path) ? ' active' : ''}`}>{t.icon}</Link>
          ))}
          <CoachChatButton />
          <ThemeToggle />
        </div>
      </div>

      {/* 제자 등급 / 등불 바 (사이드바 전용) */}
      <div className="nav-gamification">
        <GamificationBar />
      </div>

      {/* 탭 (데스크톱: 세로 사이드바 / 모바일: 하단 고정) */}
      <div className="nav-tabs">
        {TABS.map(tab => {
          const active = isActive(tab, path);
          return (
            <Link key={tab.href} href={tab.href} className={`nav-link${active ? ' active' : ''}${tab.minor ? ' nav-link-minor' : ''}`}>
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
