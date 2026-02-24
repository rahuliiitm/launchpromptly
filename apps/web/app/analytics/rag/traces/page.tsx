'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RagTracesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/observability/traces');
  }, [router]);
  return <div className="py-20 text-center text-gray-400">Redirecting...</div>;
}
