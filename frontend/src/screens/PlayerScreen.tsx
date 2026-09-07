import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Easing, PanResponder, StatusBar, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronDown, Ellipsis, Pause, Play, Shuffle, SkipBack, SkipForward } from 'lucide-react-native';
import { Artwork } from '../components/Artwork';
import { DevPerfBadge } from '../components/DevPerfBadge';
import { IconButton } from '../components/IconButton';
import { TrackActionsSheet } from '../components/TrackActionsSheet';
import { formatTime } from '../lib/format';
import { RootStackParamList } from '../navigation/types';
import { useDownloadsStore } from '../store/downloads.store';
import { usePlayerStore } from '../store/player.store';
import { Theme, radius, shadow, spacing, type, useStyles, useTheme } from '../theme';
import { MusicTrack } from '../types/music';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = Math.min(SCREEN_WIDTH - spacing.xl * 2 - 24, 320);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const PlayerScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { colors } = theme;

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const error = usePlayerStore((s) => s.error);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const source = usePlayerStore((s) => s.source);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const togglePlayback = usePlayerStore((s) => s.togglePlayback);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const skipPrevious = usePlayerStore((s) => s.skipPrevious);
  const isDownloaded = useDownloadsStore((s) => (currentTrack ? s.items[currentTrack.id]?.status === 'done' : false));

  const fade = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const artScale = useRef(new Animated.Value(0.94)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const [scrubRatio, setScrubRatio] = useState<number | null>(null);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: SCREEN_HEIGHT + 80, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => navigation.goBack());
  };

  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onPanResponderMove: (_, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 1.1) return dismiss();
        Animated.spring(dragY, { toValue: 0, damping: 18, stiffness: 200, mass: 0.85, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(dragY, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }).start(),
    }),
  ).current;

  const trackWidthRef = useRef(0);
  trackWidthRef.current = trackWidth;
  const scrubPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => setScrubRatio(clamp(event.nativeEvent.locationX / Math.max(1, trackWidthRef.current), 0, 1)),
      onPanResponderMove: (event) => setScrubRatio(clamp(event.nativeEvent.locationX / Math.max(1, trackWidthRef.current), 0, 1)),
      onPanResponderRelease: (event) => {
        const ratio = clamp(event.nativeEvent.locationX / Math.max(1, trackWidthRef.current), 0, 1);
        setScrubRatio(null);
        const total = usePlayerStore.getState().duration;
        if (total > 0) void seekTo(ratio * total);
      },
      onPanResponderTerminate: () => setScrubRatio(null),
    }),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(dragY, { toValue: 0, damping: 20, stiffness: 140, mass: 0.95, useNativeDriver: true }),
    ]).start();
  }, [fade, dragY]);

  useEffect(() => {
    Animated.spring(artScale, { toValue: isPlaying ? 1 : 0.94, damping: 16, stiffness: 160, mass: 0.9, useNativeDriver: true }).start();
  }, [isPlaying, artScale]);

  useEffect(() => {
    if (!currentTrack) navigation.goBack();
  }, [currentTrack, navigation]);

  if (!currentTrack) return null;

  const safeDuration = duration > 0 ? duration : currentTrack.duration || 0;
  const liveRatio = safeDuration > 0 ? clamp(progress / safeDuration, 0, 1) : 0;
  const ratio = scrubRatio ?? liveRatio;
  const shownTime = scrubRatio !== null ? scrubRatio * safeDuration : progress;
  const hasPrevious = currentIndex > 0 || progress > 4;
  const hasNext = shuffle ? queueLength > 1 : currentIndex < queueLength - 1;
  const statusLine = error ? error : isLoading ? 'Loading…' : isBuffering ? 'Buffering…' : source === 'local' ? 'Playing from downloads' : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <Animated.View style={[styles.sheet, { opacity: fade, transform: [{ translateY: dragY }] }]} {...sheetPan.panHandlers}>
        <View style={styles.header}>
          <IconButton label="Close player" onPress={dismiss} size={40}>
            <ChevronDown size={22} color={colors.inkMuted} strokeWidth={2.3} />
          </IconButton>
          <Text style={styles.headerLabel} numberOfLines={1}>
            {isDownloaded ? 'Downloaded' : 'Now playing'}
          </Text>
          <IconButton label="More" onPress={() => setSheetTrack(currentTrack)} size={40}>
            <Ellipsis size={20} color={colors.inkMuted} strokeWidth={2.2} />
          </IconButton>
        </View>

        <View style={styles.artworkArea}>
          <Animated.View style={[styles.artworkShell, { transform: [{ scale: artScale }] }]}>
            <Artwork uri={currentTrack.thumbnail} size={ARTWORK_SIZE} radius={radius.xl} />
          </Animated.View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
          <Text style={[styles.status, error ? styles.statusError : null]} numberOfLines={2}>
            {statusLine || ' '}
          </Text>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.scrubArea} onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)} {...scrubPan.panHandlers}>
            <View style={[styles.track, scrubRatio !== null && styles.trackActive]}>
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
            </View>
            <View style={[styles.thumb, { left: clamp(ratio * trackWidth, 8, Math.max(8, trackWidth - 8)) - 8 }, scrubRatio !== null && styles.thumbActive]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatTime(shownTime)}</Text>
            <Text style={styles.time}>{safeDuration > 0 ? `-${formatTime(Math.max(0, safeDuration - shownTime))}` : '--:--'}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <IconButton label={shuffle ? 'Shuffle on' : 'Shuffle off'} onPress={toggleShuffle} size={48}>
            <Shuffle size={20} color={shuffle ? colors.accentStrong : colors.inkMuted} strokeWidth={2.2} />
          </IconButton>
          <IconButton label="Previous" onPress={() => void skipPrevious()} size={56} disabled={!hasPrevious}>
            <SkipBack size={28} color={colors.ink} fill={colors.ink} strokeWidth={1.6} />
          </IconButton>
          <IconButton label={isLoading ? 'Cancel' : isPlaying ? 'Pause' : 'Play'} onPress={togglePlayback} size={76} style={styles.playButton}>
            {isLoading ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : isPlaying ? (
              <Pause size={30} color={colors.onAccent} fill={colors.onAccent} strokeWidth={1.8} />
            ) : (
              <Play size={30} color={colors.onAccent} fill={colors.onAccent} strokeWidth={1.8} style={{ marginLeft: 3 }} />
            )}
          </IconButton>
          <IconButton label="Next" onPress={() => void skipNext()} size={56} disabled={!hasNext}>
            <SkipForward size={28} color={colors.ink} fill={colors.ink} strokeWidth={1.6} />
          </IconButton>
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.footer}>
          <DevPerfBadge />
        </View>
      </Animated.View>

      <TrackActionsSheet track={sheetTrack} onClose={() => setSheetTrack(null)} />
    </SafeAreaView>
  );
};

