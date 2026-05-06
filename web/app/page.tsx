import { Suspense } from 'react';
import ReservePage from '@/components/ReservePage';

export default function Home() {
  return (
    <Suspense>
      <ReservePage />
    </Suspense>
  );
}

