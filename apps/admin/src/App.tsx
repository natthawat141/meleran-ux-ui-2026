import { PrototypeDataBoundary } from './app/providers/PrototypeDataBoundary';
import { AdminRouter } from './app/router';

export function AdminRoutes() {
  return <PrototypeDataBoundary><AdminRouter /></PrototypeDataBoundary>;
}
