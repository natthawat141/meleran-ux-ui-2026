import React, { Suspense } from 'react';
import { Alert, Button, Spin } from 'antd';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useAuthSession } from '../../features/auth/api/AuthSessionProvider';
class ResourceError extends React.Component<
  { children: React.ReactNode; reset: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <Alert
          type="error"
          showIcon
          title="โหลดข้อมูลไม่สำเร็จ"
          description={this.state.error.message}
          action={
            <Button
              onClick={() => {
                this.props.reset();
                this.setState({ error: null });
              }}
            >
              ลองใหม่
            </Button>
          }
        />
      );
    return this.props.children;
  }
}
export function ResourceBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuthSession();
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ResourceError key={`${user?.id ?? 'guest'}:${location.pathname}${location.search}`} reset={reset}>
          <Suspense
            fallback={
              <div role="status" className="public-page">
                <Spin /> กำลังโหลดข้อมูล
              </div>
            }
          >
            {children}
          </Suspense>
        </ResourceError>
      )}
    </QueryErrorResetBoundary>
  );
}
