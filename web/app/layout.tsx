import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kk抢场",
  description: "HDU 羽毛球馆自动预约",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏸</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased flex flex-col">
        <main className="flex-1">{children}</main>
        <footer className="py-3 text-center text-xs text-gray-400">
          <a
            href="https://beian.miit.gov.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 transition-colors"
          >
            浙ICP备2026032879号-1
          </a>
        </footer>
      </body>
    </html>
  );
}
