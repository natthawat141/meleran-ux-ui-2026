import { ResourceBoundary } from './app/providers/ResourceBoundary';
import { WebRouter } from './app/router';

export function WebRoutes() {
  return <ResourceBoundary><WebRouter /></ResourceBoundary>;
}
