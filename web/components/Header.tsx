'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type TabKey = 'reserve' | 'recent' | 'guide';

// ─── types ───────────────────────────────────────────────────────────────────

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

// ─── Recent Tasks Panel ───────────────────────────────────────────────────────

function RecentTasksPanel({
  onNavigateToReserve,
  currentTaskId,
  onTasksLoaded,
}: {
  onNavigateToReserve: (taskId: string) => void;
  currentTaskId: string | null;
  onTasksLoaded?: (tasks: RecentTask[]) => void;
}) {
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
    onTasksLoaded?.(results);
  }, [onTasksLoaded]);

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
            onClick={() => onNavigateToReserve(t.taskId)}
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
                {t.taskId === currentTaskId && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    当前任务
                  </span>
                )}
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

// ─── Guide Panel ─────────────────────────────────────────────────────────────

type DeviceTab = 'windows' | 'macos' | 'ios' | 'android';

const DEVICE_TABS: { key: DeviceTab; label: string; icon: string }[] = [
  { key: 'windows', label: 'Windows', icon: '🪟' },
  { key: 'macos', label: 'macOS', icon: '🍎' },
  { key: 'ios', label: 'iOS', icon: '📱' },
  { key: 'android', label: 'Android', icon: '🤖' },
];

function TokenGuide() {
  const [activeDevice, setActiveDevice] = useState<DeviceTab>('windows');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {DEVICE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveDevice(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${activeDevice === tab.key
              ? 'bg-white text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-5 py-4 text-sm text-gray-700 space-y-2.5">
        {activeDevice === 'windows' && (
          <ol className="space-y-2">
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">1</span><span><a href="/downloads/get_token_win.zip" className="text-blue-600 underline underline-offset-2">点击下载windows抓token工具</a>，然后解压</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">2</span><span>首次运行时，需要<strong>右键 → 以管理员身份运行</strong></span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">3</span><span>根据提示拿到 token</span></li>
          </ol>
        )}
        {activeDevice === 'macos' && (
          <ol className="space-y-2">
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">1</span><span><a href="/downloads/get_token_mac.zip" className="text-blue-600 underline underline-offset-2">点击下载macOS抓token工具</a>，然后解压</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">2</span><span>直接双击打开</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">3</span><span>根据提示拿到 token</span></li>
          </ol>
        )}
        {activeDevice === 'ios' && (
          <div className="flex items-start gap-3 py-1">
            <span className="text-2xl">📱</span>
            <p className="text-gray-500 leading-relaxed">iPhone 上需要一些额外配置，体验不佳，建议使用电脑。<br />如果确实需要，请直接联系 kk 获取方案。</p>
          </div>
        )}
        {activeDevice === 'android' && (
          <div className="flex items-start gap-3 py-1">
            <span className="text-2xl">🤖</span>
            <p className="text-gray-500 leading-relaxed">安卓手机暂无使用方案，建议使用电脑。</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GuidePanel() {
  return (
    <div className="space-y-6">
      {/* Step 1 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
          抓取 Token
        </h3>
        <TokenGuide />
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <span className="shrink-0 text-base">⏰</span>
          <p><strong>重要：</strong>Token 有效期只有 <strong>5 小时</strong>！请<strong>下午 3 点之后</strong>再抓取 token，否则到晚上 8 点抢场时 token 已过期，会导致预约失败。</p>
        </div>
      </section>

      {/* Step 2 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
          提交预约
        </h3>
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-700 space-y-2">
          <p>打开预约界面，将 token 完整粘贴到输入框。</p>
          <p>填好日期和时间段，点击开启任务即可。</p>
        </div>
      </section>

      {/* Step 3 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">3</span>
          查看结果 &amp; 邀请好友
        </h3>
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-700 space-y-2">
          <p>晚上 8 点记得回来查看结果。</p>
          <p className="text-red-600 font-medium">⚠ 如果预约成功，需要在 10 分钟之内去钉钉里手动邀请好友！</p>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">常见问题</h3>
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 text-sm">
          <details className="group px-5 py-3">
            <summary className="cursor-pointer font-medium text-gray-700 list-none flex items-center justify-between">
              token 是什么？
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <p className="mt-2 text-gray-500 leading-relaxed">是预约系统中你的用户凭证，相当于你的登录身份标识。有效的 token 是预约成功的前提，token 过期或无效都会导致抢场失败。</p>
          </details>
          <details className="group px-5 py-3">
            <summary className="cursor-pointer font-medium text-gray-700 list-none flex items-center justify-between">
              为什么会预约失败？
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <p className="mt-2 text-gray-500 leading-relaxed">常见原因：<strong>403</strong> 是服务器限流，<strong>502/500</strong> 是服务器错误，这两种情况系统会自动重试。<strong>401</strong> 是 token 无效或已过期，会直接失败，请确保下午 3 点后再抓取 token。</p>
          </details>
          <details className="group px-5 py-3">
            <summary className="cursor-pointer font-medium text-gray-700 list-none flex items-center justify-between">
              需要一直开着预约网页吗？
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <p className="mt-2 text-gray-500 leading-relaxed">不需要。任务跑在服务器上，开启后可以关掉窗口。8 点后回来查看结果即可，也可在【近期任务】中找到历史记录。</p>
          </details>
          <details className="group px-5 py-3">
            <summary className="cursor-pointer font-medium text-gray-700 list-none flex items-center justify-between">
              找不到钉钉里的「场馆速约」？
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <p className="mt-2 text-gray-500 leading-relaxed">先把企业/组织切换到【杭州电子科技大学】（杭电钉）→ 左侧点击【工作台】→ 右上角搜索「场馆速约」。</p>
          </details>
        </div>
      </section>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'reserve', label: '预约' },
  { key: 'recent', label: '近期任务' },
  { key: 'guide', label: '使用指南' },
];

interface HeaderProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  recentDot?: boolean;
}

export function Header({ activeTab, onTabChange, recentDot = false }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-12">
          <span className="font-bold text-gray-800 text-sm shrink-0">🏸 kk抢场</span>
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                {tab.label}
                {tab.key === 'recent' && recentDot && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── AppShell — wraps header + content ───────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode; // reserve tab content
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTaskId = searchParams.get('taskId');

  const [activeTab, setActiveTab] = useState<TabKey>('reserve');
  const [recentDot, setRecentDot] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [showRunningModal, setShowRunningModal] = useState(false);
  const checkedRef = useRef(false);

  // On mount (no taskId in URL): scan localStorage for running/pending tasks
  useEffect(() => {
    if (currentTaskId || checkedRef.current) return;
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
  }, [currentTaskId]);

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    if (tab === 'recent') setRecentDot(false);
  }

  function handleNavigateToReserve(taskId: string) {
    router.push(`/?taskId=${taskId}`);
    setActiveTab('reserve');
  }

  function handleModalView() {
    setShowRunningModal(false);
    setRecentDot(false);
    if (runningTaskId) handleNavigateToReserve(runningTaskId);
  }

  function handleModalDismiss() {
    setShowRunningModal(false);
  }

  return (
    <>
      <Header activeTab={activeTab} onTabChange={handleTabChange} recentDot={recentDot} />

      {/* Running task modal */}
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

      {activeTab === 'reserve' && children}
      {activeTab === 'recent' && (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">近期任务</h2>
          <RecentTasksPanel
            onNavigateToReserve={handleNavigateToReserve}
            currentTaskId={currentTaskId}
          />
        </div>
      )}
      {activeTab === 'guide' && (
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">不要和别人说！我们偷偷用！</h2>
          <GuidePanel />
        </div>
      )}
    </>
  );
}
