import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "meikyu-rogue — 迷宮ローグ",
  description: "シードから決定的に生成される 5 階層のターン制ローグライク",
};

const FIXED_FOOTER_CSS = `/* fleet: fixed footer */
footer {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 9000;
  margin: 0; padding: 8px 16px;
  background: Canvas; color: CanvasText;
  border-top: 1px solid rgba(128,128,128,.35);
  backdrop-filter: blur(6px);
  max-height: 30vh; overflow-y: auto; text-align: center;
}
body { padding-bottom: 72px; }
@media (max-width: 640px) { body { padding-bottom: 96px; } }`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        {/* フリート共通: フッタを画面最下部に固定 */}
        <style dangerouslySetInnerHTML={{ __html: FIXED_FOOTER_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
