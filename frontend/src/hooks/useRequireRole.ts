'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Redirects to /login if the current user is not authenticated or
 * does not have one of the allowed roles.
 *
 * Usage:
 *   const { user, loading } = useRequireRole('supervisor');
 *   const { user, loading } = useRequireRole(['admin', 'supervisor']);
 *
 * Returns the same { user, loading } from useAuth so callers don't
 * need to import useAuth separately.
 */
export function useRequireRole(allowed: string | string[]) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const roles = Array.isArray(allowed) ? allowed : [allowed];
    if (!user || !roles.includes(user.role)) {
      router.push('/login');
    }
  }, [user, loading, router, allowed]);

  return { user, loading };
}
