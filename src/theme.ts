import { createTheme } from '@mantine/core';

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

export const colorModeTokens: Record<ColorMode, ColorTokens> = {
  light: {
    colorPrimary: '#0074e8',
    colorSuccess: '#1e7a57',
    colorWarning: '#8a6a2e',
    colorError: '#b34e4b',
    colorInfo: '#0074e8',
    colorText: '#24272d',
    colorTextSecondary: '#636971',
    colorTextTertiary: '#818994',
    colorBorder: '#e5e7eb',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8f9fa',
    colorFillAlter: '#f4f6f8',
  },
  dark: {
    colorPrimary: '#69b8f5',
    colorSuccess: '#75c9a2',
    colorWarning: '#d4b47c',
    colorError: '#f29a97',
    colorInfo: '#69b8f5',
    colorText: '#f2f6fb',
    colorTextSecondary: '#b6c0cc',
    colorTextTertiary: '#8e9baa',
    colorBorder: '#38424d',
    colorBgContainer: '#202830',
    colorBgLayout: '#151b21',
    colorFillAlter: '#29323b',
  },
};

export const appTheme = createTheme({
  primaryColor: 'cobalt',
  primaryShade: 6,
  fontFamily: '"Anuphan Variable", sans-serif',
  headings: { fontFamily: '"Anuphan Variable", sans-serif', fontWeight: '550' },
  defaultRadius: 'md',
  colors: {
    cobalt: ['#f1f9ff', '#e5f3ff', '#cbe8ff', '#a5d6ff', '#69b8f5', '#2896ee', '#0074e8', '#006bd5', '#0057b2', '#003f82'],
    ink: ['#f8f9fa', '#eef0f2', '#dce0e4', '#b8c0c8', '#929ca6', '#727d88', '#636971', '#4d555e', '#383e45', '#24272d'],
  },
  components: {
    Button: { defaultProps: { radius: 'md' }, styles: { root: { fontWeight: 600 } } },
    Paper: { defaultProps: { radius: 'lg' } },
    NavLink: { defaultProps: { variant: 'light', active: false } },
  },
});
