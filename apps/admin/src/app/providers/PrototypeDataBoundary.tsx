import React from 'react';
import { useLocation } from 'react-router-dom';
import { LmsProvider } from '@melearn/store';
import { usesPrototypeData } from './prototype-routes';

/** Temporary boundary for pages still awaiting feature API migration. */
export function PrototypeDataBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return usesPrototypeData(pathname) ? <LmsProvider>{children}</LmsProvider> : <>{children}</>;
}
