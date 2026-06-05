// 运维日志 — 将预约过程写入 <project-root>/logs/reserve_YYYY-MM-DD.log
// 纯文本格式，人类可读；每天一个文件，不影响现有内存日志。

import fs from 'fs';
import path from 'path';
import type { LogLevel } from './task-manager';

// 项目根目录（web/ 的上一级）
// process.cwd() 在 Next.js 运行时指向 web/ 目录
const LOGS_DIR = path.resolve(process.cwd(), '../logs');

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function logFilePath(): string {
  return path.join(LOGS_DIR, `reserve_${todayStr()}.log`);
}

function ensureLogsDir() {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// 写任务 header（任务开始时调用一次）
export function fileLogHeader(
  taskId: string,
  meta: { nickname: string; date: string; slots: string },
  createdAt: Date,
) {
  try {
    ensureLogsDir();
    const header =
      `\n# taskId: ${taskId}  nickname: ${meta.nickname}  date: ${meta.date}  slots: ${meta.slots}\n` +
      `# createdAt: ${createdAt.toISOString()}\n` +
      `---\n`;
    fs.appendFileSync(logFilePath(), header, 'utf8');
  } catch {
    // 日志写入失败不应影响主流程
  }
}

// 写单条日志（过滤倒计时消息）
export function fileLog(
  taskId: string,
  level: LogLevel,
  message: string,
) {
  // 过滤倒计时行：⏳ 还有 xx:xx:xx
  if (message.startsWith('⏳')) return;

  try {
    ensureLogsDir();
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level.padEnd(7)}] [${taskId.slice(0, 8)}] ${message}\n`;
    fs.appendFileSync(logFilePath(), line, 'utf8');
  } catch {
    // 日志写入失败不应影响主流程
  }
}

// 写任务结束分隔线
export function fileLogFooter(taskId: string, status: string) {
  try {
    ensureLogsDir();
    const ts = new Date().toISOString();
    const footer = `[${ts}] [end    ] [${taskId.slice(0, 8)}] 任务结束，状态: ${status}\n===\n`;
    fs.appendFileSync(logFilePath(), footer, 'utf8');
  } catch {
    // 日志写入失败不应影响主流程
  }
}
