import { Suspense } from 'react';
import ReservePage from '@/components/ReservePage';
import AppShell from '@/components/Header';

export default function Home() {
  return (
    <Suspense>
      <AppShell>
        <ReservePage />
      </AppShell>
    </Suspense>
  );
}

