import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Clock, CloudOff, Search, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { describeError, searchMusic } from '../api/client';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { TrackActionsSheet } from '../components/TrackActionsSheet';
import { TrackRow } from '../components/TrackRow';
import { useChromeInset } from '../components/AppChrome';
import { useDownloadsStore } from '../store/downloads.store';
import { usePlayerStore } from '../store/player.store';
import { useSearchStore } from '../store/search.store';
import { Theme, radius, spacing, type, useStyles, useTheme } from '../theme';
import { MusicTrack } from '../types/music';

const DEBOUNCE_MS = 300;

const SearchScreen = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const bottomInset = useChromeInset();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const loadingTrackId = usePlayerStore((s) => s.loadingTrackId);
  const playerError = usePlayerStore((s) => s.error);
  const downloads = useDownloadsStore((s) => s.items);
  const { searchHistory, addSearchQuery, removeSearchQuery, clearSearchHistory } = useSearchStore();

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useQuery({
    queryKey: ['music-search', query.toLowerCase()],
    queryFn: ({ signal }) => searchMusic(query, signal),
    enabled: query.length > 0,
  });
  const tracks = results.data ?? [];

  const submit = (value: string) => {
    setText(value);
    setQuery(value.trim());
    Keyboard.dismiss();
  };

  const handlePlay = (track: MusicTrack) => {
    if (query) addSearchQuery(query);
    Keyboard.dismiss();
    void playTrack(track, tracks);
  };

  const showHistory = query.length === 0 && searchHistory.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton label="Back" onPress={() => navigation.goBack()} size={40}>
          <ChevronLeft size={22} color={theme.colors.ink} strokeWidth={2.4} />
        </IconButton>
        <View style={styles.field}>
          <Search size={18} color={theme.colors.inkMuted} strokeWidth={2} />
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => submit(text)}
            placeholder="Songs, artists, albums"
            placeholderTextColor={theme.colors.inkMuted}
            style={styles.input}
            selectionColor={theme.colors.accentStrong}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search"
          />
          {text.length > 0 ? (
            <Pressable onPress={() => submit('')} hitSlop={10} accessibilityLabel="Clear search">
              <X size={18} color={theme.colors.inkMuted} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {playerError ? (
          <View style={styles.errorStrip}>
            <Text style={styles.errorText}>{playerError}</Text>
          </View>
        ) : null}

        {showHistory ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <Pressable onPress={clearSearchHistory} hitSlop={8} accessibilityLabel="Clear recent searches">
                <Text style={styles.sectionAction}>Clear</Text>
              </Pressable>
            </View>
            {searchHistory.map((item) => (
              <Pressable
                key={item}
                onPress={() => submit(item)}
                android_ripple={{ color: theme.colors.line }}
                style={({ pressed }) => [styles.historyRow, pressed && { opacity: 0.6 }]}
              >
                <Clock size={16} color={theme.colors.inkMuted} strokeWidth={2} />
                <Text style={styles.historyText} numberOfLines={1}>
                  {item}
                </Text>
                <Pressable onPress={() => removeSearchQuery(item)} hitSlop={12} accessibilityLabel={`Remove ${item}`} style={styles.historyRemove}>
                  <X size={16} color={theme.colors.inkMuted} strokeWidth={2} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : null}

        {query.length > 0 && results.isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.accentStrong} />
            <Text style={styles.loadingText}>Searching…</Text>
          </View>
        ) : null}

        {query.length > 0 && results.isError ? (
          <EmptyState
            tone="error"
            icon={<CloudOff size={28} color={theme.colors.danger} strokeWidth={1.8} />}
            title="Search failed"
            message={describeError(results.error)}
            actionLabel="Try again"
            onAction={() => void results.refetch()}
          />
        ) : null}

        {query.length > 0 && results.isSuccess && tracks.length === 0 ? (
          <EmptyState icon={<Search size={32} color={theme.colors.inkMuted} strokeWidth={1.6} />} title="No results" message={`Nothing matched “${query}”.`} />
        ) : null}

        {query.length > 0 && tracks.length > 0 ? (
          <View style={styles.list}>
            {tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                onPress={handlePlay}
                onLongPress={setSheetTrack}
                isCurrent={currentTrackId === track.id}
                isPlaying={isPlaying}
                isLoading={loadingTrackId === track.id}
                isDownloaded={downloads[track.id]?.status === 'done'}
              />
            ))}
          </View>
        ) : null}

        {query.length === 0 && searchHistory.length === 0 ? (
          <EmptyState icon={<Search size={32} color={theme.colors.inkMuted} strokeWidth={1.6} />} title="Find something to play" message="Search for songs, artists or albums." />
        ) : null}
      </ScrollView>

      <TrackActionsSheet track={sheetTrack} onClose={() => setSheetTrack(null)} />
    </SafeAreaView>
  );
};

const makeStyles = (theme: Theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: spacing.m, paddingVertical: spacing.s, gap: spacing.xs },
  field: {
    flex: 1,
    height: 46,
    borderRadius: radius.m,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.s,
    paddingHorizontal: spacing.l,
  },
  input: { flex: 1, ...type.body, color: theme.colors.ink, paddingVertical: 0 },
  content: { paddingTop: spacing.s },
  sectionHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: spacing.xl, paddingVertical: spacing.s },
  sectionTitle: { ...type.eyebrow, color: theme.colors.inkMuted },
  sectionAction: { ...type.footnote, color: theme.colors.accentStrong, fontWeight: '600' as const },
  historyRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.m, minHeight: 48, paddingHorizontal: spacing.xl },
  historyText: { flex: 1, ...type.body, color: theme.colors.ink },
  historyRemove: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: -spacing.s },
  list: { paddingHorizontal: spacing.s },
  loading: { alignItems: 'center' as const, paddingVertical: spacing.xxxl, gap: spacing.m },
  loadingText: { ...type.footnote, color: theme.colors.inkMuted },
  errorStrip: { marginHorizontal: spacing.xl, marginVertical: spacing.s, padding: spacing.m, borderRadius: radius.m, backgroundColor: theme.colors.dangerSoft },
  errorText: { ...type.footnote, color: theme.colors.danger },
});

export default SearchScreen;
