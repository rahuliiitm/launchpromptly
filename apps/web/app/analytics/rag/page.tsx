'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect old /analytics/rag to /observability
export default function RagRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/observability');
  }, [router]);
  return <div className="py-20 text-center text-gray-400">Redirecting...</div>;
}
