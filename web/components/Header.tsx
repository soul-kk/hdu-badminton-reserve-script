'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { key: 'reserve', label: '预约', path: '/' },
  { key: 'recent', label: '近期任务', path: '/tasks' },
  { key: 'guide', label: '使用指南', path: '/guide' },
] as const;

interface HeaderProps {
  recentDot?: boolean;
}

export default function Header({ recentDot = false }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-12">
          <span className="font-bold text-gray-800 text-sm shrink-0">🏸 kk抢场</span>
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const isActive = tab.path === '/'
                ? pathname === '/'
                : pathname.startsWith(tab.path);
              return (
                <button
                  key={tab.key}
                  onClick={() => router.push(tab.path)}
                  className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                  {tab.label}
                  {tab.key === 'recent' && recentDot && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
