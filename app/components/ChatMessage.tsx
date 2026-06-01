'use client';
import { useState } from 'react';
import { Icons as I } from './Icons';
import { renderMarkdown } from '@/lib/markdown';

type Props = {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;       // 답변 스트리밍 중(아직 내용 없음)이면 점 애니메이션
  accent?: string;         // 어시스턴트 아바타 색
  canSpeak?: boolean;      // 음성 출력 지원 환경인지
  speaking?: boolean;      // 이 메시지를 지금 읽는 중인지
  onSpeak?: () => void;    // 읽기/멈추기 토글
};

export default function ChatMessage({ role, content, pending, accent = 'var(--accent)', canSpeak, speaking, onSpeak }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <div className={`ai-msg ${isUser ? 'user' : 'bot'}`}>
      {!isUser && (
        <div className="ai-msg-avatar" style={{ background: accent }} aria-hidden>
          <I.Robot width={18} height={18} />
        </div>
      )}
      <div className="ai-msg-body">
        <div className="ai-msg-bubble">
          {isUser ? (
            <div className="ai-msg-usertext">{content}</div>
          ) : pending && !content ? (
            <div className="ai-typing" aria-label="답변 작성 중"><span /><span /><span /></div>
          ) : (
            <div className="ai-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          )}
        </div>

        {!isUser && !pending && content && (
          <div className="ai-msg-tools">
            <button className="ai-tool-btn" onClick={copy} aria-label="복사">
              {copied ? <I.Check width={14} height={14} /> : <I.Copy width={14} height={14} />}
              <span>{copied ? '복사됨' : '복사'}</span>
            </button>
            {canSpeak && onSpeak && (
              <button className={`ai-tool-btn ${speaking ? 'on' : ''}`} onClick={onSpeak} aria-label={speaking ? '멈추기' : '읽어주기'}>
                {speaking ? <I.Stop width={14} height={14} /> : <I.Volume width={14} height={14} />}
                <span>{speaking ? '멈춤' : '듣기'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
