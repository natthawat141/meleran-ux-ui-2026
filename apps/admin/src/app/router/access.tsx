import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { NoAccessPage, WorkspaceShell } from '@melearn/ui';
import { useAuthSession } from '../../features/auth/api/AuthSessionProvider';

export function AdminPage({ children }: { children: React.ReactNode }) {
  const session = useAuthSession();
  const location = useLocation();
  if (session.status === 'loading') return <div className="public-page" aria-live="polite">กำลังตรวจสอบบัญชี</div>;
  if (session.status === 'error') return <div className="public-page" role="alert">เชื่อมต่อระบบบัญชีไม่ได้ กรุณาลองเปิดหน้าใหม่</div>;
  if (!session.user) return <Navigate to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} replace />;
  if (!session.user.roles.includes('admin')) return <WorkspaceShell identity={{ id: session.user.id, name: session.user.display_name, email: session.user.email ?? '', role: 'learner', roles: session.user.roles }} availableRoles={[]} onLogout={session.logout}><NoAccessPage /></WorkspaceShell>;
  return <WorkspaceShell identity={{ id: session.user.id, name: session.user.display_name, email: session.user.email ?? '', role: 'admin', roles: session.user.roles }} availableRoles={['admin']} onLogout={session.logout}>{children}</WorkspaceShell>;
}

export const admin = (element: React.ReactNode) => <AdminPage>{element}</AdminPage>;
