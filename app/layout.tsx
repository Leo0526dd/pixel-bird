import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "像素飞鸟",
  description: "A simple retro pixel flying game."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
