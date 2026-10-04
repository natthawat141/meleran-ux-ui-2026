import React from 'react';
import { Alert } from 'antd';
import { useLms } from '../../store.jsx';
import { InstructorAnalyticsPage } from './InstructorAnalyticsPage.tsx';

export function InstructorAnalyticsRoute() {
  const { data, currentUser } = useLms();
  if (!currentUser) return <Alert type="error" showIcon message="กรุณาเข้าสู่ระบบเพื่อดูรายงาน"/>;
  return <InstructorAnalyticsPage data={data} currentUser={currentUser}/>;
}
