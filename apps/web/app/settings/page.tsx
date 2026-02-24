'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/api-keys');
  }, [router]);
  return <div className="py-20 text-center text-gray-400">Redirecting...</div>;
}
