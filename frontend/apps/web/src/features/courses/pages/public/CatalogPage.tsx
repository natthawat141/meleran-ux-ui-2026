import React, { Suspense, lazy } from 'react';
const Page = lazy(() => import('./DevCatalogPage.tsx').then((module) => ({ default: module.DevPublicCatalogPage })));
export function PublicCatalogPage() { return <Suspense fallback={<div className="public-page">กำลังโหลดคอร์ส</div>}><Page /></Suspense>; }
