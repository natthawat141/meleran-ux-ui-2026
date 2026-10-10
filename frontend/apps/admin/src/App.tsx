import { ResourceBoundary } from './app/providers/ResourceBoundary';
import { AdminRouter } from './app/router';

export function AdminRoutes() {
  return <ResourceBoundary><AdminRouter /></ResourceBoundary>;
}
