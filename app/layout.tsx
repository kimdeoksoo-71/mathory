import './globals.css';
import DialogHost from '../components/ui/DialogHost';

export const metadata = {
  title: 'Mathory — Write the logic. Preserve the insight.',
  description: '수학 문제 편집·관리 웹 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Noto+Sans+KR:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {children}
        {/* 개선묶음 M2 A — 자체 다이얼로그(alert/confirm/prompt 대체)의 유일한 호스트.
            여기(루트 레이아웃)에 두어야 admin 라우트·공개 뷰어까지 전부 커버된다.
            layout은 서버 컴포넌트지만 DialogHost가 'use client'라 그대로 중첩된다. */}
        <DialogHost />
      </body>
    </html>
  );
}
