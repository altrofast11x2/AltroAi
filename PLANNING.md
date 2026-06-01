# AltroAi — AI 챗봇 홈페이지 계획서

> AltroBoard · AltroShop · AltroTodo · AltroDashBoard 에 이은 **Altro 패밀리 5번째이자 마지막 앱**.
> 방문자가 질문하면 **Claude API** 가 답하는 AI 챗봇 홈페이지. 페르소나, 대화 내역 저장, 포트폴리오 자료 참고(RAG), 음성 입출력을 모두 갖춘다.
> **설계 1원칙: API 키는 절대 브라우저에 노출하지 않는다.**

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | AltroAi |
| **목표** | 홈페이지에 AI 챗봇 인터페이스를 붙여 방문자가 질문하고, 페르소나가 부여된 Claude 가 답한다. 로그인 사용자는 대화가 저장되고, 포트폴리오/학교 자료를 참고(RAG)하며, 음성으로도 묻고 들을 수 있다. |
| **컨셉** | "주인장을 대신하는 AI" — 학습 도우미·취업 상담사·포트폴리오 가이드·만능 비서 4가지 페르소나 |
| **디자인** | Altro 패밀리 공용 (크림 배경 + 와인레드 액센트, 종이 질감, 다크모드, 이모지 미사용) |
| **계정** | AltroBoard/Shop/Todo/DashBoard 와 동일한 SHA-256 해시 → **통합 로그인** 호환 |

## 2. 기술 스택

| 분류 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router) | 형제 앱과 동일 |
| 언어 | TypeScript / React 19 | |
| **AI** | **Claude**(`@anthropic-ai/sdk`, 유료) · **OpenAI 호환**(Groq 무료 등) · **Ollama**(로컬 무료) | `AI_PROVIDER` 로 선택. Vercel 무료 배포는 Groq. 스트리밍 + (Claude) 프롬프트 캐싱 |
| DB | Firebase Realtime DB (`cozyboard-9fb1a`) | 공용 프로젝트를 `ai_*` 네임스페이스로 격리 |
| 비밀번호 | SHA-256 (`v1$<email>$<plain>`) | 통합 로그인용 |
| 세션 | LocalStorage (`altroai_user`) | 형제 앱과 동일 패턴 |
| RAG | 자체 키워드+한글 2-gram 검색 (`lib/rag.ts`) | 외부 벡터DB 없이 동작 |
| 음성 | Web Speech API (입력 `SpeechRecognition` / 출력 `SpeechSynthesis`) | 브라우저 내장 |
| 호스팅 | Vercel | `ANTHROPIC_API_KEY` 는 서버 시크릿으로 주입 |

## 3. 폴더 구조

```
AltroAi/
├── app/
│   ├── layout.tsx               루트 레이아웃 (테마 부트스트랩 + NavBar)
│   ├── page.tsx                 메인 챗봇 — 페르소나·스트리밍·기록·음성 총괄
│   ├── globals.css              공용 디자인 시스템 + 챗봇 전용 스타일
│   ├── login/page.tsx           로그인 / 회원가입 (통합 계정)
│   ├── history/page.tsx         대화 기록 보기 (로그인 사용자)
│   ├── settings/page.tsx        테마 · 음성 · 기본 페르소나 설정
│   ├── components/
│   │   ├── NavBar.tsx           상단 네비 + 햄버거 드로어
│   │   ├── Icons.tsx            공용 SVG 아이콘 (이모지 미사용)
│   │   ├── PersonaPicker.tsx    환영 화면: 페르소나 카드 + 추천 질문
│   │   ├── ChatMessage.tsx      말풍선 (마크다운 렌더 + 복사 + 듣기)
│   │   ├── Composer.tsx         입력창 + 마이크(음성입력) + 보내기/정지
│   │   └── Sidebar.tsx          대화 기록 사이드바
│   └── api/chat/
│       ├── route.ts             🔒 Claude API 보안 프록시 (스트리밍)
│       └── personaPrompts.ts    서버 전용 페르소나 시스템 프롬프트
├── lib/
│   ├── firebase.js              Firebase 초기화
│   ├── security.js              SHA-256 해시 (Altro 공용 포맷)
│   ├── ai.js                    CRUD (users / conversations / messages / settings)
│   ├── personas.ts              페르소나 메타데이터 (클라이언트 안전)
│   ├── knowledge.ts             RAG 지식 베이스 (주인장 공개 정보)
│   ├── rag.ts                   키워드+2-gram 검색 retrieve()
│   ├── speech.js                Web Speech API 래퍼
│   └── markdown.ts              초경량 마크다운→HTML (XSS 안전)
├── database.rules.json          Firebase 규칙 (ai_* 노드 추가)
├── .env.local / .env.production / .env.example
├── next.config.ts · tsconfig.json · package.json · firebase.json
└── PLANNING.md · README.md
```

## 4. 페르소나 정의 (시스템 프롬프트로 처리)

페르소나는 **메타데이터(클라이언트)** 와 **시스템 프롬프트(서버)** 로 분리한다.
클라이언트는 `personaId`(키)만 보내고, 실제 행동 지침은 서버 `personaPrompts.ts` 가 결정한다.
→ 사용자가 임의 시스템 프롬프트를 주입해 페르소나를 바꿀 수 없다(prompt injection 방지).

