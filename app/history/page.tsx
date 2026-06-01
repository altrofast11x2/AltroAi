'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listConversations, deleteConversation } from '@/lib/ai';
import { getPersona } from '@/lib/personas';
import { Icons as I } from '../components/Icons';

function fmt(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('altroai_user');
      setUser(raw ? JSON.parse(raw) : null);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      setList(await listConversations(user.id));
      setLoading(false);
    })();
  }, [user, ready]);

  const del = async (id: string) => {
    if (!confirm('이 대화를 삭제할까요? 되돌릴 수 없습니다.')) return;
    await deleteConversation(user.id, id);
    setList(prev => prev.filter(c => c.id !== id));
  };

  if (ready && !user) {
    return (
      <main className="ai-page">
        <div className="ai-empty-state">
          <div className="ai-empty-ico"><I.History width={26} height={26} /></div>
          <h2>대화 기록</h2>
          <p>로그인하면 나눈 대화가 저장되어 여기서 다시 볼 수 있어요.</p>
          <Link href="/login" className="bj-btn bj-btn-primary" style={{ marginTop: 14 }}>로그인 / 회원가입</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="ai-page">
      <div className="ai-page-head">
        <div>
          <h1 className="ai-page-title">대화 기록</h1>
          <p className="ai-page-sub">지난 대화를 눌러 이어서 볼 수 있어요.</p>
        </div>
        <Link href="/" className="bj-btn bj-btn-primary bj-btn-sm"><I.NewChat width={15} height={15} /> 새 대화</Link>
      </div>

      {loading ? (
        <div className="ai-empty-state"><p>불러오는 중…</p></div>
      ) : list.length === 0 ? (
        <div className="ai-empty-state">
          <div className="ai-empty-ico"><I.Chat width={26} height={26} /></div>
          <h2>아직 대화가 없어요</h2>
          <p>챗봇에게 질문을 보내면 여기에 기록됩니다.</p>
          <Link href="/" className="bj-btn bj-btn-primary" style={{ marginTop: 14 }}>챗봇으로 가기</Link>
        </div>
      ) : (
        <div className="ai-hist-grid">
          {list.map(c => {
            const p = getPersona(c.personaId);
            return (
              <div key={c.id} className="ai-hist-card" onClick={() => router.push(`/?c=${c.id}`)}>
                <div className="ai-hist-top">
                  <span className="ai-hist-badge" style={{ background: p.accent }}>{p.name}</span>
                  <button className="ai-hist-del" onClick={(e) => { e.stopPropagation(); del(c.id); }} aria-label="삭제">
                    <I.Trash width={15} height={15} />
                  </button>
                </div>
                <div className="ai-hist-title">{c.title || '새 대화'}</div>
                <div className="ai-hist-preview">{c.lastMessage || '…'}</div>
                <div className="ai-hist-time">{fmt(c.updatedAt || c.createdAt)}</div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
