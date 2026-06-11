import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '홈 클리닝 시스템',
  description: '체계적인 집안 청소 관리 앱',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
