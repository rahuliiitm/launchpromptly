'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyticsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);
  return <div className="py-20 text-center text-gray-400">Redirecting...</div>;
}
