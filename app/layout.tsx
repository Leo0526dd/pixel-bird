import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "像素飞鸟",
  description: "A simple retro pixel flying game."
};

export const viewport: Viewport = {
  themeColor: "#4aa3d8"
};

const basePath = process.env.GITHUB_PAGES === "true" ? "/pixel-bird" : "";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href={`${basePath}/manifest.webmanifest`} />
        <meta name="theme-color" content="#4aa3d8" />
      </head>
      <body>{children}</body>
    </html>
  );
}
