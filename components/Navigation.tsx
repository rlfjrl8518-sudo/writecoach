'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/',         label: '★ DASH'   },
  { href: '/writing',  label: '✏ WRITE'  },
  { href: '/sentence', label: '文 SENT'   },
  { href: '/copy',     label: '広 COPY'   },
  { href: '/rewrite',  label: '↔ REDO'   },
  { href: '/training', label: '◎ TRAIN'  },
  { href: '/report',   label: '◈ REPORT' },
  { href: '/settings', label: '⚙ SET'    },
];

export default function Navigation() {
  const path = usePathname();
  return (
    <nav className="nav-root">
      {/* 로고 바 */}
      <div className="nav-top">
        <Link href="/" className="nav-logo">
          ✦ WRITE<span>coach</span>
        </Link>
      </div>
      {/* 탭 바 */}
      <div className="nav-tabs">
        {TABS.map(t => {
          const active = t.href === '/' ? path === '/' : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`nav-link${active ? ' active' : ''}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