const makeStyles = (theme: Theme) => ({
  container: { flex: 1, backgroundColor: 'transparent' },
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.l,
  },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingTop: spacing.xs },
  headerLabel: { flex: 1, textAlign: 'center' as const, ...type.eyebrow, color: theme.colors.inkMuted },
  artworkArea: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: ARTWORK_SIZE + 24 },
  artworkShell: { borderRadius: radius.xl, ...shadow(theme, 'float') },
  titleBlock: { alignItems: 'center' as const, gap: 4, paddingHorizontal: spacing.s },
  title: { ...type.title, color: theme.colors.ink, textAlign: 'center' as const },
  artist: { ...type.body, color: theme.colors.inkSoft, textAlign: 'center' as const },
  status: { ...type.footnote, color: theme.colors.inkMuted, textAlign: 'center' as const, minHeight: 18, marginTop: 2 },
  statusError: { color: theme.colors.danger },
  progressBlock: { marginTop: spacing.xl },
  scrubArea: { height: 32, justifyContent: 'center' as const },
  track: { height: 4, borderRadius: 2, backgroundColor: theme.colors.line, overflow: 'hidden' as const },
  trackActive: { height: 6, borderRadius: 3 },
  fill: { height: '100%' as const, backgroundColor: theme.colors.ink },
  thumb: { position: 'absolute' as const, width: 16, height: 16, borderRadius: 8, backgroundColor: theme.colors.ink, opacity: 0 },
  thumbActive: { opacity: 1, transform: [{ scale: 1.2 }] },
  timeRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 2 },
  time: { ...type.caption, color: theme.colors.inkMuted, fontVariant: ['tabular-nums' as const] },
  controls: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginTop: spacing.xl, paddingHorizontal: spacing.xs },
  playButton: { backgroundColor: theme.colors.accent, ...shadow(theme, 'card') },
  footer: { minHeight: 28, justifyContent: 'center' as const, marginTop: spacing.l },
});

export default PlayerScreen;
