import './globals.css';
import { cookies } from 'next/headers';
import NavBar from './components/NavBar';
import ThemeSync from './components/ThemeSync';

export const metadata = {
  title: 'AltroAi — 주인장의 AI 챗봇',
  description: 'AltroAi — Claude API 또는 무료 로컬 Ollama 기반 AI 챗봇. 페르소나 선택, 대화 내역 저장, 포트폴리오 자료 참고(RAG), 음성 입출력을 지원하는 Altro 패밀리의 다섯 번째 앱',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 페인트 전에 테마를 적용해 깜빡임(FOUC) 방지 — 쿠키로 서버에서 미리 결정.
  const dark = (await cookies()).get('altroai_theme')?.value === 'dark';

  return (
    <html lang="ko" data-theme={dark ? 'dark' : undefined} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeSync />
        <NavBar />
        {children}
        <footer className="bj-footer">
          AltroAi — Claude / Ollama 기반 AI 챗봇<br />
          AltroBoard · AltroShop · AltroTodo · AltroDashBoard 통합 계정으로 로그인됩니다
        </footer>
      </body>
    </html>
  );
}
