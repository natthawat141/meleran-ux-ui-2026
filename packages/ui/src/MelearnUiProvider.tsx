import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import { MantineProvider } from '@mantine/core';
import { appTheme, colorModeTokens, defaultColorMode } from './theme';

const antTheme = {
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

/** Shared UI-library providers. Each app owns its router and application/session providers. */
export function MelearnUiProvider({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={appTheme} defaultColorScheme={defaultColorMode}>
      <ConfigProvider theme={antTheme} locale={thTH}>
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </MantineProvider>
  );
}
