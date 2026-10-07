import React from 'react';
import { Routes } from 'react-router-dom';
import { entryRoutes } from './entry-routes';
import { managementRoutes } from './management-routes';
import { authoringRoutes } from './authoring-routes';
import { systemRoutes } from './system-routes';

export function AdminRouter() {
  return (
    <Routes>
      {entryRoutes}
      {managementRoutes}
      {authoringRoutes}
      {systemRoutes}
    </Routes>
  );
}
