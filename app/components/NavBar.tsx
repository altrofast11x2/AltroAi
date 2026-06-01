'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icons as I } from './Icons';

const ALTRO_APPS = [
  { name: 'AltroBoard', url: 'https://altroboard.vercel.app/' },
  { name: 'AltroShop', url: 'https://altroshop.vercel.app/' },
  { name: 'AltroTodo', url: 'https://altrotodo.vercel.app/' },
  { name: 'AltroDashBoard', url: 'https://altrodashboard.vercel.app/' },
];

const NAV = [
  { href: '/',        label: '챗봇',     icon: I.Chat },
  { href: '/history', label: '대화 기록', icon: I.History },
];

export default function NavBar() {
  const [user, setUser] = useState<any>(null);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem('altroai_user');
        setUser(raw ? JSON.parse(raw) : null);
      } catch { setUser(null); }
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('altroai:refresh', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('altroai:refresh', refresh);
    };
  }, [pathname]);

  useEffect(() => { setDrawer(false); }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  const logout = () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    localStorage.removeItem('altroai_user');
    setUser(null);
    window.dispatchEvent(new Event('altroai:refresh'));
    router.push('/');
  };

  return (
    <>
      <header className="bj-header">
        <div className="bj-header-inner">
          <Link href="/" className="bj-logo">Altro<span>Ai</span></Link>

          <nav className="bj-header-right" style={{ marginLeft: 8 }}>
            {NAV.map(n => {
              const Ico = n.icon;
              // 대화 기록은 로그인한 사용자에게만 노출
              if (n.href === '/history' && !user) return null;
              const active = pathname === n.href;
              return (
                <Link key={n.href} href={n.href} className={`bj-nav-link ${active ? 'active' : ''}`}>
                  <Ico width={17} height={17} /><span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="bj-header-spacer" />

          <div className="bj-header-right">
            {user ? (
              <button onClick={() => setDrawer(true)} className="bj-avatar" aria-label="메뉴">
                {(user.name || '?')[0].toUpperCase()}
              </button>
            ) : (
              <Link href="/login" className="bj-login-btn">로그인 / 회원가입</Link>
            )}
            <button onClick={() => setDrawer(true)} className="bj-hamburger" aria-label="메뉴">
              <I.Menu width={22} height={22} />
            </button>
          </div>
        </div>
      </header>

      {drawer && (
        <>
          <div className="bj-drawer-overlay" onClick={() => setDrawer(false)} />
          <aside className="bj-drawer">
            <div className="bj-drawer-head">
              <div className="bj-drawer-head-title">메뉴</div>
              <button className="bj-drawer-close" onClick={() => setDrawer(false)} aria-label="닫기">
                <I.X width={20} height={20} />
              </button>
            </div>

            {user ? (
              <div className="bj-drawer-user">
                <div className="bj-avatar">{(user.name || '?')[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bj-drawer-user-name">{user.name}</div>
                  <div className="bj-drawer-user-email">{user.email}</div>
                </div>
              </div>
            ) : (
              <div className="bj-drawer-cta">
                <Link href="/login" className="bj-drawer-coin-btn">
                  <I.Login width={14} height={14} /> 로그인 / 회원가입
                </Link>
                <div className="bj-drawer-cta-note">
                  로그인하면 <strong>대화 내역이 저장</strong>되어<br />
                  나중에 다시 볼 수 있어요
                </div>
              </div>
            )}

            <nav className="bj-drawer-nav">
              <Link href="/" className={`bj-drawer-item ${pathname === '/' ? 'active' : ''}`}>
                <span className="bj-drawer-item-icon"><I.Chat width={20} height={20} /></span>
                챗봇
              </Link>
              {user && (
                <Link href="/history" className={`bj-drawer-item ${pathname === '/history' ? 'active' : ''}`}>
                  <span className="bj-drawer-item-icon"><I.History width={20} height={20} /></span>
                  대화 기록
                </Link>
              )}
              <Link href="/settings" className={`bj-drawer-item ${pathname === '/settings' ? 'active' : ''}`}>
                <span className="bj-drawer-item-icon"><I.Cog width={20} height={20} /></span>
                설정
              </Link>

              <div className="bj-drawer-sect">다른 Altro 앱</div>
              {ALTRO_APPS.map(app => (
                <a key={app.url} href={app.url} target="_blank" rel="noopener noreferrer" className="bj-drawer-item">
                  <span className="bj-drawer-item-icon"><I.Apps width={20} height={20} /></span>
                  {app.name}
                  <span className="bj-drawer-item-ext"><I.Ext width={13} height={13} /></span>
                </a>
              ))}
            </nav>

            {user && (
              <div className="bj-drawer-bottom">
                <button onClick={logout} className="bj-drawer-item bj-drawer-logout">
                  <span className="bj-drawer-item-icon"><I.Logout width={20} height={20} /></span>
                  로그아웃
                </button>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
