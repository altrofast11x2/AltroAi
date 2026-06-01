'use client';
import { useEffect, useRef, useState } from 'react';
import { Icons as I } from './Icons';
import { createRecognizer, isRecognitionSupported } from '@/lib/speech';

type Props = {
  onSend: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;          // 답변 생성 중 → 정지 버튼
  voiceLang?: string;      // 음성 인식 언어
  placeholder?: string;
};

export default function Composer({ onSend, onStop, busy, voiceLang = 'ko-KR', placeholder }: Props) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<any>(null);
  const micSupported = isRecognitionSupported();

  // 자동 높이 조절
  const resize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };
  useEffect(resize, [text]);

  // 언마운트 시 인식 중단
  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText('');
    setInterim('');
    if (listening) { try { recRef.current?.stop(); } catch {} }
  };

  const toggleMic = () => {
    if (listening) { try { recRef.current?.stop(); } catch {}; return; }
    const rec = createRecognizer({
      lang: voiceLang,
      onStart: () => { setListening(true); setInterim(''); },
      onPartial: (t: string) => setInterim(t),
      onFinal: (t: string) => {
        setText(prev => (prev ? prev + ' ' : '') + t);
        setInterim('');
      },
      onError: () => setListening(false),
      onEnd: () => { setListening(false); setInterim(''); },
    });
    recRef.current = rec;
    rec.start();
  };

  return (
    <div className="ai-composer">
      {listening && (
        <div className="ai-listening">
          <span className="ai-listening-dot" /> 듣는 중… {interim && <em>{interim}</em>}
        </div>
      )}
      <div className="ai-composer-row">
        {micSupported && (
          <button
            type="button"
            className={`ai-mic-btn ${listening ? 'on' : ''}`}
            onClick={toggleMic}
            aria-label={listening ? '음성 입력 중지' : '음성으로 입력'}
            title={listening ? '음성 입력 중지' : '음성으로 입력'}
          >
            {listening ? <I.MicOff width={20} height={20} /> : <I.Mic width={20} height={20} />}
          </button>
        )}

        <textarea
          ref={taRef}
          className="ai-input"
          rows={1}
          value={text}
          placeholder={placeholder || '메시지를 입력하세요…  (Shift+Enter 줄바꿈)'}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />

        {busy ? (
          <button type="button" className="ai-send-btn stop" onClick={onStop} aria-label="생성 중지" title="생성 중지">
            <I.Stop width={18} height={18} />
          </button>
        ) : (
          <button type="button" className="ai-send-btn" onClick={send} disabled={!text.trim()} aria-label="보내기" title="보내기">
            <I.Send width={18} height={18} />
          </button>
        )}
      </div>
    </div>
  );
}
