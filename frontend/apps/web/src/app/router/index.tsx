import React from 'react';
import { Routes } from 'react-router-dom';
import { publicEntryRoutes, publicContentRoutes } from './public-routes';
import { authRoutes } from './auth-routes';
import { memberCatalogRoutes, learnerRoutes } from './learner-routes';
import { instructorRoutes } from './instructor-routes';
import { systemRoutes } from './system-routes';

export function WebRouter() {
  return (
    <Routes>
      {publicEntryRoutes}
      {memberCatalogRoutes}
      {publicContentRoutes}
      {authRoutes}
      {learnerRoutes}
      {instructorRoutes}
      {systemRoutes}
    </Routes>
  );
}
