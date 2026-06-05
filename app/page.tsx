'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from './components/Sidebar';
import PersonaPicker from './components/PersonaPicker';
import ChatMessage from './components/ChatMessage';
import Composer from './components/Composer';
import { Icons as I } from './components/Icons';
import {
  PERSONAS, getPersona, DEFAULT_PERSONA,
  getCustomPersonas, addCustomPersona, deleteCustomPersona,
  type CustomPersona,
} from '@/lib/personas';
import {
  listConversations, createConversation, updateConversation, deleteConversation,
  listMessages, addMessage,
} from '@/lib/ai';
import { speak, cancelSpeech, isSynthesisSupported } from '@/lib/speech';

type Msg = { role: 'user' | 'assistant'; content: string; pending?: boolean };

export default function ChatPage() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [aiInfo, setAiInfo] = useState<{ configured: boolean; provider?: string; model?: string } | null>(null);

  const [persona, setPersona] = useState<string>(DEFAULT_PERSONA);
  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [cpName, setCpName] = useState('');
  const [cpInstr, setCpInstr] = useState('');

  const [conversations, setConversations] = useState<any[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  const [voiceOut, setVoiceOut] = useState(false);
  const [voiceLang, setVoiceLang] = useState('ko-KR');
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const synthSupported = isSynthesisSupported();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const readUser = useCallback(() => {
    try {
      const raw = localStorage.getItem('altroai_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  useEffect(() => {
    setUser(readUser());
    try {
      setVoiceOut(localStorage.getItem('altroai_voiceout') === '1');
      setVoiceLang(localStorage.getItem('altroai_voicelang') || 'ko-KR');
      const p = localStorage.getItem('altroai_persona');
      if (p) setPersona(p);
      setCustomPersonas(getCustomPersonas());
    } catch {}
    setReady(true);

    const refresh = () => setUser(readUser());
    window.addEventListener('altroai:refresh', refresh);
    window.addEventListener('storage', refresh);

    fetch('/api/chat').then(r => r.json())
      .then(d => setAiInfo({ configured: !!d.configured, provider: d.provider, model: d.model }))
      .catch(() => setAiInfo({ configured: false }));

    return () => {
      window.removeEventListener('altroai:refresh', refresh);
      window.removeEventListener('storage', refresh);
      cancelSpeech();
    };
  }, [readUser]);

  useEffect(() => {
    if (!ready) return;
    if (!user) { setConversations([]); setActiveConvId(null); return; }
    let cancelled = false;
    (async () => {
      setConvLoading(true);
      const list = await listConversations(user.id);
      if (cancelled) return;
      setConversations(list);
      setConvLoading(false);
      try {
        const cid = new URLSearchParams(window.location.search).get('c');
        if (cid && list.some((c: any) => c.id === cid)) openConversation(cid, list);
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const toggleVoiceOut = () => {
    setVoiceOut(v => {
      const nv = !v;
      try { localStorage.setItem('altroai_voiceout', nv ? '1' : '0'); } catch {}
      if (!nv) { cancelSpeech(); setSpeakingIdx(null); }
      return nv;
    });
  };

  // ── 대화 열기/새로 시작 ───────────────────────────────────────────────
  const openConversation = async (convId: string, list = conversations) => {
    if (!user) return;
    cancelSpeech(); setSpeakingIdx(null);
    setActiveConvId(convId);
    setSidebarOpen(false);
    const conv = list.find((c: any) => c.id === convId);
    if (conv?.personaId) setPersona(conv.personaId);
    const msgs = await listMessages(user.id, convId);
    setMessages(msgs.map((m: any) => ({ role: m.role, content: m.content })));
    try { window.history.replaceState(null, '', `/?c=${convId}`); } catch {}
  };

  const newChat = () => {
    if (busy) return;
    cancelSpeech(); setSpeakingIdx(null);
    setActiveConvId(null);
    setMessages([]);
    setSidebarOpen(false);
    try { window.history.replaceState(null, '', '/'); } catch {}
  };

  const choosePersona = (id: string) => {
    if (messages.length > 0 || activeConvId) {
      cancelSpeech(); setSpeakingIdx(null);
      setActiveConvId(null);
      setMessages([]);
      try { window.history.replaceState(null, '', '/'); } catch {}
    }
    setPersona(id);
    try { localStorage.setItem('altroai_persona', id); } catch {}
  };

  // ── 커스텀 페르소나 ──────────────────────────────────────────────────
  const createPersona = () => {
    const name = cpName.trim();
    if (!name) return;
    const p = addCustomPersona(name, cpInstr);
    setCustomPersonas(getCustomPersonas());
    setShowCreate(false);
    setCpName(''); setCpInstr('');
    choosePersona(p.id);
  };
  const removeCustomPersona = (id: string) => {
    if (!confirm('이 페르소나를 삭제할까요?')) return;
    deleteCustomPersona(id);
    setCustomPersonas(getCustomPersonas());
    if (persona === id) choosePersona(DEFAULT_PERSONA);
  };

  // 마지막(어시스턴트) 메시지에 토큰 이어붙이기
  const appendToLast = (delta: string) =>
    setMessages(prev => {
      const copy = prev.slice();
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') copy[copy.length - 1] = { ...last, content: last.content + delta, pending: false };
      return copy;
    });

  const setLastContent = (content: string) =>
    setMessages(prev => {
      const copy = prev.slice();
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') copy[copy.length - 1] = { role: 'assistant', content };
      return copy;
    });

  // ── 전송 ──────────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    if (busy || !user) return;
    cancelSpeech(); setSpeakingIdx(null);

    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages([...history, { role: 'assistant', content: '', pending: true }]);

    let convId = activeConvId;
    try {
      if (!convId) {
        const conv = await createConversation(user.id, { personaId: persona, title: text });
        convId = conv.id;
        setActiveConvId(convId);
        setConversations(prev => [conv, ...prev]);
        try { window.history.replaceState(null, '', `/?c=${convId}`); } catch {}
      }
      await addMessage(user.id, convId!, { role: 'user', content: text });
    } catch (e) { console.warn('[AltroAi] 질문 저장 실패:', e); }

    setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    let acc = '';

    const customSel = customPersonas.find(p => p.id === persona);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: persona,
          // 커스텀 페르소나면 이름+말투를 함께 전송 (서버가 그 캐릭터로 연기)
          customPersona: customSel ? { name: customSel.name, instructions: customSel.instructions } : undefined,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          email: user?.email || '',
          ownerSecret: (() => { try { return localStorage.getItem('altroai_owner_secret') || ''; } catch { return ''; } })(),
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        let msg = '⚠️ 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.';
        try { const j = await res.json(); if (j?.error) msg = '⚠️ ' + j.error; } catch {}
        setLastContent(msg);
        setBusy(false); abortRef.current = null;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) { acc += chunk; appendToLast(chunk); }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        if (!acc) setLastContent('(중지됨)');
      } else {
        console.error('[AltroAi] 전송 오류:', e);
        if (!acc) setLastContent('⚠️ 네트워크 오류가 발생했어요.');
      }
    }

    setBusy(false);
    abortRef.current = null;

    if (convId && acc) {
      try {
        await addMessage(user.id, convId, { role: 'assistant', content: acc });
        const patch = { updatedAt: new Date().toISOString(), lastMessage: acc.slice(0, 120) };
        await updateConversation(user.id, convId, patch);
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === convId);
          if (idx < 0) return prev;
          const updated = { ...prev[idx], ...patch };
          const rest = prev.filter(c => c.id !== convId);
          return [updated, ...rest];
        });
      } catch (e) { console.warn('[AltroAi] 답변 저장 실패:', e); }
    }

    if (voiceOut && synthSupported && acc) {
      const idx = history.length;
      setSpeakingIdx(idx);
      speak(acc, { lang: voiceLang, onEnd: () => setSpeakingIdx(s => (s === idx ? null : s)) });
    }
  };

  const stop = () => {
    try { abortRef.current?.abort(); } catch {}
    cancelSpeech();
  };

  const onDeleteConv = async (convId: string) => {
    if (!user) return;
    if (!confirm('이 대화를 삭제할까요? 되돌릴 수 없습니다.')) return;
    try { await deleteConversation(user.id, convId); } catch (e) { console.warn(e); }
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConvId === convId) newChat();
  };

  const toggleSpeak = (idx: number, content: string) => {
    if (!synthSupported) return;
    if (speakingIdx === idx) { cancelSpeech(); setSpeakingIdx(null); return; }
    setSpeakingIdx(idx);
    speak(content, { lang: voiceLang, onEnd: () => setSpeakingIdx(s => (s === idx ? null : s)) });
  };

  const activePersona = getPersona(persona);
  const allPersonas = [...PERSONAS, ...customPersonas];

  // 로딩 중(세션 확인 전) — 깜빡임 방지
  if (!ready) return <main className="ai-shell"><section className="ai-main" /></main>;

  // ── 로그인 게이트: 비로그인은 채팅 불가 ──────────────────────────────────
  if (!user) {
    return (
      <main className="ai-shell">
        <section className="ai-main">
          <div className="ai-scroll">
            <div className="ai-welcome">
              <div className="ai-welcome-hero">
                <div className="ai-welcome-badge"><I.Sparkles width={15} height={15} /> AltroAi</div>
                <h1 className="ai-welcome-title">로그인하고 시작하세요</h1>
                <p className="ai-welcome-sub">AltroAi 챗봇은 로그인 후 이용할 수 있어요.<br />대화 내역이 저장되고, 나만의 페르소나도 만들 수 있습니다.</p>
              </div>
              <div className="ai-gate-actions">
                <Link href="/login" className="bj-btn bj-btn-primary"><I.Login width={16} height={16} /> 로그인 / 회원가입</Link>
              </div>
              <div className="ai-gate-features">
                <span><I.Chat width={14} height={14} /> 4가지 페르소나 + 직접 만들기</span>
                <span><I.History width={14} height={14} /> 대화 내역 저장·조회</span>
                <span><I.Mic width={14} height={14} /> 음성 입력/출력</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ai-shell with-side">
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={(id) => openConversation(id)}
        onNew={newChat}
        onDelete={onDeleteConv}
        loading={convLoading}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <section className="ai-main">
        {/* 헤더: 페르소나 전환 + 새 대화 */}
        <div className="ai-chat-header">
          <button className="ai-icon-btn ai-side-toggle" onClick={() => setSidebarOpen(true)} aria-label="대화 기록">
            <I.History width={19} height={19} />
          </button>
          <div className="ai-persona-bar">
            {allPersonas.map(p => (
              <button
                key={p.id}
                className={`ai-persona-pill ${persona === p.id ? 'active' : ''}`}
                onClick={() => choosePersona(p.id)}
                style={persona === p.id ? { background: p.accent, borderColor: p.accent, color: '#fff' } : undefined}
              >
                {p.name}
              </button>
            ))}
            <button className="ai-persona-pill ai-persona-add" onClick={() => setShowCreate(true)} title="새 페르소나 만들기">
              <I.Plus width={13} height={13} /> 만들기
            </button>
          </div>
          <div style={{ flex: 1 }} />
          {messages.length > 0 && (
            <button className="ai-icon-btn" onClick={newChat} aria-label="새 대화" title="새 대화">
              <I.NewChat width={19} height={19} />
            </button>
          )}
        </div>

        {/* 본문 */}
        <div className="ai-scroll" ref={scrollRef}>
          {messages.length === 0 ? (
            <PersonaPicker
              selected={persona}
              onSelect={choosePersona}
              onSample={handleSend}
              customPersonas={customPersonas}
              onCreate={() => setShowCreate(true)}
              onDelete={removeCustomPersona}
            />
          ) : (
            <div className="ai-thread">
              {messages.map((m, i) => (
                <ChatMessage
                  key={i}
                  role={m.role}
                  content={m.content}
                  pending={m.pending}
                  accent={activePersona.accent}
                  canSpeak={synthSupported && m.role === 'assistant'}
                  speaking={speakingIdx === i}
                  onSpeak={() => toggleSpeak(i, m.content)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 입력 영역 */}
        <div className="ai-composer-wrap">
          {aiInfo && aiInfo.configured === false && (
            <div className="ai-setup-note">
              {aiInfo.provider === 'ollama' ? (
                <><strong>Ollama 미실행 (무료 로컬 AI)</strong> — 터미널에서 <code>ollama serve</code> 실행 후 <code>ollama pull {aiInfo.model || 'llama3.2'}</code> 로 모델을 받아주세요.</>
              ) : aiInfo.provider === 'openai' ? (
                <><strong>AI 키 미설정</strong> — 서버에 <code>OPENAI_API_KEY</code> 를 등록하세요. <strong>Groq 무료 키</strong> 권장(Vercel 배포 시). (README 참고)</>
              ) : (
                <><strong>AI 응답 미설정</strong> — <code>ANTHROPIC_API_KEY</code>(유료) 등록 또는 무료 <code>AI_PROVIDER=openai</code>(Groq)/<code>ollama</code> 로 전환. (README 참고)</>
              )}
            </div>
          )}
          {synthSupported && (
            <div className="ai-voice-toggle-row">
              <button className={`ai-voice-toggle ${voiceOut ? 'on' : ''}`} onClick={toggleVoiceOut}
                aria-pressed={voiceOut} title="답변을 음성으로 읽어줍니다">
                {voiceOut ? <I.Volume width={15} height={15} /> : <I.VolumeOff width={15} height={15} />}
                음성 답변 {voiceOut ? 'ON' : 'OFF'}
              </button>
            </div>
          )}
          <Composer
            onSend={handleSend}
            onStop={stop}
            busy={busy}
            voiceLang={voiceLang}
            placeholder={`${activePersona.name}에게 메시지 보내기…`}
          />
        </div>
      </section>

      {/* 새 페르소나 만들기 모달 */}
      {showCreate && (
        <div className="bj-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="bj-modal" onClick={e => e.stopPropagation()}>
            <div className="bj-modal-title">새 페르소나 만들기</div>
            <div className="bj-modal-body" style={{ marginBottom: 14 }}>
              이름만 적어도 돼요. 그 인물/캐릭터의 말투로 대화합니다. (예: <strong>마이클 잭슨</strong>)
            </div>
            <div className="bj-field">
              <label>이름</label>
              <input value={cpName} onChange={e => setCpName(e.target.value)} maxLength={60}
                placeholder="예: 마이클 잭슨, 셰익스피어, 츤데레 비서…"
                onKeyDown={e => e.key === 'Enter' && createPersona()} autoFocus />
            </div>
            <div className="bj-field">
              <label>말투 / 설정 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(선택)</span></label>
              <textarea value={cpInstr} onChange={e => setCpInstr(e.target.value)} rows={3} maxLength={1000}
                placeholder="예: 팝의 황제처럼 자신감 있게, 가끔 '히히' 추임새를 넣어줘" />
            </div>
            <div className="bj-modal-actions">
              <button className="bj-btn" onClick={() => setShowCreate(false)}>취소</button>
              <button className="bj-btn bj-btn-primary" onClick={createPersona} disabled={!cpName.trim()}>만들기</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
