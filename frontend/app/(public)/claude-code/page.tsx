'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClaudeCodeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/#claude-code');
  }, [router]);
  return null;
}
