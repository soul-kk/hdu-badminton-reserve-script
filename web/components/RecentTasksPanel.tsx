'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

type RecentTask = {
  taskId: string;
  status: TaskStatus | 'unknown';
  date?: string;
  start_time?: string;
  end_time?: string;
  venue_name?: string;
};

const STATUS_BADGE: Record<TaskStatus | 'unknown', { label: string; cls: string }> = {
  pending: { label: '等待中', cls: 'bg-yellow-100 text-yellow-800' },
  running: { label: '运行中', cls: 'bg-blue-100 text-blue-800' },
  success: { label: '预约成功', cls: 'bg-green-100 text-green-800' },
  failed: { label: '抢场失败', cls: 'bg-red-100 text-red-800' },
  cancelled: { label: '已取消', cls: 'bg-gray-100 text-gray-600' },
  unknown: { label: '已过期', cls: 'bg-gray-100 text-gray-400' },
};

export default function RecentTasksPanel() {
  const router = useRouter();
  const [tasks, setTasks] = useState<RecentTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    const raw = localStorage.getItem('recent_task_ids');
    if (!raw) { setLoading(false); return; }

    let ids: string[] = [];
    try { ids = JSON.parse(raw); } catch { setLoading(false); return; }

    const results = await Promise.all(
      ids.map(async (taskId): Promise<RecentTask> => {
        try {
          const res = await fetch(`/api/task/${taskId}`);
          if (!res.ok) return { taskId, status: 'unknown' };
          const data = await res.json();
          return {
            taskId,
            status: data.status ?? 'unknown',
            date: data.date,
            start_time: data.preferred_time_slots?.[0]?.start_time,
            end_time: data.preferred_time_slots?.[0]?.end_time,
            venue_name: data.result?.venue_name,
          };
        } catch {
          return { taskId, status: 'unknown' };
        }
      })
    );
    setTasks(results);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        加载中...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
        <span className="text-3xl">📭</span>
        <span>暂无近期任务，去提交一个吧！</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((t) => {
        const badge = STATUS_BADGE[t.status];
        return (
          <button
            key={t.taskId}
            onClick={() => router.push(`/?taskId=${t.taskId}`)}
            className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-gray-400 mb-1">{t.taskId.slice(0, 8)}</p>
                <p className="text-sm font-medium text-gray-800 truncate">
                  {t.date
                    ? `${t.date}${t.start_time && t.end_time ? `  ${t.start_time}–${t.end_time}` : ''}`
                    : '—'}
                </p>
                {t.venue_name && (
                  <p className="text-xs text-gray-500 mt-0.5">{t.venue_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                  {badge.label}
                </span>
                <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-sm">›</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
