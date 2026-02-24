'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TraceDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/observability/traces/${params.id}`);
  }, [router, params.id]);
  return <div className="py-20 text-center text-gray-400">Redirecting...</div>;
}
