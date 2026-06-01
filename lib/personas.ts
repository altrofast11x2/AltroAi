// 페르소나 "메타데이터"만 (클라이언트 안전). 실제 시스템 프롬프트(행동 지침)는
// 서버 전용 모듈 app/api/chat/personaPrompts.ts 에만 존재한다 — 클라이언트는 personaId 만 보낸다.
// 이렇게 분리하면 ① 프롬프트 인젝션으로 페르소나를 바꿀 수 없고 ② 프롬프트가 번들에 노출되지 않는다.

export type Persona = {
  id: string;
  name: string;        // 표시 이름
  tagline: string;     // 한 줄 소개
  description: string; // 카드 설명
  greeting: string;    // 대화 시작 시 보여줄 첫 인사
  icon: string;        // Icons.tsx 키
  accent: string;      // 강조색 (CSS)
  samples: string[];   // 추천 질문
};

export const PERSONAS: Persona[] = [
  {
    id: 'study',
    name: '학습 도우미',
    tagline: '주인장의 공부를 돕는 든든한 튜터',
    description: '웹·프로그래밍·CS 개념을 눈높이에 맞춰 차근차근 설명해 줍니다. 모르는 건 예시와 함께!',
    greeting: '안녕하세요! 저는 주인장의 학습 도우미예요. 웹 개발이나 프로그래밍, 공부하다 막힌 부분이 있으면 편하게 물어보세요. 쉽게 풀어서 설명해 드릴게요.',
    icon: 'Book',
    accent: '#2f6df0',
    samples: [
      'flexbox와 grid의 차이가 뭐예요?',
      'JavaScript의 async/await 쉽게 설명해줘',
      'REST API가 뭔지 비유로 알려줘',
    ],
  },
  {
    id: 'career',
    name: '취업 상담사',
    tagline: '포트폴리오·이력서·면접을 함께 준비',
    description: '신입 개발자/웹디자이너 취업을 목표로 자기소개서, 포트폴리오 구성, 면접 답변을 코칭합니다.',
    greeting: '반가워요. 취업 상담사입니다. 포트폴리오 방향, 자기소개서, 면접 준비까지 — 어떤 고민이든 같이 정리해 봐요. 먼저 어떤 직무를 목표로 하고 있나요?',
    icon: 'Briefcase',
    accent: '#1a9e54',
    samples: [
      '웹 개발 신입 포트폴리오에 뭘 넣어야 할까?',
      '"본인의 강점" 면접 답변 예시 만들어줘',
      '기능경기대회 경험을 자소서에 녹이는 법',
    ],
  },
  {
    id: 'portfolio',
    name: '포트폴리오 가이드',
    tagline: '주인장과 그의 작업물을 안내',
    description: '주인장이 만든 Altro 시리즈 프로젝트, 학교, 기술 스택 등에 대해 자료를 참고해 정확히 답합니다.',
    greeting: '안녕하세요! 주인장의 포트폴리오 가이드예요. 어떤 프로젝트를 만들었는지, 어떤 기술을 쓰는지, 학교나 수상 이력까지 — 제가 알고 있는 자료를 바탕으로 안내해 드릴게요.',
    icon: 'Sparkles',
    accent: '#c0392b',
    samples: [
      'Altro 시리즈에는 어떤 프로젝트가 있어?',
      '주인장은 어떤 기술 스택을 쓰나요?',
      'AltroAi는 어떻게 만들어졌어?',
    ],
  },
  {
    id: 'general',
    name: '만능 비서',
    tagline: '무엇이든 물어보는 일반 도우미',
    description: '일정 정리, 글쓰기, 아이디어 brainstorming 등 일상적인 모든 질문에 도움을 줍니다.',
    greeting: '안녕하세요! 무엇이든 도와드리는 만능 비서예요. 궁금한 점, 정리하고 싶은 생각, 써야 할 글 — 무엇이든 말씀해 주세요.',
    icon: 'Robot',
    accent: '#d98a0b',
    samples: [
      '주말 공부 계획 짜는 거 도와줘',
      '이 문장을 더 자연스럽게 다듬어줘',
      '발표 주제 아이디어 5개만 줘',
    ],
  },
];

export const DEFAULT_PERSONA = 'study';

export function getPersona(id: string): Persona {
  return PERSONAS.find(p => p.id === id) || PERSONAS[0];
}
