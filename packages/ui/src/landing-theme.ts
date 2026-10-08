import type { ThemeConfig } from 'antd';
import { designTokens } from './design-tokens';

export const landingTheme: ThemeConfig = {
  inherit: false,
  token: {
    colorPrimary: designTokens.colorModes.light.colorPrimary,
    colorInfo: designTokens.colorModes.light.colorInfo,
    colorText: designTokens.landing.default.colorText,
    colorTextSecondary: designTokens.landing.default.colorTextSecondary,
    colorBgContainer: designTokens.colorModes.light.colorBgContainer,
    colorBorder: designTokens.landing.default.colorBorder,
    colorFillAlter: designTokens.landing.default.colorFillAlter,
    fontFamily: designTokens.fontFamily,
    fontSize: designTokens.landing.default.fontSize,
    borderRadius: designTokens.landing.default.borderRadius,
    controlHeight: designTokens.landing.default.controlHeight,
  },
  components: {
    Button: {
      primaryShadow: designTokens.landing.legacy.buttonPrimaryShadow,
      defaultShadow: designTokens.landing.legacy.buttonDefaultShadow,
      fontWeight: designTokens.landing.legacy.buttonFontWeight,
    },
    Tabs: {
      horizontalItemGutter: designTokens.landing.default.tabsGutter,
      titleFontSize: designTokens.landing.default.tabsTitleFontSize,
    },
    Collapse: {
      headerBg: designTokens.colorModes.light.colorBgContainer,
      contentBg: designTokens.colorModes.light.colorBgContainer,
      headerPadding: designTokens.landing.default.collapseHeaderPadding,
    },
  },
};
