'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function KnowledgePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/knowledge/legal');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 animate-spin text-teal-500" />
    </div>
  );
}
