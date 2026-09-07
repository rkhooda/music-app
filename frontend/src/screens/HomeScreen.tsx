import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CloudOff, Search, Sparkles } from 'lucide-react-native';
import { API_ORIGIN, describeError, searchMusic } from '../api/client';
import { EmptyState } from '../components/EmptyState';
import { TrackActionsSheet } from '../components/TrackActionsSheet';
import { TrackRow } from '../components/TrackRow';
import { useChromeInset } from '../components/AppChrome';
import { RootStackParamList } from '../navigation/types';
import { useDownloadsStore } from '../store/downloads.store';
import { usePlayerStore } from '../store/player.store';
import { useUserStore } from '../store/user.store';
import { Theme, radius, shadow, spacing, type, useStyles, useTheme } from '../theme';
import { Feeling, MusicTrack } from '../types/music';

const suggestionMap: Record<Feeling, string> = {
  chill: 'lofi chill beats',
  rap: 'rap hits',
  hardcore: 'hardcore workout mix',
  love: 'romantic love songs',
  freestyle: 'top songs mix',
};

const moodPalette: Record<Feeling, { base: string; glow: string; accent: string }> = {
  chill: { base: '#dbe8e4', glow: '#eef5f1', accent: '#b7cbc3' },
  rap: { base: '#eadfd6', glow: '#f5eee8', accent: '#ceb7a6' },
  hardcore: { base: '#e7ddcd', glow: '#f2ebe0', accent: '#cfb494' },
  love: { base: '#efe0da', glow: '#f8eeea', accent: '#d5b2ac' },
  freestyle: { base: '#e7dfd1', glow: '#f3ede2', accent: '#cbbca4' },
};

const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const bottomInset = useChromeInset();
  const feeling = useUserStore((s) => s.feeling) || 'freestyle';
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const loadingTrackId = usePlayerStore((s) => s.loadingTrackId);
  const playerError = usePlayerStore((s) => s.error);
  const downloads = useDownloadsStore((s) => s.items);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);

  const query = suggestionMap[feeling];
  const suggestions = useQuery({ queryKey: ['music-search', query], queryFn: ({ signal }) => searchMusic(query, signal) });
  const tracks = suggestions.data ?? [];
  const moodLabel = feeling.charAt(0).toUpperCase() + feeling.slice(1);
  const palette = moodPalette[feeling];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{moodLabel} mode</Text>
          <Text style={styles.title}>{feeling === 'freestyle' ? 'Freestyle mix' : `${moodLabel} mix`}</Text>
        </View>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search songs"
          onPress={() => navigation.navigate('Search')}
          style={({ pressed }) => [styles.searchField, pressed && { opacity: 0.8 }]}
        >
          <Search size={18} color={theme.colors.inkMuted} strokeWidth={2} />
          <Text style={styles.searchPlaceholder}>Songs, artists, albums</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change mood"
          onPress={() => navigation.navigate('Greeting')}
          style={({ pressed }) => [styles.hero, { backgroundColor: theme.dark ? theme.colors.surfaceStrong : palette.base }, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.heroGlowLarge, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.05)' : palette.glow }]} />
          <View style={[styles.heroGlowSmall, { backgroundColor: theme.dark ? 'rgba(220,171,112,0.18)' : palette.accent }]} />
          <View style={styles.heroText}>
            <Sparkles size={16} color={theme.dark ? theme.colors.accent : theme.colors.inkSoft} strokeWidth={2} />
            <Text style={styles.heroTitle}>Picked for a {feeling} mood</Text>
            <Text style={styles.heroSubtitle}>Tap to change how you feel</Text>
          </View>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suggested</Text>
          {suggestions.isFetching && tracks.length > 0 ? <ActivityIndicator size="small" color={theme.colors.inkMuted} /> : null}
        </View>

        {playerError ? (
          <View style={styles.errorStrip}>
            <Text style={styles.errorText}>{playerError}</Text>
          </View>
        ) : null}

        {suggestions.isPending ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3, 4].map((index) => (
              <View key={index} style={styles.skeletonRow}>
                <View style={styles.skeletonArt} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skeletonLine, { width: `${70 - index * 6}%` }]} />
                  <View style={[styles.skeletonLine, { width: '40%' }]} />
                </View>
              </View>
            ))}
          </View>
        ) : suggestions.isError ? (
          <EmptyState
            tone="error"
            icon={<CloudOff size={28} color={theme.colors.danger} strokeWidth={1.8} />}
            title="Backend unreachable"
            message={`${describeError(suggestions.error)}\n${API_ORIGIN}`}
            actionLabel="Try again"
            onAction={() => void suggestions.refetch()}
          />
        ) : tracks.length === 0 ? (
          <EmptyState title="Nothing here yet" message="Try another mood or search for a song." compact />
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

      <TrackActionsSheet track={sheetTrack} onClose={() => setSheetTrack(null)} />
    </SafeAreaView>
  );
};

const makeStyles = (theme: Theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingTop: spacing.m },
  header: { paddingHorizontal: spacing.xl, gap: 4, marginBottom: spacing.l },
  eyebrow: { ...type.eyebrow, color: theme.colors.inkMuted },
  title: { ...type.largeTitle, color: theme.colors.ink },
  searchField: {
    marginHorizontal: spacing.xl,
    height: 48,
    borderRadius: radius.m,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.s,
    paddingHorizontal: spacing.l,
  },
  searchPlaceholder: { ...type.body, color: theme.colors.inkMuted },
  hero: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.l,
    height: 132,
    borderRadius: radius.l,
    overflow: 'hidden' as const,
    justifyContent: 'flex-end' as const,
    padding: spacing.l,
    ...shadow(theme, 'card'),
  },
  heroGlowLarge: { position: 'absolute' as const, width: 180, height: 180, borderRadius: 90, top: -70, right: -30 },
  heroGlowSmall: { position: 'absolute' as const, width: 110, height: 110, borderRadius: 55, bottom: -40, left: 40, opacity: 0.8 },
  heroText: { gap: 4 },
  heroTitle: { ...type.headline, color: theme.colors.ink },
  heroSubtitle: { ...type.footnote, color: theme.colors.inkSoft },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.s,
  },
  sectionTitle: { ...type.eyebrow, color: theme.colors.inkMuted },
  list: { paddingHorizontal: spacing.s },
  errorStrip: { marginHorizontal: spacing.xl, marginBottom: spacing.s, padding: spacing.m, borderRadius: radius.m, backgroundColor: theme.colors.dangerSoft },
  errorText: { ...type.footnote, color: theme.colors.danger },
  skeletonList: { paddingHorizontal: spacing.xl, gap: spacing.l, paddingTop: spacing.s },
  skeletonRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.m },
  skeletonArt: { width: 48, height: 48, borderRadius: 11, backgroundColor: theme.colors.surfaceMuted },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: theme.colors.surfaceMuted },
});

export default HomeScreen;
