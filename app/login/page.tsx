'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, signInWithGoogle, isSupabaseConfigured } from '@/lib/supabase';

const FEATURES = [
  { icon: '✏', title: 'AI 글쓰기 분석', desc: '내 글의 구조, 감각 표현, 개선점을 자동으로 분석해드려요.' },
  { icon: '◎', title: '매일 글쓰기 훈련', desc: '맞춤 미션과 평가로 꾸준한 글쓰기 습관을 만들어요.' },
  { icon: '☁', title: '기기간 동기화', desc: 'PC · 모바일 어디서든 내 기록에 바로 접근해요.' },
];

function GoogleIcon({ white = false }: { white?: boolean }) {
  const fill = white ? 'rgba(255,255,255,0.92)' : undefined;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill={fill ?? '#4285F4'}/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={fill ?? '#34A853'}/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill={fill ?? '#FBBC05'}/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={fill ?? '#EA4335'}/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (isSupabaseConfigured) {
      getCurrentUser().then(user => {
        if (user) router.replace('/');
      });
    }
  }, [router]);

  async function handleGoogle() {
    setLoading(true);
    setErr('');
    const { error } = await signInWithGoogle();
    if (error) {
      setErr(error);
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', paddingTop: 20 }}>
      {/* 로고 */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em', fontFamily: 'Pretendard, sans-serif' }}>
            ✦ 글<span style={{ color: 'var(--text)' }}>습관</span>
          </div>
        </Link>
        <div style={{ fontSize: 13, color: 'var(--dim-star)', marginTop: 8, lineHeight: 1.7 }}>
          AI와 함께 매일 성장하는 글쓰기 훈련
        </div>
      </div>

      {/* 피처 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {FEATURES.map(f => (
          <div key={f.title} className="px-card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 18px' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, color: 'var(--accent)', flexShrink: 0,
            }}>
              {f.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3, letterSpacing: '-0.01em' }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--dim-star)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isSupabaseConfigured ? (
          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              width: '100%', padding: '14px 20px',
              background: 'var(--accent)', color: 'var(--on-accent)',
              border: 'none', borderRadius: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 15, fontWeight: 700,
              fontFamily: 'Pretendard, sans-serif',
              letterSpacing: '-0.01em',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.12s',
            }}
          >
            <GoogleIcon white />
            {loading ? 'Google 연결 중...' : 'Google로 시작하기'}
          </button>
        ) : null}

        <button
          onClick={() => {
            localStorage.setItem('wc_onboarded', 'true');
            router.push('/');
          }}
          style={{
            width: '100%', padding: '13px 20px',
            background: 'transparent', border: '1.5px solid var(--card-border)',
            borderRadius: 14, cursor: 'pointer',
            fontSize: 14, color: 'var(--dim-star)',
            fontFamily: 'Pretendard, sans-serif',
            transition: 'all 0.12s',
          }}
        >
          로그인 없이 시작하기
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--bad)', textAlign: 'center', lineHeight: 1.6 }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 28, fontSize: 11, color: 'var(--dim-star)', textAlign: 'center', lineHeight: 2, opacity: 0.7 }}>
        로그인 시 모든 기기에서 자동 동기화돼요.<br />
        Google 계정 정보는 인증 외 용도로 사용하지 않아요.
      </div>
    </div>
  );
}
