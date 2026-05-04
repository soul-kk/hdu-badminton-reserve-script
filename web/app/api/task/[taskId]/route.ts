import { NextRequest } from 'next/server';
import { getTaskView, cancelTask } from '@/lib/task-manager';

// GET /api/task/[taskId] — 轮询任务状态和日志
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const view = getTaskView(taskId);
  if (!view) return Response.json({ error: '任务不存在' }, { status: 404 });
  return Response.json(view);
}

// DELETE /api/task/[taskId] — 取消任务
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const ok = cancelTask(taskId);
  if (!ok) return Response.json({ error: '任务不存在或已结束' }, { status: 400 });
  return Response.json({ ok: true });
}