| id | 이름 | 역할(시스템 프롬프트 요지) |
|----|------|---------------------------|
| `study` | 학습 도우미 | 웹·프로그래밍·CS 를 쉬운 비유와 예시로 가르치는 친절한 튜터 |
| `career` | 취업 상담사 | 포트폴리오·자소서·면접을 구체적으로 코칭하는 상담사 |
| `portfolio` | 포트폴리오 가이드 | 주인장의 프로젝트·학교·기술을 **참고 자료(RAG)** 근거로 안내 |
| `general` | 만능 비서 | 글쓰기·아이디어·일상 질문 전반 |

공통 지침: 한국어 기본 · 핵심부터 간결히 · 모르는 사실/개인정보는 지어내지 않기 · 부적절 요청 거절.

## 5. API 연동 구조 — **🔒 API 노출 방지가 핵심**

```
[브라우저]  ──POST /api/chat (personaId + messages)──▶  [Next.js 서버 라우트]  ──┬─ Claude API (@anthropic-ai/sdk, 유료)
   ▲                                                          │              └─ Ollama  (localhost:11434, 무료)
   └──────────── text/plain 스트림 (토큰) ◀───────────────────┘  · 서버 전용 키 · 페르소나 프롬프트 + RAG 주입
```

> 제공자는 `AI_PROVIDER`(claude|ollama)로 고르며, 미설정 시 `ANTHROPIC_API_KEY` 유무로 자동 결정. 두 경로 모두 브라우저는 서버 라우트만 호출(직접 호출 없음).

키 노출을 막는 구체적 장치:
1. **`ANTHROPIC_API_KEY` 는 `NEXT_PUBLIC_` 없는 서버 전용 환경변수.** 서버 라우트에서만 읽혀 클라이언트 번들/네트워크 응답에 절대 포함되지 않는다.
2. **브라우저는 Anthropic 에 직접 요청하지 않는다.** 항상 `/api/chat` 프록시만 호출한다.
3. **페르소나 시스템 프롬프트·RAG 자료는 서버에서 결정.** 클라이언트는 `personaId` 만 전송.
4. **입력 검증** — role/내용 정제, 메시지 수·길이 상한, 마지막은 user 메시지 강제.
5. **레이트리밋** — IP당 분당 30회(인메모리). 오남용/비용 폭주 방지.
6. **`.gitignore`** 로 `.env*.local`·`.env.production` 제외, `.env.example` 만 커밋.
7. 오류 메시지에 키 등 민감정보를 절대 싣지 않는다.
8. **스트리밍** — SDK `messages.stream()` → `ReadableStream` 으로 토큰을 즉시 전달(빠른 체감).
9. **프롬프트 캐싱** — 안정적인 시스템 블록(기본 지침+페르소나)에 `cache_control` 적용해 반복 호출 비용/지연 절감.

## 6. 화면 설계

- **메인 `/`** — 좌측 대화 기록 사이드바(로그인 시) + 우측 채팅. 상단에 페르소나 전환 pill.
  - 빈 상태: 페르소나 카드 4개 + 추천 질문 칩 (환영 화면)
  - 대화 중: 말풍선 스레드(스트리밍 타이핑) + 하단 입력창(마이크/보내기/정지) + 음성답변 토글
- **`/history`** — 지난 대화 카드 목록. 클릭 시 `/?c=<id>` 로 이어보기, 삭제 가능.
- **`/login`** — 로그인/회원가입 (통합 계정).
- **`/settings`** — 테마(라이트/다크/시스템) · 음성(자동읽기/언어/미리듣기) · 기본 페르소나.

## 7. 데이터 모델 (Firebase, `ai_` 프리픽스)

| 노드 | 구조 | 인덱스 |
|------|------|--------|
| `ai_users/{uid}` | `{ name, email, password(sha256), createdAt }` | `email`, `createdAt` |
| `ai_conversations/{uid}/{convId}` | `{ title, personaId, createdAt, updatedAt, lastMessage, messageCount }` | `updatedAt`, `createdAt`, `personaId` |
| `ai_messages/{uid}/{convId}/{msgId}` | `{ role:'user'|'assistant', content, createdAt }` | `createdAt` |
| `ai_settings/{uid}` | `{ theme, voiceOutput, voiceLang, defaultPersona }` | — |

> 대화 내역은 사용자별(`{uid}`)로 격리 저장 → 본인 대화만 조회. 비로그인 방문자는 메모리상으로만 대화(저장 안 됨).

## 8. 업데이트 분할(최대 4회)과 구현 현황

과제의 4단계 분할을 모두 구현 완료.

| 단계 | 내용 | 구현 |
|------|------|------|
| **1단계 — 계획서** | 페르소나 정의, API 연동 구조, 화면 설계 | ✅ 본 PLANNING.md |
| **2단계 — 대화 저장·조회** | 대화 내역 DB 저장 + 로그인 사용자 본인 대화 다시 보기 | ✅ `ai_conversations`/`ai_messages`, 사이드바 + `/history` |
| **3단계 — 페르소나 강화/자료 참고** | 페르소나 시스템 프롬프트 + 간단한 RAG | ✅ `personaPrompts.ts` + `knowledge.ts`/`rag.ts` |
| **4단계 — 음성 입출력** | Web Speech API 입력/출력 | ✅ `speech.js` + 마이크 입력 + 음성 답변 |

## 9. 향후 개선 아이디어
- RAG 를 임베딩 기반 벡터 검색으로 고도화
- 대화 제목 자동 요약(첫 응답 기반)
- 레이트리밋을 Upstash 등 공유 저장소로 이전 (서버리스 다중 인스턴스 대응)
