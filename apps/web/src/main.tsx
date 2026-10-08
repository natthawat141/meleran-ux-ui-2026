import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LmsProvider } from '@melearn/store';
import { MelearnUiProvider, defaultColorMode } from '@melearn/ui';
import { WebRoutes } from './App';
import { AuthSessionProvider } from './features/auth/api/AuthSessionProvider';
import { QueryProvider } from './app/providers/QueryProvider';
import './app.css';
import '@mantine/core/styles.css';
import '@fontsource-variable/anuphan';
import '@melearn/ui/styles/styles.css';
import '@melearn/ui/styles/system-theme.css';
import '@melearn/ui/styles/workspace-responsive.css';

document.documentElement.dataset.theme = defaultColorMode;
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <MelearnUiProvider>
        <QueryProvider><BrowserRouter>
          <LmsProvider><AuthSessionProvider><WebRoutes /></AuthSessionProvider></LmsProvider>
        </BrowserRouter></QueryProvider>
      </MelearnUiProvider>
    </React.StrictMode>
  );
}
