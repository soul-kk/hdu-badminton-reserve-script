'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ─── types ───────────────────────────────────────────────────────────────────

type TimeSlot = { start_time: string; end_time: string };

type LogEntry = { ts: string; level: 'info' | 'success' | 'error' | 'warn' | 'api'; message: string };

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

type TaskView = {
  status: TaskStatus;
  logs: LogEntry[];
  result?: {
    order_num: string;
    venue_name: string;
    site_id: number;
    order_date: string;
    start_time: string;
    end_time: string;
  };
};

// ─── constants ───────────────────────────────────────────────────────────────

const TIME_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '11:40',
  '13:20', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00',
];

const LOG_COLORS: Record<LogEntry['level'], string> = {
  info: 'text-gray-300',
  success: 'text-green-400',
  error: 'text-red-400',
  warn: 'text-yellow-400',
  api: 'text-gray-500',
};

const STATUS_BADGE: Record<TaskStatus, { label: string; cls: string }> = {
  pending: { label: '等待中', cls: 'bg-yellow-100 text-yellow-800' },
  running: { label: '运行中', cls: 'bg-blue-100 text-blue-800' },
  success: { label: '预约成功', cls: 'bg-green-100 text-green-800' },
  failed: { label: '抢场失败', cls: 'bg-red-100 text-red-800' },
  cancelled: { label: '已取消', cls: 'bg-gray-100 text-gray-600' },
};

// ─── sub-components ──────────────────────────────────────────────────────────

function SlotRow({
  slot,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  slot: TimeSlot;
  index: number;
  onChange: (i: number, field: keyof TimeSlot, val: string) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 w-4">{index + 1}.</span>
      <select
        value={slot.start_time}
        onChange={e => onChange(index, 'start_time', e.target.value)}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {TIME_OPTIONS.slice(0, -1).map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <span className="text-gray-400 text-sm">→</span>
      <select
        value={slot.end_time}
        onChange={e => onChange(index, 'end_time', e.target.value)}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {TIME_OPTIONS.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-500 transition-colors px-1"
          aria-label="删除"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ReservePage() {
  // form state
  const [token, setToken] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  });
  const [openid, setOpenid] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([
    { start_time: '16:00', end_time: '18:00' },
  ]);

  // task state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── polling ────────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/task/${id}`);
        if (!res.ok) return;
        const data: TaskView = await res.json();
        setTask(data);
        if (['success', 'failed', 'cancelled'].includes(data.status)) stopPolling();
      } catch { /* network hiccup, retry next tick */ }
    }, 1000);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task?.logs.length]);

  // ── handlers ───────────────────────────────────────────────────────────────

  function updateSlot(i: number, field: keyof TimeSlot, val: string) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  function addSlot() {
    setSlots(prev => [...prev, { start_time: '14:00', end_time: '16:00' }]);
  }

  function removeSlot(i: number) {
    setSlots(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    setTask(null);
    setTaskId(null);
    stopPolling();

    try {
      const res = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, date: date.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1-$2-$3'), openid, nickname, phone, preferred_time_slots: slots }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '提交失败'); return; }
      setTaskId(data.taskId);
      startPolling(data.taskId);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!taskId) return;
    await fetch(`/api/task/${taskId}`, { method: 'DELETE' });
    stopPolling();
    // 最后拉一次最新状态
    const res = await fetch(`/api/task/${taskId}`);
    if (res.ok) setTask(await res.json());
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const isActive = task && ['pending', 'running'].includes(task.status);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* header */}
        <h1 className="text-2xl font-bold text-gray-800 mb-6">🏸 羽毛球场，我抢抢抢抢抢！🤓</h1>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── LEFT: form ─────────────────────────────────────────────────── */}
          <div className="lg:w-96 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-4">预约信息</h2>
              <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Token</label>
                  <textarea
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="粘贴钉钉 JWT token"
                    rows={5}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">预约日期</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">学号</label>
                    <input
                      value={openid}
                      onChange={e => setOpenid(e.target.value)}
                      placeholder="24010133"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">姓名</label>
                    <input
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      placeholder="石宇奇"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">手机号</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="138xxxxxxxx"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-600">时间段优先级</label>
                    <button
                      type="button"
                      onClick={addSlot}
                      disabled={slots.length >= 4}
                      className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 transition-colors"
                    >
                      + 添加备选
                    </button>
                  </div>
                  <div className="space-y-2">
                    {slots.map((slot, i) => (
                      <SlotRow
                        key={i}
                        slot={slot}
                        index={i}
                        onChange={updateSlot}
                        onRemove={removeSlot}
                        canRemove={slots.length > 1}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">按顺序尝试，第一个成功即停止</p>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting || !!isActive}
                    className="flex-1 rounded-xl bg-blue-600 text-white font-medium py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? '提交中...' : isActive ? '运行中...' : '开始抢场 😈'}
                  </button>
                  {isActive && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-xl border border-red-300 text-red-600 font-medium px-4 py-2.5 text-sm hover:bg-red-50 transition-colors"
                    >
                      取消
                    </button>
                  )}
                </div>

              </form>
            </div>
          </div>

          {/* ── RIGHT: logs ────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-900 rounded-2xl shadow-sm border border-gray-800 p-5 h-96 lg:h-[calc(100vh-10rem)] flex flex-col">
              {/* log header */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h2 className="text-sm font-semibold text-gray-400">运行日志📝</h2>
                {task && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[task.status].cls}`}>
                    {STATUS_BADGE[task.status].label}
                  </span>
                )}
              </div>

              {/* log body */}
              <div className="log-scroll flex-1 overflow-y-auto min-h-0 font-mono text-xs leading-5 space-y-0.5">
                {!task && (
                  <p className="text-gray-600 italic">填写表单并提交后，日志将在此显示...</p>
                )}
                {task?.logs.map((log, i) => (
                  <div key={i} className={`${LOG_COLORS[log.level]} break-all`}>
                    <span className="text-gray-600 select-none mr-2">
                      {new Date(log.ts).toLocaleTimeString('zh-CN', { hour12: false })}
                    </span>
                    {log.message}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              {/* success result card */}
              {task?.status === 'success' && task.result && (
                <div className="mt-4 shrink-0 rounded-xl bg-green-900/40 border border-green-700 p-4">
                  <p className="text-green-400 font-semibold text-sm mb-1">预约成功！（记得去钉钉里邀请好友好友👯）</p>
                  <p className="text-green-300 text-xs">订单号：{task.result.order_num}</p>
                  <p className="text-green-300 text-xs">
                    {task.result.venue_name} {task.result.site_id}号场 ·{' '}
                    {task.result.order_date} {task.result.start_time}–{task.result.end_time}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
