import React from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { NoAccessPage, NotFoundPage, WorkspaceShell } from '@melearn/ui';
import { resolveAdminCompatibilityRoute } from '../../route-compatibility';

/* Allowlisted migration paths; Instructor and retired grading paths fail closed. */
export const systemRoutes = (
  <>
    <Route path="/teach" element={<LegacyAdminRedirect />} />
    <Route path="/teach/*" element={<LegacyAdminRedirect />} />
    <Route path="/403" element={<WorkspaceShell availableRoles={['admin']}><NoAccessPage /></WorkspaceShell>} />
    <Route path="*" element={<WorkspaceShell availableRoles={['admin']}><NotFoundPage /></WorkspaceShell>} />
  </>
);

function LegacyAdminRedirect() {
  const location = useLocation();
  const target = resolveAdminCompatibilityRoute(location.pathname, location.search, location.hash);
  return target ? <Navigate to={target} replace /> : <WorkspaceShell availableRoles={['admin']}><NotFoundPage /></WorkspaceShell>;
}
