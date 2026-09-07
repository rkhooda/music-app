import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pause, Play, SkipForward } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/types';
import { usePlayerStore } from '../store/player.store';
import { Theme, radius, shadow, spacing, type, useStyles, useTheme } from '../theme';
import { Artwork } from './Artwork';
import { IconButton } from './IconButton';

export const MINI_PLAYER_HEIGHT = 64;

/** Floating glass bar; mounted once in AppChrome so it never re-animates between screens. */
export const MiniPlayer = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const error = usePlayerStore((s) => s.error);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const togglePlayback = usePlayerStore((s) => s.togglePlayback);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const hasNext = usePlayerStore((s) => s.shuffle ? s.queue.length > 1 : s.currentIndex < s.queue.length - 1);

  const reveal = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(reveal, { toValue: currentTrack ? 1 : 0, useNativeDriver: true, damping: 18, stiffness: 190, mass: 0.9 }).start();
  }, [currentTrack, reveal]);

  useEffect(() => {
    const ratio = duration > 0 ? Math.min(1, Math.max(0, progress / duration)) : 0;
    Animated.timing(progressAnim, { toValue: ratio, duration: 260, useNativeDriver: false }).start();
  }, [progress, duration, progressAnim]);

  if (!currentTrack) return null;

  const busy = isLoading || isBuffering;
  const subtitle = error ? error : busy ? (isLoading ? 'Loading…' : 'Buffering…') : currentTrack.artist;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open player"
        onPress={() => navigation.navigate('Player')}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        <Artwork uri={currentTrack.thumbnail} size={44} radius={10} />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={[styles.subtitle, error ? styles.subtitleError : null]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <IconButton label={isLoading ? 'Cancel' : isPlaying ? 'Pause' : 'Play'} onPress={togglePlayback} size={40}>
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.ink} />
          ) : isPlaying ? (
            <Pause size={20} color={theme.colors.ink} fill={theme.colors.ink} strokeWidth={2} />
          ) : (
            <Play size={20} color={theme.colors.ink} fill={theme.colors.ink} strokeWidth={2} />
          )}
        </IconButton>
        <IconButton label="Next" onPress={() => void skipNext()} size={40} disabled={!hasNext}>
          <SkipForward size={18} color={theme.colors.ink} fill={theme.colors.ink} strokeWidth={2} />
        </IconButton>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
};

const makeStyles = (theme: Theme) => ({
  wrapper: { marginHorizontal: spacing.l, marginBottom: spacing.s },
  card: {
    height: MINI_PLAYER_HEIGHT,
    borderRadius: radius.l,
    backgroundColor: theme.colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingLeft: spacing.m,
    paddingRight: spacing.xs,
    gap: spacing.m,
    overflow: 'hidden' as const,
    ...shadow(theme, 'float'),
  },
  meta: { flex: 1, gap: 2 },
  title: { ...type.callout, fontWeight: '600' as const, color: theme.colors.ink },
  subtitle: { ...type.footnote, color: theme.colors.inkMuted },
  subtitleError: { color: theme.colors.danger },
  progressTrack: { position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: 2, backgroundColor: theme.colors.line },
  progressFill: { height: 2, backgroundColor: theme.colors.accentStrong },
});
