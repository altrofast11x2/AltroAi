// ───────────────────────────────────────────────────────────────────────────
//  /api/chat — AI 보안 프록시 (스트리밍). 세 가지 제공자 지원:
//    · claude  — Anthropic Claude API (유료, 키 필요)            [Vercel ○]
//    · openai  — OpenAI 호환 API (Groq/OpenRouter/OpenAI 등)     [Vercel ○]  ★무료(Groq)
//    · ollama  — 로컬 Ollama (무료, 키 불필요)                    [Vercel ✗ 로컬 전용]
//
//  제공자 선택: AI_PROVIDER(claude|openai|ollama). 미설정 시
//    ANTHROPIC_API_KEY → claude, 아니면 OPENAI_API_KEY → openai, 둘 다 없으면 ollama.
//
//  ⚠️ 보안 — 공통: 비밀 키는 NEXT_PUBLIC_ 없는 서버 전용 변수. 서버에서만 읽힘.
//   · 브라우저는 AI 서버에 직접 요청하지 않고 항상 이 라우트만 호출.
//   · 페르소나 시스템 프롬프트·RAG 자료는 서버에서 결정(클라이언트는 personaId 만 전송).
//   · 입력 검증 + 간단한 IP 레이트리밋.
// ───────────────────────────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk';
import { getStableSystem, KNOWLEDGE_INSTRUCTION } from './personaPrompts';
import { retrieve, formatKnowledge, docsByIds } from '@/lib/rag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// 입력 제한 (오남용/비용 폭주 방지)
const MAX_MESSAGES = 24;
const MAX_CHARS_PER_MSG = 8000;
const MAX_TOTAL_CHARS = 24000;
const MAX_OUTPUT_TOKENS = 2048;

type Provider = 'claude' | 'openai' | 'ollama';
function pickProvider(): Provider {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'ollama' || p === 'claude' || p === 'openai') return p;
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'ollama';
}

// ── 간단한 인메모리 레이트리밋 (IP당 분당 N회) ──────────────────────────────
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const rlHits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rlHits.get(ip) || []).filter(t => now - t < RL_WINDOW_MS);
  arr.push(now);
  rlHits.set(ip, arr);
  if (rlHits.size > 5000) {
    for (const [k, v] of rlHits) {
      if (!v.length || now - v[v.length - 1] > RL_WINDOW_MS) rlHits.delete(k);
    }
  }
  return arr.length > RL_MAX;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

type ChatMsg = { role: 'user' | 'assistant'; content: string };
function sanitizeMessages(raw: any): ChatMsg[] {
  if (!Array.isArray(raw)) return [];
  let total = 0;
  const out: ChatMsg[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    const role = m?.role === 'assistant' ? 'assistant' : 'user';
    let content = typeof m?.content === 'string' ? m.content : '';
    content = content.slice(0, MAX_CHARS_PER_MSG).trim();
    if (!content) continue;
    total += content.length;
    if (total > MAX_TOTAL_CHARS) break;
    out.push({ role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

const streamHeaders = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Accel-Buffering': 'no',
};

// ── 건강 체크 — UI 가 제공자/설정 여부를 알 수 있게 함 (키 값은 노출하지 않음) ──
export async function GET() {
  const provider = pickProvider();
  if (provider === 'claude') {
    return Response.json({ ok: true, provider: 'claude', configured: !!process.env.ANTHROPIC_API_KEY, model: ANTHROPIC_MODEL });
  }
  if (provider === 'openai') {
    return Response.json({ ok: true, provider: 'openai', configured: !!process.env.OPENAI_API_KEY, model: OPENAI_MODEL });
  }
  // ollama: 로컬 서버가 떠 있는지 빠르게 확인
  let configured = false;
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(1500) });
    configured = r.ok;
  } catch {}
  return Response.json({ ok: true, provider: 'ollama', configured, model: OLLAMA_MODEL });
}

