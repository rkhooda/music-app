import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownToLine, Check, Play, RotateCw, Shuffle, Trash2 } from 'lucide-react-native';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TrackActionsSheet } from '../components/TrackActionsSheet';
import { TrackRow } from '../components/TrackRow';
import { useChromeInset } from '../components/AppChrome';
import { formatBytes, pluralize } from '../lib/format';
import { DownloadEntry, selectDownloadedBytes, selectDownloadedTracks, useDownloadsStore } from '../store/downloads.store';
import { usePlayerStore } from '../store/player.store';
import { Theme, radius, spacing, type, useStyles, useTheme } from '../theme';
import { MusicTrack } from '../types/music';

const DownloadsScreen = () => {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const bottomInset = useChromeInset();
  const items = useDownloadsStore((s) => s.items);
  const order = useDownloadsStore((s) => s.order);
  const retry = useDownloadsStore((s) => s.retry);
  const remove = useDownloadsStore((s) => s.remove);
  const clearFailed = useDownloadsStore((s) => s.clearFailed);
  const downloadedTracks = useDownloadsStore(selectDownloadedTracks);
  const totalBytes = useDownloadsStore(selectDownloadedBytes);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const loadingTrackId = usePlayerStore((s) => s.loadingTrackId);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);

  const entries = order.map((id) => items[id]).filter(Boolean) as DownloadEntry[];
  const failedCount = entries.filter((entry) => entry.status === 'failed').length;

  const playAll = (random: boolean) => {
    if (downloadedTracks.length === 0) return;
    if (random !== shuffle) toggleShuffle();
    const first = random ? downloadedTracks[Math.floor(Math.random() * downloadedTracks.length)] : downloadedTracks[0];
    void playTrack(first, downloadedTracks);
  };

  const confirmRemove = (entry: DownloadEntry) => {
    Alert.alert('Remove download?', `“${entry.track.title}” will be deleted from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void remove(entry.track.id) },
    ]);
  };

  const trailingFor = (entry: DownloadEntry) => {
    switch (entry.status) {
      case 'downloading':
        return (
          <View style={styles.progressWrap}>
            <Text style={styles.progressText}>{Math.round(entry.progress * 100)}%</Text>
            <ActivityIndicator size="small" color={theme.colors.accentStrong} />
          </View>
        );
      case 'queued':
        return <Text style={styles.progressText}>Queued</Text>;
      case 'failed':
        return (
          <Pressable onPress={() => retry(entry.track.id)} accessibilityLabel="Retry download" style={({ pressed }) => [styles.retryChip, pressed && { opacity: 0.7 }]}>
            <RotateCw size={13} color={theme.colors.danger} strokeWidth={2.4} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        );
      default:
        return <Check size={16} color={theme.colors.success} strokeWidth={2.4} />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Downloads"
        subtitle={downloadedTracks.length > 0 ? `${pluralize(downloadedTracks.length, 'song')} · ${formatBytes(totalBytes)}` : 'Songs saved on this device'}
        back
        right={
          downloadedTracks.length > 0 ? (
            <>
              <IconButton label="Shuffle all" onPress={() => playAll(true)} variant="surface" size={40}>
                <Shuffle size={17} color={theme.colors.ink} strokeWidth={2.2} />
              </IconButton>
              <IconButton label="Play all" onPress={() => playAll(false)} variant="accent" size={40}>
                <Play size={17} color={theme.colors.onAccent} fill={theme.colors.onAccent} strokeWidth={2} />
              </IconButton>
            </>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <EmptyState
            icon={<ArrowDownToLine size={32} color={theme.colors.inkMuted} strokeWidth={1.6} />}
            title="No downloads yet"
            message="Long-press a song, or open a playlist and tap the download button."
          />
        ) : (
          <View style={styles.list}>
            {entries.map((entry) => (
              <TrackRow
                key={entry.track.id}
                track={entry.track}
                onPress={(track) => (entry.status === 'done' ? void playTrack(track, downloadedTracks) : entry.status === 'failed' ? retry(track.id) : undefined)}
                onLongPress={setSheetTrack}
                isCurrent={currentTrackId === entry.track.id}
                isPlaying={isPlaying}
                isLoading={loadingTrackId === entry.track.id}
                trailing={trailingFor(entry)}
              />
            ))}
            {entries.some((entry) => entry.status === 'failed' && entry.error) ? (
              <Text style={styles.errorHint}>{entries.find((entry) => entry.status === 'failed' && entry.error)?.error}</Text>
            ) : null}
          </View>
        )}

        {failedCount > 0 ? (
          <Pressable onPress={clearFailed} style={({ pressed }) => [styles.clearFailed, pressed && { opacity: 0.7 }]}>
            <Text style={styles.clearFailedText}>Clear {pluralize(failedCount, 'failed download')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <TrackActionsSheet
        track={sheetTrack}
        onClose={() => setSheetTrack(null)}
        extraActions={[
          {
            label: 'Remove download',
            icon: <Trash2 size={18} color={theme.colors.danger} strokeWidth={2.2} />,
            destructive: true,
            onPress: () => {
              const entry = sheetTrack ? items[sheetTrack.id] : undefined;
              if (entry) confirmRemove(entry);
            },
          },
        ]}
      />
    </SafeAreaView>
  );
};

const makeStyles = (theme: Theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingTop: spacing.xs },
  list: { paddingHorizontal: spacing.s },
  progressWrap: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.s },
  progressText: { ...type.caption, color: theme.colors.inkMuted, fontVariant: ['tabular-nums' as const] },
  retryChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    minHeight: 32,
    paddingHorizontal: spacing.m,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.dangerSoft,
  },
  retryText: { ...type.caption, color: theme.colors.danger },
  errorHint: { ...type.footnote, color: theme.colors.danger, paddingHorizontal: spacing.l, paddingTop: spacing.s },
  clearFailed: { alignSelf: 'center' as const, marginTop: spacing.xl, minHeight: 44, justifyContent: 'center' as const, paddingHorizontal: spacing.xl },
  clearFailedText: { ...type.callout, fontWeight: '600' as const, color: theme.colors.inkSoft },
});

export default DownloadsScreen;
