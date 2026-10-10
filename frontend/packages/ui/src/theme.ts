import { createTheme, type MantineColorShade, type MantineColorsTuple } from '@mantine/core';
import { designTokens } from './design-tokens';

// Dark mode is defined here for a future app-wide rollout, not exposed in the UI yet.
export type ColorMode = 'light' | 'dark';

export interface ColorTokens {
  colorPrimary: string;
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  colorInfo: string;
  colorText: string;
  colorTextSecondary: string;
  colorTextTertiary: string;
  colorBorder: string;
  colorBgContainer: string;
  colorBgLayout: string;
  colorFillAlter: string;
}

export const defaultColorMode: ColorMode = 'light';

export const colorModeTokens = designTokens.colorModes as Record<ColorMode, ColorTokens>;

export const appTheme = createTheme({
  primaryColor: designTokens.mantine.primaryColor,
  primaryShade: designTokens.mantine.primaryShade as MantineColorShade,
  fontFamily: designTokens.fontFamily,
  headings: { fontFamily: designTokens.fontFamily, fontWeight: designTokens.mantine.headingFontWeight },
  defaultRadius: designTokens.mantine.defaultRadius,
  colors: {
    ...designTokens.mantine.colors as unknown as Record<string, MantineColorsTuple>,
  },
  components: {
    Button: { defaultProps: { radius: designTokens.mantine.buttonRadius }, styles: { root: { fontWeight: 600 } } },
    Paper: { defaultProps: { radius: designTokens.mantine.paperRadius } },
    NavLink: { defaultProps: { variant: 'light', active: false } },
  },
});
