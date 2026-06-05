'use client';
import { PERSONAS, type CustomPersona } from '@/lib/personas';
import { Icons as I } from './Icons';

type Props = {
  selected: string;
  onSelect: (id: string) => void;
  onSample: (text: string) => void;
  customPersonas?: CustomPersona[];
  onCreate?: () => void;
  onDelete?: (id: string) => void;
};

export default function PersonaPicker({ selected, onSelect, onSample, customPersonas = [], onCreate, onDelete }: Props) {
  const all = [...PERSONAS, ...customPersonas];
  const persona = all.find(p => p.id === selected) || PERSONAS[0];

  return (
    <div className="ai-welcome">
      <div className="ai-welcome-hero">
        <div className="ai-welcome-badge"><I.Sparkles width={15} height={15} /> AltroAi</div>
        <h1 className="ai-welcome-title">무엇을 도와드릴까요?</h1>
        <p className="ai-welcome-sub">먼저 대화 상대(페르소나)를 골라 보세요. 직접 만들 수도 있어요.</p>
      </div>

      <div className="ai-persona-grid">
        {PERSONAS.map(p => {
          const Ico = (I as any)[p.icon] || I.Robot;
          const active = p.id === selected;
          return (
            <button
              key={p.id}
              className={`ai-persona-card ${active ? 'active' : ''}`}
              onClick={() => onSelect(p.id)}
              style={active ? { borderColor: p.accent } : undefined}
            >
              <span className="ai-persona-ico" style={{ background: p.accent }}><Ico width={20} height={20} /></span>
              <span className="ai-persona-name">{p.name}</span>
              <span className="ai-persona-tag">{p.tagline}</span>
            </button>
          );
        })}

        {customPersonas.map(p => {
          const Ico = (I as any)[p.icon] || I.Sparkles;
          const active = p.id === selected;
          return (
            <div
              key={p.id}
              className={`ai-persona-card ${active ? 'active' : ''}`}
              onClick={() => onSelect(p.id)}
              style={active ? { borderColor: p.accent } : undefined}
              role="button"
            >
              {onDelete && (
                <button className="ai-persona-del-card" title="삭제"
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>
                  <I.X width={14} height={14} />
                </button>
              )}
              <span className="ai-persona-ico" style={{ background: p.accent }}><Ico width={20} height={20} /></span>
              <span className="ai-persona-name">{p.name}</span>
              <span className="ai-persona-tag">{p.tagline}</span>
            </div>
          );
        })}

        {onCreate && (
          <button className="ai-persona-card ai-persona-card-add" onClick={onCreate}>
            <span className="ai-persona-ico ai-persona-ico-add"><I.Plus width={20} height={20} /></span>
            <span className="ai-persona-name">직접 만들기</span>
            <span className="ai-persona-tag">마이클 잭슨처럼, 나만의 캐릭터</span>
          </button>
        )}
      </div>

      {persona.samples && persona.samples.length > 0 && (
        <div className="ai-samples">
          <div className="ai-samples-label">
            <span className="ai-persona-dot" style={{ background: persona.accent }} />
            {persona.name} 에게 이렇게 물어보세요
          </div>
          <div className="ai-samples-chips">
            {persona.samples.map((s, i) => (
              <button key={i} className="ai-sample-chip" onClick={() => onSample(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
