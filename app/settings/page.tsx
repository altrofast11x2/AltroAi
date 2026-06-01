'use client';
import { useState, useEffect } from 'react';
import { PERSONAS } from '@/lib/personas';
import { isRecognitionSupported, isSynthesisSupported, speak } from '@/lib/speech';
import { Icons as I } from '../components/Icons';
import { saveSettings } from '@/lib/ai';

type Theme = 'light' | 'dark' | 'system';

function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  if (!dark) document.documentElement.removeAttribute('data-theme');
}

const LANGS = [
  { id: 'ko-KR', label: '한국어' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'ja-JP', label: '日本語' },
];

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [voiceOut, setVoiceOut] = useState(false);
  const [voiceLang, setVoiceLang] = useState('ko-KR');
  const [defaultPersona, setDefaultPersona] = useState(PERSONAS[0].id);

  const recSupported = isRecognitionSupported();
  const synthSupported = isSynthesisSupported();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('altroai_user');
      setUser(raw ? JSON.parse(raw) : null);
      setTheme((localStorage.getItem('altroai_theme') as Theme) || 'light');
      setVoiceOut(localStorage.getItem('altroai_voiceout') === '1');
      setVoiceLang(localStorage.getItem('altroai_voicelang') || 'ko-KR');
      setDefaultPersona(localStorage.getItem('altroai_persona') || PERSONAS[0].id);
    } catch {}
  }, []);

  const persist = (key: string, val: string) => {
    try { localStorage.setItem(key, val); } catch {}
  };
  const syncFirebase = (patch: any) => {
    if (user) saveSettings(user.id, patch).catch(() => {});
  };

  const onTheme = (t: Theme) => {
    setTheme(t);
    persist('altroai_theme', t);
    applyTheme(t);
    // ThemeSync 가 쿠키(SSR 용)를 갱신하도록 알림 → 다음 로드부터 깜빡임 없음
    try { window.dispatchEvent(new Event('altroai:theme')); } catch {}
    syncFirebase({ theme: t });
  };
  const onVoiceOut = () => {
    setVoiceOut(v => {
      const nv = !v;
      persist('altroai_voiceout', nv ? '1' : '0');
      syncFirebase({ voiceOutput: nv });
      return nv;
    });
  };
  const onLang = (l: string) => {
    setVoiceLang(l);
    persist('altroai_voicelang', l);
    syncFirebase({ voiceLang: l });
  };
  const onPersona = (p: string) => {
    setDefaultPersona(p);
    persist('altroai_persona', p);
    syncFirebase({ defaultPersona: p });
  };

  return (
    <main className="ai-page ai-page-narrow">
      <div className="ai-page-head">
        <div>
          <h1 className="ai-page-title">설정</h1>
          <p className="ai-page-sub">테마와 음성, 기본 페르소나를 조정하세요.</p>
        </div>
      </div>

      {/* 테마 */}
      <div className="db-card">
        <h3>테마</h3>
        <div className="hint">화면 밝기 모드를 선택하세요.</div>
        <div className="db-theme-opts">
          {(['light', 'dark', 'system'] as Theme[]).map(t => (
            <button key={t} className={`db-theme-opt ${theme === t ? 'active' : ''}`} onClick={() => onTheme(t)}>
              {t === 'light' ? '라이트' : t === 'dark' ? '다크' : '시스템'}
            </button>
          ))}
        </div>
      </div>

      {/* 음성 */}
      <div className="db-card">
        <h3>음성 (Web Speech API)</h3>
        <div className="hint">브라우저 내장 음성 기능을 사용합니다. (Chrome 권장)</div>

        <div className="db-toggle-row">
          <div className="db-toggle-text">
            <strong>음성 답변 자동 재생</strong>
            <small>{synthSupported ? '답변이 완성되면 자동으로 읽어줍니다.' : '이 브라우저는 음성 출력을 지원하지 않습니다.'}</small>
          </div>
          <button className={`db-switch ${voiceOut ? 'on' : ''}`} onClick={onVoiceOut} disabled={!synthSupported} aria-pressed={voiceOut} />
        </div>

        <div className="db-toggle-row">
          <div className="db-toggle-text">
            <strong>음성 언어</strong>
            <small>음성 입력 인식 / 출력 재생 언어</small>
          </div>
          <select className="db-input db-select" value={voiceLang} onChange={e => onLang(e.target.value)} style={{ maxWidth: 180 }}>
            {LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>

        {synthSupported && (
          <button className="bj-btn bj-btn-sm" style={{ marginTop: 12 }}
            onClick={() => speak('안녕하세요, AltroAi 음성 테스트입니다.', { lang: voiceLang })}>
            <I.Volume width={14} height={14} /> 음성 미리듣기
          </button>
        )}

        <div className="ai-cap-row">
          <span className={`ai-cap ${recSupported ? 'ok' : 'no'}`}>
            <I.Mic width={13} height={13} /> 음성 입력 {recSupported ? '지원' : '미지원'}
          </span>
          <span className={`ai-cap ${synthSupported ? 'ok' : 'no'}`}>
            <I.Volume width={13} height={13} /> 음성 출력 {synthSupported ? '지원' : '미지원'}
          </span>
        </div>
      </div>

      {/* 기본 페르소나 */}
      <div className="db-card">
        <h3>기본 페르소나</h3>
        <div className="hint">새 대화를 시작할 때 기본으로 선택되는 대화 상대입니다.</div>
        <div className="ai-set-persona-list">
          {PERSONAS.map(p => {
            const Ico = (I as any)[p.icon] || I.Robot;
            return (
              <button key={p.id} className={`ai-set-persona ${defaultPersona === p.id ? 'active' : ''}`}
                onClick={() => onPersona(p.id)} style={defaultPersona === p.id ? { borderColor: p.accent } : undefined}>
                <span className="ai-persona-ico" style={{ background: p.accent }}><Ico width={18} height={18} /></span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.tagline}</small>
                </span>
                {defaultPersona === p.id && <I.Check width={18} height={18} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bj-notice">
        설정은 이 브라우저에 저장되며{user ? ', 로그인 계정에도 동기화됩니다.' : '(로그인하면 계정에도 저장됩니다).'}
      </div>
    </main>
  );
}
