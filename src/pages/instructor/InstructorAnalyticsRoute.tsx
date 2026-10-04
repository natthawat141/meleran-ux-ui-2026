import React from 'react';
import { Alert } from 'antd';
import { useLms } from '../../store';
import { AnalyticsPage } from '../AnalyticsPage';
import { InstructorAnalyticsPage } from './InstructorAnalyticsPage';

export function InstructorAnalyticsRoute() {
  const { data, currentUser } = useLms();
  if (!currentUser) return <Alert type="error" showIcon message="กรุณาเข้าสู่ระบบเพื่อดูรายงาน"/>;
  if (currentUser.role === 'admin') return <AnalyticsPage/>;
  return <InstructorAnalyticsPage data={data} currentUser={currentUser}/>;
}
