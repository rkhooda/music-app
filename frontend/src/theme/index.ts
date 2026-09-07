import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

/**
 * Warm, paper-like palette that the app already had, made into tokens with a
 * dark counterpart. Both modes keep the same hue family so the identity survives
 * the system appearance switch.
 */
const light = {
  bg: '#f3ede2',
  surface: '#fbf7ef',
  surfaceStrong: '#fffdf8',
  surfaceMuted: '#ebe3d5',
  glass: 'rgba(252, 249, 241, 0.86)',
  glassBorder: 'rgba(120, 100, 70, 0.14)',
  line: 'rgba(120, 100, 70, 0.12)',
  ink: '#2f2922',
  inkSoft: '#5c5144',
  inkMuted: '#6e6255',
  accent: '#d4a574',
  accentStrong: '#b7823f',
  onAccent: '#2a2118',
  danger: '#b04a3f',
  dangerSoft: 'rgba(176, 74, 63, 0.12)',
  success: '#4f8a5b',
  shadow: '#8a7657',
  scrim: 'rgba(30, 24, 16, 0.4)',
};

const dark: typeof light = {
  bg: '#15120f',
  surface: '#1f1a16',
  surfaceStrong: '#28221d',
  surfaceMuted: '#2f2822',
  glass: 'rgba(36, 30, 25, 0.86)',
  glassBorder: 'rgba(255, 255, 255, 0.09)',
  line: 'rgba(255, 255, 255, 0.08)',
  ink: '#f3ece1',
  inkSoft: '#cdc0ae',
  inkMuted: '#a1927f',
  accent: '#dcab70',
  accentStrong: '#e8bd88',
  onAccent: '#1d1611',
  danger: '#e07a6c',
  dangerSoft: 'rgba(224, 122, 108, 0.16)',
  success: '#7fbf8a',
  shadow: '#000000',
  scrim: 'rgba(0, 0, 0, 0.55)',
};

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { s: 10, m: 16, l: 22, xl: 28, pill: 999 } as const;

export const type = {
  largeTitle: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  callout: { fontSize: 14, fontWeight: '500' as const },
  footnote: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.6, textTransform: 'uppercase' as const },
} as const;

/** Touch targets follow the 44pt Apple minimum. */
export const hit = { min: 44 } as const;

export interface Theme {
  dark: boolean;
  colors: typeof light;
}

export const lightTheme: Theme = { dark: false, colors: light };
export const darkTheme: Theme = { dark: true, colors: dark };

export const useTheme = (): Theme => (useColorScheme() === 'dark' ? darkTheme : lightTheme);

type NamedStyles<T> = { [P in keyof T]: StyleSheet.NamedStyles<T>[P] };

/** Memoised, theme-aware StyleSheet. Define the factory at module scope. */
export const useStyles = <T extends NamedStyles<T>>(factory: (theme: Theme) => T): T => {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
};

export const shadow = (theme: Theme, elevation: 'soft' | 'card' | 'float' = 'card') => {
  const presets = {
    soft: { shadowOpacity: theme.dark ? 0.35 : 0.1, shadowRadius: 8, height: 3, elevation: 2 },
    card: { shadowOpacity: theme.dark ? 0.45 : 0.16, shadowRadius: 16, height: 8, elevation: 5 },
    float: { shadowOpacity: theme.dark ? 0.55 : 0.22, shadowRadius: 24, height: 14, elevation: 10 },
  }[elevation];
  return {
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: presets.height },
    shadowOpacity: presets.shadowOpacity,
    shadowRadius: presets.shadowRadius,
    elevation: presets.elevation,
  };
};
