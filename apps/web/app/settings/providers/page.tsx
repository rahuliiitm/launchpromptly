'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProvidersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/providers');
  }, [router]);
  return <div className="py-20 text-center text-gray-400">Redirecting...</div>;
}