export async function POST(req: Request) {
  const provider = pickProvider();

  if (rateLimited(clientIp(req))) {
    return jsonError('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
  }
  if (provider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
    return jsonError('AI 응답 기능이 설정되지 않았습니다. ANTHROPIC_API_KEY 를 등록하거나, 무료인 Groq(OPENAI 호환)/Ollama 로 전환하세요.', 503);
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    return jsonError('AI 키가 설정되지 않았습니다. OPENAI_API_KEY 를 등록해 주세요. (Groq 등 무료 키 사용 가능)', 503);
  }

  let body: any;
  try { body = await req.json(); } catch { return jsonError('잘못된 요청 형식입니다.', 400); }

  const personaId = typeof body?.personaId === 'string' ? body.personaId : 'study';
  const messages = sanitizeMessages(body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return jsonError('보낼 메시지가 없습니다.', 400);
  }

  // RAG
  const lastUser = messages[messages.length - 1].content;
  let hits = retrieve(lastUser, 4).map(h => h.doc);
  if (personaId === 'portfolio' && hits.length === 0) hits = docsByIds(['owner', 'altro-series']);
  const knowledgeText = formatKnowledge(hits);

  const stable = getStableSystem(personaId);
  const knowledgeBlock = knowledgeText ? `${KNOWLEDGE_INSTRUCTION}\n\n${knowledgeText}` : '';

  if (provider === 'claude') return streamClaude(stable, knowledgeBlock, messages);

  // openai / ollama 는 단일 system 메시지로 합쳐 전달
  const systemText = `${stable}${knowledgeBlock ? '\n\n' + knowledgeBlock : ''}`;
  return provider === 'openai'
    ? streamOpenAI(systemText, messages)
    : streamOllama(systemText, messages);
}

// ── Claude (Anthropic SDK, 스트리밍 + 프롬프트 캐싱) ─────────────────────────
function streamClaude(stable: string, knowledgeBlock: string, messages: ChatMsg[]) {
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: stable, cache_control: { type: 'ephemeral' } },
  ];
  if (knowledgeBlock) system.push({ type: 'text', text: knowledgeBlock });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: ANTHROPIC_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          thinking: { type: 'adaptive' } as unknown as Anthropic.ThinkingConfigParam,
          messages,
        });
        stream.on('text', (delta: string) => { try { controller.enqueue(encoder.encode(delta)); } catch {} });
        await stream.finalMessage();
        controller.close();
      } catch (err: any) {
        let msg = '\n\n⚠️ 답변 생성 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
        if (err instanceof Anthropic.RateLimitError) msg = '\n\n⚠️ 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.';
        else if (err instanceof Anthropic.AuthenticationError) msg = '\n\n⚠️ AI 인증에 실패했어요. 관리자에게 문의해 주세요.';
        console.error('[AltroAi] Claude 오류:', err?.status || '', err?.message || err);
        try { controller.enqueue(encoder.encode(msg)); } catch {}
        controller.close();
      }
    },
  });
  return new Response(readable, { headers: streamHeaders });
}

// ── OpenAI 호환 (Groq/OpenRouter/OpenAI…) — /chat/completions SSE 스트림 ──────
function streamOpenAI(systemText: string, messages: ChatMsg[]) {
  const encoder = new TextEncoder();
  const payload = {
    model: OPENAI_MODEL,
    messages: [{ role: 'system', content: systemText }, ...messages],
    stream: true,
    max_tokens: MAX_OUTPUT_TOKENS,
  };

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => '');
          let hint = `AI 응답 오류 (${res.status}).`;
          if (res.status === 401) hint = 'API 키가 올바르지 않아요. OPENAI_API_KEY 를 확인해 주세요.';
          else if (res.status === 404 || /model/i.test(t)) hint = `모델 \`${OPENAI_MODEL}\` 을(를) 찾을 수 없어요. OPENAI_MODEL 을 확인해 주세요.`;
          else if (res.status === 429) hint = '사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.';
          controller.enqueue(encoder.encode('⚠️ ' + hint));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let finished = false;
        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          // SSE: "data: {json}" 줄 단위. "data: [DONE]" 로 종료.
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line || !line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') { finished = true; break; }
            try {
              const obj = JSON.parse(data);
              const piece = obj?.choices?.[0]?.delta?.content || '';
              if (piece) controller.enqueue(encoder.encode(piece));
            } catch {}
          }
        }
        controller.close();
      } catch (err: any) {
        console.error('[AltroAi] OpenAI 호환 오류:', err?.message || err);
        controller.enqueue(encoder.encode('\n\n⚠️ AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'));
        controller.close();
      }
    },
  });
  return new Response(readable, { headers: streamHeaders });
}

// ── Ollama (로컬, 무료, 키 불필요) — /api/chat NDJSON 스트림 ──────────────────
function streamOllama(systemText: string, messages: ChatMsg[]) {
  const encoder = new TextEncoder();
  const ollamaMessages = [{ role: 'system', content: systemText }, ...messages];

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: ollamaMessages,
            stream: true,
            options: { num_predict: MAX_OUTPUT_TOKENS },
          }),
        });

        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => '');
          const hint = /not found|no such model/i.test(t)
            ? `모델 \`${OLLAMA_MODEL}\` 이(가) 없어요. 터미널에서 \`ollama pull ${OLLAMA_MODEL}\` 를 실행해 주세요.`
            : `Ollama 응답 오류 (${res.status}).`;
          controller.enqueue(encoder.encode(`⚠️ ${hint}`));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            try {
              const obj = JSON.parse(line);
              const piece = obj?.message?.content || '';
              if (piece) controller.enqueue(encoder.encode(piece));
            } catch {}
          }
        }
        controller.close();
      } catch (err: any) {
        console.error('[AltroAi] Ollama 오류:', err?.message || err);
        controller.enqueue(encoder.encode(
          '⚠️ Ollama 서버에 연결하지 못했어요. 터미널에서 `ollama serve` 가 실행 중인지 확인해 주세요. (무료 로컬 AI)',
        ));
        controller.close();
      }
    },
  });
  return new Response(readable, { headers: streamHeaders });
}
