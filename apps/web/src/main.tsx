import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import thTH from 'antd/locale/th_TH';
import { LmsProvider } from '@legacy/store';
import { appTheme, colorModeTokens, defaultColorMode } from '@legacy/theme';
import { WebRoutes } from './App';
import './app.css';
import '@mantine/core/styles.css';
import '@fontsource-variable/anuphan';
import '@legacy/shadcn.css';
import '@legacy/styles.css';
import '@legacy/system-theme.css';
import '@legacy/workspace-responsive.css';

const theme = {
  cssVar: { prefix: 'ant' },
  token: {
    ...colorModeTokens[defaultColorMode],
    borderRadius: 12,
    fontFamily: '"Anuphan Variable", sans-serif',
    fontSize: 15,
    controlHeight: 42,
  },
  components: {
    Button: { controlHeight: 42, borderRadius: 10, primaryShadow: '0 3px 8px rgb(0 0 0 / 9%)' },
    Card: { borderRadiusLG: 15 },
    Input: { activeShadow: '0 0 0 3px rgb(0 116 232 / 12%)' },
    Menu: { itemBorderRadius: 10 },
  },
};

document.documentElement.dataset.theme = defaultColorMode;
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <MantineProvider theme={appTheme} defaultColorScheme="light">
        <ConfigProvider theme={theme} locale={thTH}>
          <AntApp>
            <BrowserRouter>
              <LmsProvider><WebRoutes /></LmsProvider>
            </BrowserRouter>
          </AntApp>
        </ConfigProvider>
      </MantineProvider>
    </React.StrictMode>
  );
}
