'use client';
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isSupabaseConfigured, getCurrentUser } from '@/lib/supabase';

const SKIP_PATHS = ['/login', '/auth/callback'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (SKIP_PATHS.some(p => pathname.startsWith(p))) return;

    const onboarded = localStorage.getItem('wc_onboarded');
    if (onboarded) return;

    // 기존 데이터가 있는 유저는 온보딩 완료로 처리
    const hasData = !!localStorage.getItem('wc_v2_data');
    if (hasData) {
      localStorage.setItem('wc_onboarded', 'true');
      return;
    }

    if (isSupabaseConfigured) {
      getCurrentUser().then(user => {
        if (user) {
          localStorage.setItem('wc_onboarded', 'true');
        } else {
          router.replace('/login');
        }
      });
    } else {
      router.replace('/login');
    }
  }, [router, pathname]);

  return <>{children}</>;
}
