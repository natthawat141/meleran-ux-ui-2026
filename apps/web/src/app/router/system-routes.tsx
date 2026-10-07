import React from 'react';
import { Route } from 'react-router-dom';
import { NoAccessPage, NotFoundPage } from '@legacy/pages/SystemPages';
import { Public } from './access';

export const systemRoutes = (
  <>
    <Route path="/403" element={<Public><NoAccessPage /></Public>} />
    <Route path="*" element={<Public><NotFoundPage /></Public>} />
  </>
);
