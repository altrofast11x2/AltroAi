# AltroAi

**AI 챗봇 홈페이지** (Claude · Groq · Ollama 선택형). Altro 패밀리(Board · Shop · Todo · DashBoard)의 다섯 번째 앱.

- 🤖 4가지 **페르소나**(학습 도우미 · 취업 상담사 · 포트폴리오 가이드 · 만능 비서) — 시스템 프롬프트로 처리
- 💬 **스트리밍** 응답 (토큰이 실시간으로 흐름)
- 💾 로그인 사용자는 **대화 내역 저장 · 다시 보기**
- 📚 주인장 포트폴리오·학교 정보를 참고하는 **간단한 RAG**
- 🎙️ **음성 입력/출력** (Web Speech API)
- 🔒 **API 키 노출 방지** — 키는 서버 전용, 모든 호출은 `/api/chat` 프록시 경유
- 💸 **무료/유료 선택** — Groq(무료·클라우드) · Ollama(무료·로컬) · Claude(유료) 중 선택

자세한 설계는 [PLANNING.md](./PLANNING.md) 참고.

## 유료? 무료? — 제공자 선택

| 제공자 | 비용 | Vercel 배포 | 키 |
|--------|------|:----------:|----|
| **Groq** (OpenAI 호환) | **무료** (한도 내) | ✅ | 무료 키 |
| **Claude** (Anthropic) | 유료 (토큰당) | ✅ | 유료 키 |
| **Ollama** | 무료 | ❌ 로컬 전용 | 불필요 |

`AI_PROVIDER`(claude·openai·ollama)로 고르며, **미설정 시** `ANTHROPIC_API_KEY` → Claude, 아니면 `OPENAI_API_KEY` → Groq/OpenAI, 둘 다 없으면 Ollama 로 자동 선택됩니다.

