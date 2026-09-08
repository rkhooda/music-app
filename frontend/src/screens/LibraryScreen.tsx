import React, { useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowDownToLine, ChevronRight, ListMusic, Plus } from 'lucide-react-native';
import { Artwork } from '../components/Artwork';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { useChromeInset } from '../components/AppChrome';
import { formatBytes, pluralize } from '../lib/format';
import { RootStackParamList } from '../navigation/types';
import { selectDownloadedBytes, selectDownloadedTracks, useDownloadsStore } from '../store/downloads.store';
import { usePlaylistStore } from '../store/playlist.store';
import { Theme, radius, shadow, spacing, type, useStyles, useTheme } from '../theme';

const CARD_SIZE = (Dimensions.get('window').width - spacing.xl * 2 - spacing.l) / 2;

const LibraryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const bottomInset = useChromeInset();
  const playlists = usePlaylistStore((s) => s.playlists);
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);
  const downloadedCount = useDownloadsStore((s) => selectDownloadedTracks(s).length);
  const downloadedBytes = useDownloadsStore(selectDownloadedBytes);
  const activeDownloads = useDownloadsStore((s) => s.order.filter((id) => ['queued', 'downloading'].includes(s.items[id]?.status)).length);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const confirmCreate = () => {
    const id = createPlaylist(name.trim() || `Playlist ${playlists.length + 1}`);
    setName('');
    setCreating(false);
    navigation.navigate('PlaylistDetail', { playlistId: id });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Library" large />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Downloads"
          onPress={() => navigation.navigate('Downloads')}
          style={({ pressed }) => [styles.downloadsCard, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.downloadsIcon}>
            <ArrowDownToLine size={20} color={theme.colors.onAccent} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Downloads</Text>
            <Text style={styles.cardMeta}>
              {downloadedCount > 0 ? `${pluralize(downloadedCount, 'song')} · ${formatBytes(downloadedBytes)}` : 'Available offline'}
              {activeDownloads > 0 ? ` · ${activeDownloads} in progress` : ''}
            </Text>
          </View>
          <ChevronRight size={18} color={theme.colors.inkMuted} strokeWidth={2.2} />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Playlists</Text>
          <Pressable onPress={() => setCreating(true)} hitSlop={8} accessibilityLabel="New playlist" style={styles.newButton}>
            <Plus size={16} color={theme.colors.accentStrong} strokeWidth={2.6} />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </View>

        {playlists.length === 0 ? (
          <EmptyState
            icon={<ListMusic size={32} color={theme.colors.inkMuted} strokeWidth={1.6} />}
            title="No playlists yet"
            message="Long-press any song to add it to a playlist, or create one here."
            actionLabel="Create playlist"
            onAction={() => setCreating(true)}
            compact
          />
        ) : (
          <View style={styles.grid}>
            {playlists.map((playlist) => (
              <Pressable
                key={playlist.id}
                accessibilityRole="button"
                accessibilityLabel={playlist.title}
                onPress={() => navigation.navigate('PlaylistDetail', { playlistId: playlist.id })}
                style={({ pressed }) => [styles.playlistCard, pressed && { opacity: 0.85 }]}
              >
                <Artwork uri={playlist.coverUri || playlist.tracks[0]?.thumbnail} size={CARD_SIZE} radius={radius.m} style={styles.playlistArt} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {playlist.title}
                </Text>
                <Text style={styles.cardMeta}>{pluralize(playlist.tracks.length, 'song')}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={creating} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setCreating(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.scrim }]} onPress={() => setCreating(false)} />
        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>New playlist</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Playlist name"
              placeholderTextColor={theme.colors.inkMuted}
              style={styles.dialogInput}
              selectionColor={theme.colors.accentStrong}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmCreate}
            />
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setCreating(false)} style={({ pressed }) => [styles.dialogButton, pressed && { opacity: 0.6 }]}>
                <Text style={styles.dialogCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmCreate} style={({ pressed }) => [styles.dialogButton, styles.dialogPrimary, pressed && { opacity: 0.8 }]}>
                <Text style={styles.dialogPrimaryText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const makeStyles = (theme: Theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingTop: spacing.s },
  downloadsCard: {
    marginHorizontal: spacing.xl,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.m,
    padding: spacing.m,
    borderRadius: radius.l,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    ...shadow(theme, 'soft'),
  },
  downloadsIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  cardTitle: { ...type.headline, color: theme.colors.ink },
  cardMeta: { ...type.footnote, color: theme.colors.inkMuted, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.m,
  },
  sectionTitle: { ...type.eyebrow, color: theme.colors.inkMuted },
  newButton: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, minHeight: 32, paddingHorizontal: spacing.s },
  newButtonText: { ...type.footnote, fontWeight: '700' as const, color: theme.colors.accentStrong },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, paddingHorizontal: spacing.xl, gap: spacing.l },
  playlistCard: { width: CARD_SIZE, gap: 4 },
  playlistArt: { marginBottom: spacing.xs, ...shadow(theme, 'soft') },
  backdrop: { ...StyleSheet.absoluteFill },
  dialogWrap: { flex: 1, justifyContent: 'center' as const, padding: spacing.xxl },
  dialog: {
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    ...shadow(theme, 'float'),
  },
  dialogTitle: { ...type.title, color: theme.colors.ink },
  dialogInput: {
    height: 48,
    borderRadius: radius.m,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: spacing.l,
    ...type.body,
    color: theme.colors.ink,
  },
  dialogActions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: spacing.s },
  dialogButton: { minHeight: 44, paddingHorizontal: spacing.xl, borderRadius: radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const },
  dialogPrimary: { backgroundColor: theme.colors.accent },
  dialogCancel: { ...type.callout, fontWeight: '600' as const, color: theme.colors.inkSoft },
  dialogPrimaryText: { ...type.callout, fontWeight: '700' as const, color: theme.colors.onAccent },
});

export default LibraryScreen;
