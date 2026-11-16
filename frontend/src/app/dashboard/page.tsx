'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

const ROLE_HOME: Record<string, string> = {
  admin:      '/dashboard/admin',
  supervisor: '/dashboard/supervisor',
  teacher:    '/dashboard/teacher',
    student:    '/dashboard/student',

};

export default function DashboardIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const dest = ROLE_HOME[user.role] ?? '/login';
    router.replace(dest);
  }, [user, loading, router]);

  // Show blank layout while redirecting
  return <DashboardLayout><div /></DashboardLayout>;
}
