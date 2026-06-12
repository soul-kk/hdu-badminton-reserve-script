'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from '@/components/Header';

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [recentDot, setRecentDot] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [showRunningModal, setShowRunningModal] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (pathname === '/tasks') setRecentDot(false);
  }, [pathname]);

  useEffect(() => {
    const hasTaskId = new URLSearchParams(window.location.search).has('taskId');
    if (hasTaskId || checkedRef.current) return;
    checkedRef.current = true;

    const raw = localStorage.getItem('recent_task_ids');
    if (!raw) return;
    let ids: string[] = [];
    try { ids = JSON.parse(raw); } catch { return; }

    Promise.all(
      ids.map(async (taskId) => {
        try {
          const res = await fetch(`/api/task/${taskId}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { taskId, status: data.status as TaskStatus };
        } catch { return null; }
      })
    ).then((results) => {
      const active = results.find(
        (r) => r && (r.status === 'running' || r.status === 'pending')
      );
      if (active) {
        setRunningTaskId(active.taskId);
        setRecentDot(true);
        setShowRunningModal(true);
      }
    });
  }, []);

  function handleModalView() {
    setShowRunningModal(false);
    setRecentDot(false);
    if (runningTaskId) router.push(`/?taskId=${runningTaskId}`);
  }

  function handleModalDismiss() {
    setShowRunningModal(false);
  }

  return (
    <>
      <Header recentDot={recentDot} />

      {showRunningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏃</span>
              <div>
                <p className="font-semibold text-gray-800">有任务正在运行中</p>
                <p className="mt-1 text-sm text-gray-500">是否跳转到该任务查看进度？</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleModalDismiss}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleModalView}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                查看
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>
    </>
  );
}
