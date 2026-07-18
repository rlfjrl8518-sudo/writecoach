'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (code && supabase) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setStatus('로그인 오류: ' + error.message);
        } else {
          localStorage.setItem('wc_onboarded', 'true');
          router.replace('/');
        }
      });
    } else {
      router.replace('/settings');
    }
  }, [router, searchParams]);

  return (
    <div style={{ textAlign: 'center', padding: '100px 20px' }}>
      <div style={{ fontSize: 28, marginBottom: 20, color: 'var(--accent)', animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>✦</div>
      <p style={{ fontSize: 15, color: 'var(--dim-star)', lineHeight: 1.8, marginTop: 16 }}>
        {status || 'Google 로그인 처리 중...'}
      </p>
      {status && (
        <button
          onClick={() => router.replace('/settings')}
          style={{ marginTop: 20, padding: '10px 24px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}
        >
          설정으로 돌아가기
        </button>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
