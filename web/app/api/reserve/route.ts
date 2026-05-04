import { NextRequest } from 'next/server';
import { createTask, type TaskInput } from '@/lib/task-manager';
import { executeReserve } from '@/lib/reserve-engine';

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<TaskInput>;
  const { token, date, openid, nickname, phone, preferred_time_slots } = body;

  if (!token || !date || !openid || !nickname || !phone || !preferred_time_slots?.length) {
    return Response.json({ error: '缺少必填字段' }, { status: 400 });
  }

  const taskId = crypto.randomUUID();
  createTask(taskId, { token, date, openid, nickname, phone, preferred_time_slots });

  // 异步启动，不 await — HTTP 立即返回 taskId
  executeReserve(taskId).catch(() => {
    // 错误已在 executeReserve 内部写入 task logs，此处静默
  });

  return Response.json({ taskId });
}
