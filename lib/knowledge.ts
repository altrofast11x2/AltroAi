// ───────────────────────────────────────────────────────────────────────────
//  AltroAi 지식 베이스 (RAG 자료)
//  챗봇이 "주인장 포트폴리오·학교 정보" 질문에 사실 기반으로 답하도록 참고하는 문서 모음.
//  lib/rag.ts 의 retrieve() 가 질문과 키워드가 겹치는 문서를 골라 시스템 프롬프트에 끼워 넣는다.
//
//  ⚠️ 아래 내용 일부는 작업 폴더의 단서로 추정해 채운 "예시"입니다.
//     실제 이름·학교·이력으로 자유롭게 수정하세요. (이 파일만 고치면 챗봇 답변이 바로 바뀝니다.)
// ───────────────────────────────────────────────────────────────────────────

export type KnowledgeDoc = {
  id: string;
  title: string;
  tags: string[];   // 검색 가중치를 높이는 키워드
  content: string;  // 실제로 모델에 전달되는 본문
};

export const KNOWLEDGE: KnowledgeDoc[] = [
  {
    id: 'owner',
    title: '주인장 소개',
    tags: ['주인장', '김현준', '소개', '프로필', '누구', '개발자', '학생'],
    content:
      '주인장의 이름은 김현준이며, 웹디자인·웹개발을 공부하는 고등학생입니다. ' +
      '프론트엔드 웹 개발과 UI 디자인에 관심이 많고, 직접 기획부터 구현·배포까지 해보는 풀스택 사이드 프로젝트(Altro 시리즈)를 만들며 실력을 키우고 있습니다. ' +
      '좋아하는 작업은 "쓸모 있는 작은 서비스를 끝까지 완성해 배포하는 것"입니다.',
  },
  {
    id: 'school',
    title: '학교 / 전공 정보',
    tags: ['학교', '전공', '학과', '웹디자인', '동아리', '특성화고', '디지털미디어'],
    content:
      '주인장은 웹디자인·개발 계열을 전공하며, 교내 "웹디자인개발 전공심화 동아리"에서 활동합니다. ' +
      '학번 단서(10306, 1학년 3반 6번)로 보아 1학년 재학 중입니다. ' +
      '수업과 동아리에서 HTML/CSS/JavaScript 기반 웹 제작, 디자인 툴(Photoshop 등), 그리고 웹 표준·접근성을 배우고 있습니다. ' +
      '(정확한 학교명/학과명은 lib/knowledge.ts 에서 수정하세요.)',
  },
  {
    id: 'awards',
    title: '대회 / 자격 이력',
    tags: ['대회', '기능경기대회', '수상', '자격증', '기능사', '공모전', '경진'],
    content:
      '주인장은 "웹디자인 및 개발" 종목으로 지방기능경기대회·전국기능경기대회를 준비하고 있습니다. ' +
      '웹디자인개발기능사 자격을 목표로 공부 중이며, 대한민국 고등학생 SW 개발 공모전 등 외부 대회에도 참가했습니다. ' +
      '대회 준비를 통해 제한 시간 안에 기획·디자인·코딩을 끝내는 실전 역량을 키웠습니다.',
  },
  {
    id: 'stack',
    title: '기술 스택',
    tags: ['기술', '스택', '언어', '프레임워크', 'next', 'react', 'firebase', 'typescript', '도구'],
    content:
      '주인장이 주로 사용하는 기술 스택입니다. ' +
      '프론트엔드: Next.js(App Router), React 19, TypeScript, 순수 CSS(디자인 시스템 직접 구축). ' +
      '백엔드/데이터: Firebase Realtime Database, Next.js 서버 라우트(API Routes). ' +
      '데이터 시각화: Chart.js. AI: Anthropic Claude API. ' +
      '배포: Vercel. 디자인: Photoshop. 버전관리: Git. ' +
      '특징은 외부 UI 라이브러리에 의존하지 않고 디자인 시스템(크림 + 와인레드 종이 질감 테마)을 직접 만든다는 점입니다.',
  },
  {
    id: 'altro-series',
    title: 'Altro 시리즈 개요',
    tags: ['altro', '시리즈', '프로젝트', '포트폴리오', '작업물', '만든것'],
    content:
      'Altro 시리즈는 주인장이 만든 풀스택 웹 앱 모음으로, 모두 같은 기술 스택(Next.js + React + Firebase + TypeScript)과 ' +
      '같은 디자인 시스템·통합 로그인(SHA-256 해시 호환)을 공유합니다. ' +
      '구성: ① AltroBoard(커뮤니티 게시판) ② AltroShop(중고/쇼핑) ③ AltroTodo(할 일 관리) ④ AltroDashBoard(데이터 대시보드) ⑤ AltroAi(AI 챗봇, 이 사이트). ' +
      '하나의 계정으로 모든 앱에 로그인할 수 있도록 설계했습니다.',
  },
  {
    id: 'altroboard',
    title: 'AltroBoard (게시판)',
    tags: ['altroboard', '게시판', '커뮤니티', '보드'],
    content:
      'AltroBoard는 글·댓글·좋아요·팔로우·스토리/쇼츠 등을 갖춘 커뮤니티 게시판 웹 앱입니다. ' +
      'Altro 패밀리의 첫 번째 프로젝트로, 통합 계정 시스템의 기준이 되었습니다.',
  },
  {
    id: 'altroshop',
    title: 'AltroShop (쇼핑)',
    tags: ['altroshop', '쇼핑', '중고', '상점', '거래'],
    content:
      'AltroShop은 상품 등록·장바구니·주문·코인(가상 재화) 충전·판매자 관리 기능을 갖춘 쇼핑/중고거래 웹 앱입니다. ' +
      '상품, 주문, 코인 요청, 신고 등을 Firebase 노드(shop_*)로 관리합니다.',
  },
  {
    id: 'altrotodo',
    title: 'AltroTodo (할 일 관리)',
    tags: ['altrotodo', '할일', '투두', 'todo', '일정', '카테고리'],
    content:
      'AltroTodo는 개인용 할 일 관리 앱으로, 카테고리·마감일·완료 처리·통계를 제공합니다. ' +
      '사용자별로 자기 할 일만 보이도록 todo_items/{uid} 구조로 데이터를 격리합니다.',
  },
  {
    id: 'altrodashboard',
    title: 'AltroDashBoard (데이터 대시보드)',
    tags: ['altrodashboard', '대시보드', '데이터', '차트', '시각화', 'csv'],
    content:
      'AltroDashBoard는 사용자가 체중·지출·공부시간 같은 데이터를 직접 입력하거나 CSV로 올려 ' +
      '막대/라인/원형 차트와 기간 필터(주·월·년)로 시각화하는 개인 데이터 대시보드입니다. ' +
      'Chart.js 를 사용하고, 날씨·환율·암호화폐 같은 공개 API 위젯도 제공합니다.',
  },
  {
    id: 'altroai',
    title: 'AltroAi (AI 챗봇, 이 사이트)',
    tags: ['altroai', 'ai', '챗봇', '인공지능', 'claude', '음성', 'rag', '이사이트'],
    content:
      'AltroAi는 Altro 시리즈의 다섯 번째이자 가장 도전적인 프로젝트로, 방문자가 질문하면 Claude API가 답하는 AI 챗봇 홈페이지입니다. ' +
      '핵심 기능: ① 4가지 페르소나(학습 도우미·취업 상담사·포트폴리오 가이드·만능 비서)를 시스템 프롬프트로 부여 ' +
      '② 로그인 사용자는 대화 내역이 Firebase에 저장되어 다시 볼 수 있음 ' +
      '③ 포트폴리오·학교 정보를 참고해 답하는 간단한 RAG ' +
      '④ Web Speech API 음성 입력/출력. ' +
      '보안: Anthropic API 키는 서버 전용 환경변수로 두고 모든 호출을 서버 라우트(/api/chat)로 프록시해 브라우저에 키가 노출되지 않게 설계했습니다.',
  },
  {
    id: 'career-goal',
    title: '진로 / 목표',
    tags: ['진로', '목표', '취업', '꿈', '미래', '프론트엔드'],
    content:
      '주인장의 목표는 실력 있는 프론트엔드/웹 개발자가 되는 것입니다. ' +
      '기능경기대회 입상과 관련 자격 취득을 단기 목표로, 사용자가 실제로 쓰는 제품을 만드는 개발자가 되는 것을 장기 목표로 삼고 있습니다. ' +
      'Altro 시리즈처럼 기획–디자인–개발–배포를 혼자서 끝까지 해내는 경험을 계속 쌓아가고 있습니다.',
  },
  {
    id: 'contact',
    title: '연락 / 링크',
    tags: ['연락', '링크', '깃허브', 'github', '포트폴리오주소', '배포', 'vercel'],
    content:
      'Altro 시리즈는 각각 Vercel로 배포되어 있습니다 (altroboard.vercel.app, altroshop.vercel.app, altrotodo.vercel.app 등). ' +
      '구체적인 연락처/GitHub 링크는 주인장이 lib/knowledge.ts 에서 직접 채워 넣을 수 있습니다.',
  },
];
