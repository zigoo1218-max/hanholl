import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한홀중학교 3D 성과발표회",
  description: "서로를 밝히며 함께 성장하는 한홀, 학생 영상 작품 전시관",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
