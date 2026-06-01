// ───────────────────────────────────────────────────────────────────────────
//  간단한 RAG (Retrieval) — 외부 라이브러리/벡터 DB 없이 동작하는 키워드 기반 검색
//  질문과 키워드가 겹치는 지식 문서를 점수순으로 골라낸다.
//  점수 = ① 단어 토큰 매칭(영문/한글 단어) + ② 한글 2-gram(글자 묶음) 겹침으로 한글 활용형도 잡음.
// ───────────────────────────────────────────────────────────────────────────
import { KNOWLEDGE, type KnowledgeDoc } from './knowledge';

const norm = (s: string) => (s || '').toLowerCase();

// 영문/숫자 또는 한글 덩어리를 단어로 추출 (2글자 이상만)
function wordTokens(s: string): string[] {
  return (norm(s).match(/[a-z0-9]+|[가-힣]+/g) || []).filter(t => t.length >= 2);
}

// 글자 2-gram 집합 (공백·특수문자 제거 후) — 한글 형태소 변화에 강함
function bigrams(s: string): Set<string> {
  const clean = norm(s).replace(/[^a-z0-9가-힣]/g, '');
  const out = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2));
  return out;
}

function scoreDoc(doc: KnowledgeDoc, query: string, qBigrams: Set<string>): number {
  const title = norm(doc.title);
  const tags = norm(doc.tags.join(' '));
  const content = norm(doc.content);

  let score = 0;

  // ① 단어 토큰 매칭 — 제목 > 태그 > 본문 순으로 가중
  for (const w of new Set(wordTokens(query))) {
    if (title.includes(w)) score += 4;
    else if (tags.includes(w)) score += 3;
    else if (content.includes(w)) score += 1;
  }

  // ② 한글/영문 2-gram 겹침 — 제목+태그는 높게, 본문은 낮게(상한 둠)
  const titleTagBg = bigrams(doc.title + ' ' + doc.tags.join(' '));
  const contentBg = bigrams(doc.content);
  let sharedHead = 0, sharedBody = 0;
  for (const g of qBigrams) {
    if (titleTagBg.has(g)) sharedHead++;
    else if (contentBg.has(g)) sharedBody++;
  }
  score += sharedHead * 0.5;
  score += Math.min(sharedBody, 12) * 0.12;

  return score;
}

export type Retrieved = { doc: KnowledgeDoc; score: number };

// 질문과 가장 관련 있는 문서 top-k 반환 (점수 > 0 인 것만)
export function retrieve(query: string, k = 4): Retrieved[] {
  if (!query || !query.trim()) return [];
  const qBigrams = bigrams(query);
  return KNOWLEDGE
    .map(doc => ({ doc, score: scoreDoc(doc, query, qBigrams) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// 검색 결과를 시스템 프롬프트에 끼워 넣을 텍스트 블록으로 변환
export function formatKnowledge(docs: KnowledgeDoc[]): string {
  if (!docs.length) return '';
  return docs.map(d => `### ${d.title}\n${d.content}`).join('\n\n');
}

// id 로 문서 가져오기 (포트폴리오 페르소나의 기본 grounding 용)
export function docsByIds(ids: string[]): KnowledgeDoc[] {
  return ids
    .map(id => KNOWLEDGE.find(d => d.id === id))
    .filter((d): d is KnowledgeDoc => !!d);
}
