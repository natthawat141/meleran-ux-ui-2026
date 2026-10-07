import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LmsProvider } from './store';
import { AppRoutes } from './App';
import { MelearnUiProvider, defaultColorMode } from '@melearn/ui';
import '@mantine/core/styles.css';
import '@fontsource-variable/anuphan';
import './shadcn.css';
import './styles.css';
import './system-theme.css';
import './workspace-responsive.css';

document.documentElement.dataset.theme = defaultColorMode;

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <MelearnUiProvider>
        <BrowserRouter>
          <LmsProvider>
            <AppRoutes />
          </LmsProvider>
        </BrowserRouter>
      </MelearnUiProvider>
    </React.StrictMode>
  );
}
