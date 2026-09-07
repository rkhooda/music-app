import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowDownToLine, Check, Ellipsis, ImagePlus, Play, Plus, Search, Shuffle, Trash2, X } from 'lucide-react-native';
import { describeError, prefetchStreams, searchMusic } from '../api/client';
import { Artwork } from '../components/Artwork';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TrackActionsSheet } from '../components/TrackActionsSheet';
import { TrackRow } from '../components/TrackRow';
import { useChromeInset } from '../components/AppChrome';
import { pluralize } from '../lib/format';
import { RootStackParamList } from '../navigation/types';
import { useDownloadsStore } from '../store/downloads.store';
import { usePlayerStore } from '../store/player.store';
import { selectPlaylist, usePlaylistStore } from '../store/playlist.store';
import { Theme, radius, shadow, spacing, type, useStyles, useTheme } from '../theme';
import { MusicTrack } from '../types/music';

type DetailRoute = RouteProp<RootStackParamList, 'PlaylistDetail'>;

const PlaylistDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { playlistId } = useRoute<DetailRoute>().params;
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const bottomInset = useChromeInset();

  const playlist = usePlaylistStore(selectPlaylist(playlistId));
  const addTrackToPlaylist = usePlaylistStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = usePlaylistStore((s) => s.removeTrackFromPlaylist);
  const renamePlaylist = usePlaylistStore((s) => s.renamePlaylist);
  const setPlaylistCover = usePlaylistStore((s) => s.setPlaylistCover);
  const deletePlaylist = usePlaylistStore((s) => s.deletePlaylist);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const loadingTrackId = usePlayerStore((s) => s.loadingTrackId);
  const downloads = useDownloadsStore((s) => s.items);
  const enqueueMany = useDownloadsStore((s) => s.enqueueMany);

  const [showSearch, setShowSearch] = useState(false);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  // Warm the first few tracks so tapping "Play" feels instant.
  useEffect(() => {
    const ids = playlist?.tracks.slice(0, 3).map((track) => track.id) ?? [];
    if (ids.length) void prefetchStreams(ids, 'warm');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  const results = useQuery({
    queryKey: ['music-search', query.toLowerCase()],
    queryFn: ({ signal }) => searchMusic(query, signal),
    enabled: showSearch && query.length > 0,
  });

  if (!playlist) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Playlist" back />
        <EmptyState title="Playlist not found" actionLabel="Back to library" onAction={() => navigation.navigate('Library')} />
      </SafeAreaView>
    );
  }

  const tracks = playlist.tracks;
  const downloadedCount = tracks.filter((track) => downloads[track.id]?.status === 'done').length;
  const inProgress = tracks.filter((track) => ['queued', 'downloading'].includes(downloads[track.id]?.status ?? '')).length;
  const failedCount = tracks.filter((track) => downloads[track.id]?.status === 'failed').length;
  const allDownloaded = tracks.length > 0 && downloadedCount === tracks.length;

  const playAll = (random = false) => {
    if (tracks.length === 0) return;
    if (random !== shuffle) toggleShuffle();
    const first = random ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0];
    void playTrack(first, tracks);
  };

  const downloadAll = () => {
    const pending = tracks.filter((track) => downloads[track.id]?.status !== 'done');
    pending.filter((track) => downloads[track.id]?.status === 'failed').forEach((track) => useDownloadsStore.getState().retry(track.id));
    enqueueMany(pending);
  };

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos access needed', 'Allow photo access to pick a playlist cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) setPlaylistCover(playlistId, result.assets[0].uri);
  };

  const showMore = () => {
    Alert.alert(playlist.title, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          setRenameValue(playlist.title);
          setRenaming(true);
        },
      },
      { text: 'Change cover', onPress: () => void pickCover() },
      {
        text: 'Delete playlist',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete playlist?', 'Downloaded songs are kept.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { deletePlaylist(playlistId); navigation.navigate('Library'); } },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={playlist.title}
        subtitle={`${pluralize(tracks.length, 'song')}${downloadedCount > 0 ? ` · ${downloadedCount} offline` : ''}`}
        back
        right={
          <IconButton label="More" onPress={showMore} variant="surface" size={40}>
            <Ellipsis size={18} color={theme.colors.ink} strokeWidth={2.2} />
          </IconButton>
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.coverRow}>
          <Pressable onPress={() => void pickCover()} accessibilityLabel="Change cover" style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
            <Artwork uri={playlist.coverUri || tracks[0]?.thumbnail} size={132} radius={radius.l} style={styles.cover} />
            <View style={styles.coverBadge}>
              <ImagePlus size={14} color={theme.colors.ink} strokeWidth={2.2} />
            </View>
          </Pressable>
          <View style={styles.actions}>
            <Pressable onPress={() => playAll(false)} disabled={tracks.length === 0} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }, tracks.length === 0 && { opacity: 0.4 }]}>
              <Play size={16} color={theme.colors.onAccent} fill={theme.colors.onAccent} strokeWidth={2} />
              <Text style={styles.primaryButtonText}>Play</Text>
            </Pressable>
            <View style={styles.actionRow}>
              <IconButton label="Shuffle" onPress={() => playAll(true)} variant="surface" disabled={tracks.length === 0}>
                <Shuffle size={18} color={theme.colors.ink} strokeWidth={2.2} />
              </IconButton>
              <IconButton label={allDownloaded ? 'Downloaded' : 'Download all'} onPress={downloadAll} variant="surface" disabled={tracks.length === 0 || allDownloaded}>
                {inProgress > 0 ? (
                  <ActivityIndicator size="small" color={theme.colors.accentStrong} />
                ) : allDownloaded ? (
                  <Check size={18} color={theme.colors.success} strokeWidth={2.4} />
                ) : (
                  <ArrowDownToLine size={18} color={theme.colors.ink} strokeWidth={2.2} />
                )}
              </IconButton>
              <IconButton label={showSearch ? 'Close search' : 'Add songs'} onPress={() => setShowSearch((value) => !value)} variant={showSearch ? 'accent' : 'surface'}>
                {showSearch ? <X size={18} color={theme.colors.onAccent} strokeWidth={2.4} /> : <Plus size={18} color={theme.colors.ink} strokeWidth={2.4} />}
              </IconButton>
            </View>
            {inProgress > 0 || failedCount > 0 ? (
              <Text style={styles.downloadMeta}>
                {inProgress > 0 ? `Downloading ${downloadedCount + 1} of ${tracks.length}` : ''}
                {inProgress > 0 && failedCount > 0 ? ' · ' : ''}
                {failedCount > 0 ? `${failedCount} failed` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {showSearch ? (
          <View style={styles.searchBlock}>
            <View style={styles.field}>
              <Search size={18} color={theme.colors.inkMuted} strokeWidth={2} />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Search songs to add"
                placeholderTextColor={theme.colors.inkMuted}
                style={styles.input}
                selectionColor={theme.colors.accentStrong}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => setQuery(text.trim())}
              />
            </View>
            {query.length > 0 && results.isPending ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.colors.accentStrong} />
              </View>
            ) : null}
            {query.length > 0 && results.isError ? <Text style={styles.errorText}>{describeError(results.error)}</Text> : null}
            {(results.data ?? []).map((track) => {
              const added = tracks.some((item) => item.id === track.id);
              return (
                <TrackRow
                  key={track.id}
                  track={track}
                  onPress={(item) => void playTrack(item, results.data ?? [])}
                  isCurrent={currentTrackId === track.id}
                  isPlaying={isPlaying}
                  isLoading={loadingTrackId === track.id}
                  trailing={
                    <Pressable
                      onPress={() => !added && addTrackToPlaylist(playlistId, track)}
                      disabled={added}
                      accessibilityLabel={added ? 'Added' : 'Add to playlist'}
                      style={({ pressed }) => [styles.addChip, added && styles.addChipDone, pressed && { opacity: 0.7 }]}
                    >
                      {added ? <Check size={14} color={theme.colors.success} strokeWidth={2.6} /> : <Plus size={14} color={theme.colors.onAccent} strokeWidth={2.6} />}
                    </Pressable>
                  }
                />
              );
            })}
          </View>
        ) : null}

        {tracks.length === 0 && !showSearch ? (
          <EmptyState title="This playlist is empty" message="Add songs from search or long-press any song." actionLabel="Add songs" onAction={() => setShowSearch(true)} compact />
        ) : (
          <View style={styles.list}>
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                onPress={(item) => void playTrack(item, tracks)}
                onLongPress={setSheetTrack}
                isCurrent={currentTrackId === track.id}
                isPlaying={isPlaying}
                isLoading={loadingTrackId === track.id}
                isDownloaded={downloads[track.id]?.status === 'done'}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <TrackActionsSheet
        track={sheetTrack}
        onClose={() => setSheetTrack(null)}
        excludePlaylistId={playlistId}
        extraActions={[
          {
            label: 'Remove from playlist',
            icon: <Trash2 size={18} color={theme.colors.danger} strokeWidth={2.2} />,
            destructive: true,
            onPress: () => sheetTrack && removeTrackFromPlaylist(playlistId, sheetTrack.id),
          },
        ]}
      />

      {renaming ? (
        <View style={[StyleSheet.absoluteFill, styles.renameWrap]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }]} onPress={() => setRenaming(false)} />
          <View style={styles.renameDialog}>
            <Text style={styles.renameTitle}>Rename playlist</Text>
            <TextInput value={renameValue} onChangeText={setRenameValue} style={styles.input} autoFocus selectionColor={theme.colors.accentStrong} />
            <View style={styles.renameActions}>
              <Pressable onPress={() => setRenaming(false)} style={styles.renameButton}>
                <Text style={styles.renameCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  renamePlaylist(playlistId, renameValue);
                  setRenaming(false);
                }}
                style={[styles.renameButton, { backgroundColor: theme.colors.accent }]}
              >
                <Text style={styles.renameSave}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const makeStyles = (theme: Theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingTop: spacing.xs },
  coverRow: { flexDirection: 'row' as const, paddingHorizontal: spacing.xl, gap: spacing.l, alignItems: 'flex-start' as const },
  cover: { ...shadow(theme, 'card') },
  coverBadge: {
    position: 'absolute' as const,
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actions: { flex: 1, gap: spacing.m, paddingTop: spacing.xs },
  primaryButton: {
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.accent,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.s,
    ...shadow(theme, 'soft'),
  },
  primaryButtonText: { ...type.callout, fontWeight: '700' as const, color: theme.colors.onAccent },
  actionRow: { flexDirection: 'row' as const, gap: spacing.s },
  downloadMeta: { ...type.caption, fontWeight: '500' as const, color: theme.colors.inkMuted },
  searchBlock: { paddingHorizontal: spacing.s, marginTop: spacing.xl, gap: spacing.xs },
  field: {
    marginHorizontal: spacing.m,
    height: 46,
    borderRadius: radius.m,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.s,
  },
  input: { flex: 1, ...type.body, color: theme.colors.ink, paddingVertical: 0 },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' as const },
  errorText: { ...type.footnote, color: theme.colors.danger, paddingHorizontal: spacing.l, paddingVertical: spacing.s },
  addChip: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  addChipDone: { backgroundColor: theme.colors.surfaceMuted },
  list: { paddingHorizontal: spacing.s, marginTop: spacing.xl },
  renameWrap: { justifyContent: 'center' as const, padding: spacing.xxl },
  renameDialog: { backgroundColor: theme.colors.surfaceStrong, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.l, ...shadow(theme, 'float') },
  renameTitle: { ...type.title, color: theme.colors.ink },
  renameActions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: spacing.s },
  renameButton: { minHeight: 44, paddingHorizontal: spacing.xl, borderRadius: radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const },
  renameCancel: { ...type.callout, fontWeight: '600' as const, color: theme.colors.inkSoft },
  renameSave: { ...type.callout, fontWeight: '700' as const, color: theme.colors.onAccent },
});

export default PlaylistDetailScreen;
