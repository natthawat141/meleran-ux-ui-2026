import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import { MantineProvider } from '@mantine/core';
import { designTokens } from './design-tokens';
import { appTheme, colorModeTokens, defaultColorMode } from './theme';

const antTheme = {
  cssVar: { prefix: 'ant' },
  token: {
    ...colorModeTokens[defaultColorMode],
    borderRadius: designTokens.ant.borderRadius,
    fontFamily: designTokens.fontFamily,
    fontSize: designTokens.ant.fontSize,
    controlHeight: designTokens.ant.controlHeight,
  },
  components: {
    Button: {
      controlHeight: designTokens.ant.buttonControlHeight,
      borderRadius: designTokens.ant.buttonBorderRadius,
      primaryShadow: designTokens.ant.buttonPrimaryShadow,
    },
    Card: { borderRadiusLG: designTokens.ant.cardBorderRadius },
    Input: { activeShadow: designTokens.ant.inputActiveShadow },
    Menu: { itemBorderRadius: designTokens.ant.menuItemBorderRadius },
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