> ⚠️ **Ollama 는 Vercel 에서 동작하지 않습니다** (당신 PC 의 localhost 라 Vercel 서버가 접근 불가).
> **Vercel 에 배포하면서 무료로 쓰려면 → Groq** 를 쓰세요. 아래 [Vercel 배포](#vercel-배포) 참고.

## 빠른 시작

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 — Firebase 값은 .env.local 에 이미 채워져 있음.
#    아래 둘 중 하나를 선택:

# 3) 개발 서버
npm run dev   # http://localhost:3000
```

### 무료로 쓰기 ① Groq — 클라우드, Vercel 배포 가능 (추천 💸)

```bash
# .env.local 에 추가 (https://console.groq.com 에서 무료 키 발급)
AI_PROVIDER=openai
OPENAI_API_KEY=gsk_...
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=llama-3.3-70b-versatile
```

### 무료로 쓰기 ② Ollama — 로컬 전용 (Vercel ✗)

```bash
# 1) 설치: https://ollama.com  (설치하면 ollama 서버가 자동 실행됨)
ollama pull llama3.2          # 모델 받기 (qwen2.5, gemma3 등 아무거나 가능)
# 2) .env.local 에서 키 전부 비워두기 → 자동으로 Ollama 사용
npm run dev
```

### 유료로 쓰기 — Claude

```bash
# .env.local 에 키 입력 (https://console.anthropic.com 에서 발급)
ANTHROPIC_API_KEY=sk-ant-...
```

> 아무것도 설정 안 해도 앱은 켜집니다. 답변 요청 시 상황에 맞는 안내가 표시됩니다.

## 🔒 API 키 보안 (이 프로젝트의 핵심)

| 장치 | 설명 |
|------|------|
| 서버 전용 env | `ANTHROPIC_API_KEY` 에는 **`NEXT_PUBLIC_` 를 붙이지 않음** → 브라우저로 전송/번들되지 않음 |
| 프록시 라우트 | 브라우저는 Anthropic 에 직접 요청하지 않고 항상 `app/api/chat/route.ts`(서버)만 호출 |
| 프롬프트 서버 보관 | 페르소나 시스템 프롬프트·RAG 자료는 서버에서 결정 (클라이언트는 `personaId` 만 전송) |
| 입력 검증 + 레이트리밋 | 메시지 수/길이 상한, IP당 분당 30회 제한 |
| git 제외 | `.env*.local`·`.env.production` 은 `.gitignore` 로 제외, `.env.example` 만 커밋 |

**Vercel 배포 시**: AI 키(`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`)는 코드에 넣지 말고
Vercel **Environment Variables** 에 등록하세요 (`NEXT_PUBLIC_` 없이). 자세한 절차는 아래 [Vercel 배포](#vercel-배포).

## 모델 변경

```bash
# .env.local
# Claude 사용 시 (기본 claude-opus-4-8). 비용 절감:
ANTHROPIC_MODEL=claude-haiku-4-5    # 빠르고 저렴 (또는 claude-sonnet-4-6)

# Ollama 사용 시 (기본 llama3.2). 받은 모델명으로:
OLLAMA_MODEL=qwen2.5
```

## Vercel 배포

> **먼저 제공자 결정** — Vercel(클라우드)에서는 **Ollama 를 쓸 수 없습니다**(로컬 전용).
> **무료로 배포하려면 Groq**(`AI_PROVIDER=openai`), 품질 우선이면 Claude(유료)를 쓰세요.

**1) GitHub 에 푸시**

```bash
git init && git add . && git commit -m "AltroAi"
git branch -M main
git remote add origin https://github.com/<본인>/altroai.git
git push -u origin main
```

**2) Vercel 에서 임포트** — [vercel.com/new](https://vercel.com/new) → 이 저장소 선택 → (프레임워크 Next.js 자동 인식) → 아직 Deploy 누르지 말고 **Environment Variables** 먼저 등록.

**3) 환경변수 등록** (Project → Settings → Environment Variables)

| 변수 | 값 | 비고 |
|------|----|------|
| `AI_PROVIDER` | `openai` (Groq) 또는 `claude` | 제공자 선택 |
| 🔒 `OPENAI_API_KEY` | `gsk_...` | Groq 무료 키 ([console.groq.com](https://console.groq.com)) |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` | Groq 사용 시 |
| `OPENAI_MODEL` | `llama-3.3-70b-versatile` | Groq 모델 |
| 🔒 `ANTHROPIC_API_KEY` | `sk-ant-...` | **Claude 쓸 때만** (Groq 쓰면 불필요) |
| `NEXT_PUBLIC_FIREBASE_*` | (7개) | 값은 `.env.local` 과 동일 (공개값) |

- 🔒 표시 = 비밀 키 → **절대 `NEXT_PUBLIC_` 붙이지 말 것** (그래야 브라우저에 노출 안 됨).
- `NEXT_PUBLIC_FIREBASE_*` 7개는 `.env.local` 의 값을 그대로 복사. (Firebase 웹 설정은 공개값이라 안전)
  - 💡 7개 입력이 번거로우면 `.gitignore` 에서 `.env.production` 한 줄을 지우고 커밋하면 자동 주입됩니다(공개값만 들어 있음).

**4) Deploy** 클릭 → 끝. (이후 `git push` 하면 자동 재배포)

**5) Firebase 규칙 게시 (한 번)** — 대화 저장/로그인이 되려면 `ai_*` 노드 규칙이 필요합니다.
Firebase 콘솔 → Realtime Database → **규칙(Rules)** 에 [`database.rules.json`](./database.rules.json) 내용을 붙여넣고 **게시**하세요.
(또는 `firebase deploy --only database`)

## 페르소나·자료 수정

- 페르소나 추가/수정: `lib/personas.ts`(표시 정보) + `app/api/chat/personaPrompts.ts`(행동 지침)
- 챗봇이 참고하는 주인장 자료(RAG): **`lib/knowledge.ts`** 를 본인 정보로 채워 넣으세요. (이름·학교·이력 등 — 예시값이 들어있습니다)

## 음성 기능

- **입력**: 입력창의 마이크 버튼 → 말하면 텍스트로 변환 (Chrome 등 `SpeechRecognition` 지원 브라우저)
- **출력**: "음성 답변 ON" 또는 각 답변의 "듣기" 버튼 → `SpeechSynthesis` 로 읽어줌
- 언어는 설정에서 변경 (한국어/English/日本語)

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · `@anthropic-ai/sdk` · Firebase Realtime DB · Web Speech API · Vercel

## 통합 로그인

AltroBoard · AltroShop · AltroTodo · AltroDashBoard 와 동일한 SHA-256 해시 포맷을 사용해
**하나의 계정으로 모든 Altro 앱에 로그인**할 수 있습니다.
