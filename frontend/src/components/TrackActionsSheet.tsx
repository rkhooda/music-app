import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownToLine, Check, ChevronLeft, ListMusic, Play, Plus } from 'lucide-react-native';
import { useDownloadsStore } from '../store/downloads.store';
import { usePlayerStore } from '../store/player.store';
import { usePlaylistStore } from '../store/playlist.store';
import { Theme, radius, shadow, spacing, type, useStyles, useTheme } from '../theme';
import { MusicTrack } from '../types/music';
import { Artwork } from './Artwork';

export interface SheetAction {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
}

interface TrackActionsSheetProps {
  track: MusicTrack | null;
  onClose: () => void;
  /** Extra context-specific actions (e.g. remove from this playlist). */
  extraActions?: SheetAction[];
  /** Playlist id to hide from the "add to playlist" list. */
  excludePlaylistId?: string;
}

/** Bottom sheet with the actions every track supports: play, download, add to playlist. */
export const TrackActionsSheet = ({ track, onClose, extraActions = [], excludePlaylistId }: TrackActionsSheetProps) => {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { colors } = theme;
  const [mode, setMode] = useState<'actions' | 'playlists'>('actions');
  const slide = useRef(new Animated.Value(1)).current;

  const playTrack = usePlayerStore((s) => s.playTrack);
  const downloads = useDownloadsStore((s) => s.items);
  const enqueue = useDownloadsStore((s) => s.enqueue);
  const playlists = usePlaylistStore((s) => s.playlists);
  const addTrackToPlaylist = usePlaylistStore((s) => s.addTrackToPlaylist);
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);

  const visible = track !== null;

  useEffect(() => {
    if (visible) setMode('actions');
    Animated.timing(slide, { toValue: visible ? 0 : 1, duration: visible ? 260 : 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, slide]);

  if (!track) return null;

  const download = downloads[track.id];
  const downloadLabel =
    download?.status === 'done' ? 'Downloaded' : download?.status === 'downloading' ? 'Downloading…' : download?.status === 'queued' ? 'Queued' : download?.status === 'failed' ? 'Retry download' : 'Download';
  const downloadDone = download?.status === 'done';

  const close = () => {
    Animated.timing(slide, { toValue: 1, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const run = (action: () => void) => {
    action();
    close();
  };

  const actions: SheetAction[] = [
    { label: 'Play', icon: <Play size={18} color={colors.ink} fill={colors.ink} strokeWidth={2} />, onPress: () => run(() => void playTrack(track)) },
    {
      label: downloadLabel,
      icon: downloadDone ? <Check size={18} color={colors.success} strokeWidth={2.4} /> : <ArrowDownToLine size={18} color={colors.ink} strokeWidth={2.2} />,
      onPress: () => {
        if (downloadDone || download?.status === 'downloading' || download?.status === 'queued') return close();
        if (download?.status === 'failed') useDownloadsStore.getState().retry(track.id);
        else enqueue(track);
        close();
      },
    },
    { label: 'Add to playlist', icon: <ListMusic size={18} color={colors.ink} strokeWidth={2.2} />, onPress: () => setMode('playlists') },
    ...extraActions.map((action) => ({ ...action, onPress: () => run(action.onPress) })),
  ];

  const candidatePlaylists = playlists.filter((playlist) => playlist.id !== excludePlaylistId);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={close} accessibilityLabel="Close" />
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, spacing.l), transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }] },
        ]}
      >
        <View style={styles.grabber} />
        <View style={styles.header}>
          {mode === 'playlists' ? (
            <Pressable onPress={() => setMode('actions')} hitSlop={10} accessibilityLabel="Back" style={styles.headerBack}>
              <ChevronLeft size={20} color={colors.inkMuted} strokeWidth={2.4} />
            </Pressable>
          ) : (
            <Artwork uri={track.thumbnail} size={44} radius={10} />
          )}
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {mode === 'playlists' ? 'Add to playlist' : track.title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {mode === 'playlists' ? track.title : track.artist}
            </Text>
          </View>
        </View>

        <ScrollView bounces={false} style={styles.list} contentContainerStyle={styles.listContent}>
          {mode === 'actions'
            ? actions.map((action) => (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  onPress={action.onPress}
                  android_ripple={{ color: colors.line }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.rowIcon}>{action.icon}</View>
                  <Text style={[styles.rowLabel, action.destructive && { color: colors.danger }]}>{action.label}</Text>
                </Pressable>
              ))
            : [
                <Pressable
                  key="new"
                  accessibilityRole="button"
                  onPress={() => run(() => addTrackToPlaylist(createPlaylist(`Playlist ${playlists.length + 1}`), track))}
                  android_ripple={{ color: colors.line }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.rowIcon}>
                    <Plus size={18} color={colors.accentStrong} strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.accentStrong }]}>New playlist</Text>
                </Pressable>,
                ...candidatePlaylists.map((playlist) => {
                  const already = playlist.tracks.some((item) => item.id === track.id);
                  return (
                    <Pressable
                      key={playlist.id}
                      accessibilityRole="button"
                      disabled={already}
                      onPress={() => run(() => addTrackToPlaylist(playlist.id, track))}
                      android_ripple={{ color: colors.line }}
                      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }, already && { opacity: 0.5 }]}
                    >
                      <Artwork uri={playlist.coverUri || playlist.tracks[0]?.thumbnail} size={36} radius={8} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel} numberOfLines={1}>
                          {playlist.title}
                        </Text>
                        <Text style={styles.rowMeta}>{already ? 'Already added' : `${playlist.tracks.length} songs`}</Text>
                      </View>
                    </Pressable>
                  );
                }),
              ]}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const makeStyles = (theme: Theme) => ({
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    position: 'absolute' as const,
    left: spacing.s,
    right: spacing.s,
    bottom: spacing.s,
    borderRadius: radius.xl,
    backgroundColor: theme.colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    paddingTop: spacing.s,
    maxHeight: '70%' as const,
    ...shadow(theme, 'float'),
  },
  grabber: { alignSelf: 'center' as const, width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.line, marginBottom: spacing.s },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.m, paddingHorizontal: spacing.xl, paddingVertical: spacing.m },
  headerBack: { width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const, marginLeft: -spacing.m },
  headerText: { flex: 1, gap: 2 },
  headerTitle: { ...type.headline, color: theme.colors.ink },
  headerSubtitle: { ...type.footnote, color: theme.colors.inkMuted },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.line },
  listContent: { paddingVertical: spacing.s },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.m, minHeight: 52, paddingHorizontal: spacing.xl },
  rowIcon: { width: 28, alignItems: 'center' as const },
  rowLabel: { ...type.body, color: theme.colors.ink },
  rowMeta: { ...type.caption, fontWeight: '500' as const, color: theme.colors.inkMuted, marginTop: 2 },
});
