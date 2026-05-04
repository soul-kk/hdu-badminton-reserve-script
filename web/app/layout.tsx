import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "羽毛球抢场",
  description: "HDU 综合馆羽毛球自动预约",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
