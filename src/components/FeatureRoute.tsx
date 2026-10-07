import type { ReactNode } from 'react';
import { FEATURES, ROUTE_FEATURES, getFeatureEnvironment, isFeatureEnabled, type FeatureRoutePath } from '../config/features';
import { NotFoundPage } from '../pages/SystemPages';
import { PublicShell } from './Shell';

export function FeatureRoute({ path, children }: { path: FeatureRoutePath; children: ReactNode }) {
  const environment = getFeatureEnvironment({
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    appEnvironment: import.meta.env.VITE_APP_ENV,
  });
  const feature = ROUTE_FEATURES[path];
  if (!isFeatureEnabled(FEATURES[feature].status, environment)) {
    return (
      <PublicShell>
        <NotFoundPage />
      </PublicShell>
    );
  }
  return children;
}

export function featureElement(path: FeatureRoutePath, element: ReactNode) {
  return <FeatureRoute path={path}>{element}</FeatureRoute>;
}
