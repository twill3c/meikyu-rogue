import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "meikyu-rogue — 迷宮ローグ",
  description: "シードから決定的に生成される 5 階層のターン制ローグライク",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
