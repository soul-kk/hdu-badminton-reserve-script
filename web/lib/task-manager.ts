// 内存任务存储 — MVP 阶段，进程重启后任务丢失
// 后续可替换为 Redis / PostgreSQL

export type LogLevel = 'info' | 'success' | 'error' | 'warn' | 'api';

export type LogEntry = {
  ts: string;       // ISO timestamp
  level: LogLevel;
  message: string;
};

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type TimeSlot = {
  start_time: string;
  end_time: string;
};

export type TaskInput = {
  token: string;
  date: string;
  openid: string;
  nickname: string;
  phone: string;
  preferred_time_slots: TimeSlot[];
};

export type Task = TaskInput & {
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
  createdAt: Date;
  abortController: AbortController;
};

// 模块级单例 Map — Next.js dev 模式下 HMR 会重置，生产环境稳定
const tasks = new Map<string, Task>();

export function createTask(id: string, input: TaskInput): Task {
  const task: Task = {
    ...input,
    status: 'pending',
    logs: [],
    createdAt: new Date(),
    abortController: new AbortController(),
  };
  tasks.set(id, task);
  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function addLog(id: string, level: LogLevel, message: string) {
  const task = tasks.get(id);
  if (!task) return;
  task.logs.push({ ts: new Date().toISOString(), level, message });
}

export function updateStatus(id: string, status: TaskStatus, result?: Task['result']) {
  const task = tasks.get(id);
  if (!task) return;
  task.status = status;
  if (result !== undefined) task.result = result;
}

export function cancelTask(id: string) {
  const task = tasks.get(id);
  if (!task) return false;
  if (task.status !== 'pending' && task.status !== 'running') return false;
  task.abortController.abort();
  updateStatus(id, 'cancelled');
  addLog(id, 'warn', '任务已被用户手动取消');
  return true;
}

// 返回给前端的安全视图（不暴露 abortController）
export function getTaskView(id: string) {
  const task = tasks.get(id);
  if (!task) return null;
  const { abortController: _, ...view } = task;
  return view;
}
