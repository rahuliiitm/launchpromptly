'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TeamRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/team');
  }, [router]);
  return <div className="py-20 text-center text-gray-400">Redirecting...</div>;
}
