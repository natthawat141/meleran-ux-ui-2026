import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { WorkspaceShell } from '@legacy/components/Shell';
import { useLms } from '@legacy/store';
import { NoAccessPage } from '@legacy/pages/SystemPages';

export function AdminPage({ children }: { children: React.ReactNode }) {
  const { currentUser } = useLms();
  const location = useLocation();
  if (!currentUser) return <Navigate to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} replace />;
  if (currentUser.role !== 'admin') return <WorkspaceShell availableRoles={['admin']}><NoAccessPage /></WorkspaceShell>;
  return <WorkspaceShell availableRoles={['admin']}>{children}</WorkspaceShell>;
}

export const admin = (element: React.ReactNode) => <AdminPage>{element}</AdminPage>;
