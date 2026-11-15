// FAHDAR visual identity: deep navy + royal blue, white & greys.
export const palette = {
  navy950: '#050C1A',
  navy900: '#0A1630',
  navy800: '#0F2044',
  navy700: '#16305F',
  royal600: '#2C56D6',
  royal500: '#3B6CF0',
  royal400: '#6B91F7',
  royal100: '#E3EAFE',
  white: '#FFFFFF',
  gray50: '#F5F7FB',
  gray100: '#ECEFF5',
  gray200: '#DCE1EA',
  gray400: '#9AA4B5',
  gray500: '#6B7588',
  gray700: '#3A4357',
  success: '#1F9D6B',
  warning: '#D9921A',
  danger: '#D64545',
  info: '#2C8BD6',
};

export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentSoft: string;
  heroFrom: string;
  heroTo: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  tabBar: string;
};

export const lightColors: ThemeColors = {
  bg: palette.gray50,
  surface: palette.white,
  surfaceAlt: palette.gray100,
  border: palette.gray200,
  text: palette.navy900,
  textMuted: palette.gray500,
  primary: palette.navy900,
  primaryText: palette.white,
  accent: palette.royal600,
  accentSoft: palette.royal100,
  heroFrom: palette.navy900,
  heroTo: palette.navy700,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
  tabBar: palette.white,
};

export const darkColors: ThemeColors = {
  bg: palette.navy950,
  surface: palette.navy900,
  surfaceAlt: palette.navy800,
  border: '#1E2E52',
  text: '#EEF2FA',
  textMuted: palette.gray400,
  primary: palette.royal500,
  primaryText: palette.white,
  accent: palette.royal400,
  accentSoft: '#172B57',
  heroFrom: '#081228',
  heroTo: palette.navy700,
  success: '#3CC48E',
  warning: '#F0AD3C',
  danger: '#F06A6A',
  info: '#5AAEF0',
  tabBar: palette.navy900,
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = (n: number) => n * 4;

export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
};
