'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface RequireAdminProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    } else if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}
