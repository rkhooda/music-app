import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/player.store';
import { spacing } from '../theme';
import { BottomNavBar, NAV_BAR_HEIGHT } from './BottomNavBar';
import { MINI_PLAYER_HEIGHT, MiniPlayer } from './MiniPlayer';

const CHROME_ROUTES = new Set(['Home', 'Search', 'Library', 'PlaylistDetail', 'Downloads', 'Settings']);

export const showsChrome = (routeName: string | undefined) => Boolean(routeName && CHROME_ROUTES.has(routeName));

/** Bottom padding a scrolling screen needs so content clears the floating chrome. */
export const useChromeInset = () => {
  const insets = useSafeAreaInsets();
  const hasTrack = usePlayerStore((s) => s.currentTrack !== null);
  return Math.max(insets.bottom, spacing.s) + NAV_BAR_HEIGHT + spacing.l + (hasTrack ? MINI_PLAYER_HEIGHT + spacing.s : 0);
};

interface AppChromeProps {
  routeName: string | undefined;
}

/** Mini player + tab bar, mounted once above the navigator. */
export const AppChrome = ({ routeName }: AppChromeProps) => {
  const insets = useSafeAreaInsets();
  if (!showsChrome(routeName)) return null;

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.s) }]}>
      <MiniPlayer />
      <BottomNavBar routeName={routeName!} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
