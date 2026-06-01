'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser, registerUser } from '@/lib/ai';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!email || !pw) { setErr('이메일과 비밀번호를 입력해주세요'); return; }
    setBusy(true);
    try {
      if (tab === 'login') {
        const u = await loginUser(email, pw);
        if (!u) { setErr('이메일 또는 비밀번호가 일치하지 않습니다'); setBusy(false); return; }
        localStorage.setItem('altroai_user', JSON.stringify(u));
        window.dispatchEvent(new Event('altroai:refresh'));
        router.push('/');
      } else {
        if (!name) { setErr('이름(닉네임)을 입력해주세요'); setBusy(false); return; }
        if (pw.length < 4) { setErr('비밀번호는 4자 이상이어야 합니다'); setBusy(false); return; }
        if (pw !== pw2) { setErr('비밀번호가 일치하지 않습니다'); setBusy(false); return; }
        const r = await registerUser(name, email, pw);
        if ((r as any).error) { setErr((r as any).error); setBusy(false); return; }
        localStorage.setItem('altroai_user', JSON.stringify(r));
        window.dispatchEvent(new Event('altroai:refresh'));
        router.push('/');
      }
    } catch (e: any) {
      const m = e?.message || String(e);
      setErr(/permission|denied/i.test(m) ? 'Firebase 권한 오류 (관리자 문의)' : m || '오류가 발생했습니다');
      setBusy(false);
    }
  };

  return (
    <main className="bj-form-wrap">
      <div className="bj-form-title">Altro<span>Ai</span></div>
      <div className="bj-form-sub">로그인하면 대화 내역이 저장됩니다</div>

      <div className="bj-tabs">
        <button className={`bj-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setErr(''); }}>로그인</button>
        <button className={`bj-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setErr(''); }}>회원가입</button>
      </div>

      {err && <div className="bj-alert bj-alert-error">{err}</div>}

      {tab === 'register' && (
        <div className="bj-field">
          <label>이름</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="표시될 이름" />
        </div>
      )}
      <div className="bj-field">
        <label>이메일</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
          onKeyDown={e => e.key === 'Enter' && submit()} />
      </div>
      <div className="bj-field">
        <label>비밀번호</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="비밀번호"
          onKeyDown={e => e.key === 'Enter' && submit()} />
      </div>
      {tab === 'register' && (
        <div className="bj-field">
          <label>비밀번호 확인</label>
          <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="다시 입력"
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
      )}

      <button className="bj-btn bj-btn-primary bj-btn-block" onClick={submit} disabled={busy} style={{ marginTop: 6 }}>
        {busy ? '처리 중...' : (tab === 'login' ? '로그인' : '가입하기')}
      </button>

      {tab === 'login' && (
        <div className="bj-notice" style={{ textAlign: 'center' }}>
          AltroBoard · AltroShop · AltroTodo · AltroDashBoard 계정으로도 로그인할 수 있습니다.
        </div>
      )}
    </main>
  );
}
