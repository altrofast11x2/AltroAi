'use client';
import { Icons as I } from './Icons';
import { getPersona } from '@/lib/personas';

type Conv = { id: string; title: string; personaId: string; lastMessage?: string; updatedAt?: string };

type Props = {
  conversations: Conv[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
  open?: boolean;        // 모바일 슬라이드오버
  onClose?: () => void;
};

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 604800) return `${Math.floor(s / 86400)}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, loading, open, onClose }: Props) {
  return (
    <>
      {open && <div className="ai-side-overlay" onClick={onClose} />}
      <aside className={`ai-sidebar ${open ? 'open' : ''}`}>
        <button className="ai-newchat-btn" onClick={onNew}>
          <I.NewChat width={17} height={17} /> 새 대화
        </button>

        <div className="ai-side-label">대화 기록</div>

        <div className="ai-conv-list">
          {loading ? (
            <div className="ai-side-empty">불러오는 중…</div>
          ) : conversations.length === 0 ? (
            <div className="ai-side-empty">아직 대화가 없어요.<br />질문을 보내면 여기에 저장됩니다.</div>
          ) : (
            conversations.map(c => {
              const p = getPersona(c.personaId);
              return (
                <div
                  key={c.id}
                  className={`ai-conv-item ${activeId === c.id ? 'active' : ''}`}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="ai-conv-dot" style={{ background: p.accent }} />
                  <div className="ai-conv-text">
                    <div className="ai-conv-title">{c.title || '새 대화'}</div>
                    <div className="ai-conv-meta">{p.name} · {timeAgo(c.updatedAt)}</div>
                  </div>
                  <button
                    className="ai-conv-del"
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                    aria-label="대화 삭제"
                  >
                    <I.Trash width={15} height={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
