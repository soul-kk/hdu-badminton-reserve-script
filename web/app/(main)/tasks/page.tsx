import { Suspense } from 'react';
import RecentTasksPanel from '@/components/RecentTasksPanel';

export default function TasksPage() {
  return (
    <Suspense>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">近期任务</h2>
        <RecentTasksPanel />
      </div>
    </Suspense>
  );
}
