import React, { Suspense, lazy } from 'react';
const Page = lazy(() => import('./DevCourseDetailPage.tsx').then((module) => ({ default: module.DevCourseDetailPage })));
export function PublicCourseDetailPage() { return <Suspense fallback={<div className="public-page">กำลังโหลดคอร์ส</div>}><Page /></Suspense>; }
