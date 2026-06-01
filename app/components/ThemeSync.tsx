'use client';
import { useEffect } from 'react';

// 현재 테마 환경설정(localStorage)을 실제 dark/light 로 해석
function resolve(): 'dark' | 'light' {
  let pref = 'light';
  try { pref = localStorage.getItem('altroai_theme') || 'light'; } catch {}
  const dark =
    pref === 'dark' ||
    (pref === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  return dark ? 'dark' : 'light';
}

// 레이아웃은 쿠키로 SSR 단계에서 data-theme 를 미리 박아 깜빡임(FOUC)을 막는다.
// 이 컴포넌트는 ① 하이드레이션 후 환경설정과 실제 DOM 을 맞추고 ② 다음 로드를 위해 쿠키를 갱신한다.
// (인라인 <script> 를 렌더하지 않으므로 React 의 "script in component" 경고가 없다)
export default function ThemeSync() {
  useEffect(() => {
    const apply = () => {
      const r = resolve();
      const el = document.documentElement;
      if (r === 'dark') el.setAttribute('data-theme', 'dark');
      else el.removeAttribute('data-theme');
      try { document.cookie = `altroai_theme=${r}; path=/; max-age=31536000; samesite=lax`; } catch {}
    };
    apply();

    let mq: MediaQueryList | null = null;
    try { mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', apply); } catch {}
    window.addEventListener('altroai:theme', apply);
    return () => {
      try { mq?.removeEventListener('change', apply); } catch {}
      window.removeEventListener('altroai:theme', apply);
    };
  }, []);
  return null;
}
