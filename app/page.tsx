'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import PersonaPicker from './components/PersonaPicker';
import ChatMessage from './components/ChatMessage';
import Composer from './components/Composer';
import { Icons as I } from './components/Icons';
import { PERSONAS, getPersona, DEFAULT_PERSONA } from '@/lib/personas';
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

  // ── 초기 로드: 사용자 세션 + UI 환경설정 + AI 키 설정 여부 ──────────────
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

  // 로그인 사용자: 대화 목록 로드. ?c=<id> 가 있으면 해당 대화 열기.
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

  // 새 메시지/토큰마다 맨 아래로 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 환경설정 영속화
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
      // 진행 중인 대화가 있으면 새 대화로 전환
      cancelSpeech(); setSpeakingIdx(null);
      setActiveConvId(null);
      setMessages([]);
      try { window.history.replaceState(null, '', '/'); } catch {}
    }
    setPersona(id);
    try { localStorage.setItem('altroai_persona', id); } catch {}
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
    if (busy) return;
    cancelSpeech(); setSpeakingIdx(null);

    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages([...history, { role: 'assistant', content: '', pending: true }]);

    // 로그인 사용자: 대화방 확보 + 질문 저장
    let convId = activeConvId;
    if (user) {
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
    }

    setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    let acc = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId: persona, messages: history.map(m => ({ role: m.role, content: m.content })) }),
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

    // 답변 저장 + 대화 메타 갱신
    if (user && convId && acc) {
      try {
        await addMessage(user.id, convId, { role: 'assistant', content: acc });
        const patch = {
          updatedAt: new Date().toISOString(),
          lastMessage: acc.slice(0, 120),
        };
        await updateConversation(user.id, convId, patch);
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === convId);
          if (idx < 0) return prev;
          const updated = { ...prev[idx], ...patch };
          const rest = prev.filter(c => c.id !== convId);
          return [updated, ...rest]; // 최근 대화 맨 위로
        });
      } catch (e) { console.warn('[AltroAi] 답변 저장 실패:', e); }
    }

    // 음성 자동 출력
    if (voiceOut && synthSupported && acc) {
      const idx = history.length; // 방금 추가된 어시스턴트 메시지의 인덱스
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

  return (
    <main className={`ai-shell ${user ? 'with-side' : ''}`}>
      {user && (
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
      )}

      <section className="ai-main">
        {/* 헤더: 페르소나 전환 + 새 대화 */}
        <div className="ai-chat-header">
          {user && (
            <button className="ai-icon-btn ai-side-toggle" onClick={() => setSidebarOpen(true)} aria-label="대화 기록">
              <I.History width={19} height={19} />
            </button>
          )}
          <div className="ai-persona-bar">
            {PERSONAS.map(p => (
              <button
                key={p.id}
                className={`ai-persona-pill ${persona === p.id ? 'active' : ''}`}
                onClick={() => choosePersona(p.id)}
                style={persona === p.id ? { background: p.accent, borderColor: p.accent, color: '#fff' } : undefined}
              >
                {p.name}
              </button>
            ))}
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
            <PersonaPicker selected={persona} onSelect={choosePersona} onSample={handleSend} />
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
              {!user && (
                <div className="ai-guest-note">
                  <I.Login width={14} height={14} /> 로그인하면 이 대화가 저장되어 나중에 다시 볼 수 있어요.
                </div>
              )}
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
    </main>
  );
}
