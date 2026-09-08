import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { fetchHealth, getAutoApiOrigin } from '../api/client';
import { DevPerfBadge } from '../components/DevPerfBadge';
import { ScreenHeader } from '../components/ScreenHeader';
import { useChromeInset } from '../components/AppChrome';
import { formatBytes, pluralize } from '../lib/format';
import { selectDownloadedBytes, selectDownloadedTracks, useDownloadsStore } from '../store/downloads.store';
import { useSearchStore } from '../store/search.store';
import { useSettingsStore } from '../store/settings.store';
import { Theme, radius, shadow, spacing, type, useStyles, useTheme } from '../theme';

const Row = ({ label, value, onPress, destructive }: { label: string; value?: React.ReactNode; onPress?: () => void; destructive?: boolean }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} android_ripple={{ color: colors.line }} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.rowLabel, destructive && { color: colors.danger }, onPress && !destructive && { color: colors.accentStrong }]}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}
    </Pressable>
  );
};

const SettingsScreen = () => {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const bottomInset = useChromeInset();
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, staleTime: 10_000, refetchOnMount: 'always' });
  const downloadedTracks = useDownloadsStore(selectDownloadedTracks);
  const downloadedBytes = useDownloadsStore(selectDownloadedBytes);
  const order = useDownloadsStore((s) => s.order);
  const remove = useDownloadsStore((s) => s.remove);
  const clearSearchHistory = useSearchStore((s) => s.clearSearchHistory);
  const historyCount = useSearchStore((s) => s.searchHistory.length);
  const backendUrl = useSettingsStore((s) => s.backendUrl);
  const setBackendUrl = useSettingsStore((s) => s.setBackendUrl);
  const [draftUrl, setDraftUrl] = useState(backendUrl);

  const commitBackendUrl = () => {
    const origin = setBackendUrl(draftUrl);
    setDraftUrl(origin ?? '');
    void health.refetch();
  };

  const reachable = health.isSuccess;
  const statusColor = health.isPending ? theme.colors.inkMuted : reachable && health.data.ytDlp.ok ? theme.colors.success : theme.colors.danger;
  const statusText = health.isPending
    ? 'Checking…'
    : health.isError
      ? 'Unreachable'
      : health.data.ytDlp.ok
        ? 'Connected'
        : 'yt-dlp not ready';

  const deleteAllDownloads = () => {
    Alert.alert('Delete all downloads?', `${pluralize(downloadedTracks.length, 'song')} (${formatBytes(downloadedBytes)}) will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: () => order.forEach((id) => void remove(id)) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Settings" large />

        <Text style={styles.sectionTitle}>Backend</Text>
        <View style={styles.card}>
          <Row
            label="Status"
            value={
              <View style={styles.statusWrap}>
                {health.isFetching ? <ActivityIndicator size="small" color={theme.colors.inkMuted} /> : <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
                <Text style={[styles.rowValue, { color: statusColor }]}>{statusText}</Text>
              </View>
            }
          />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Address</Text>
            <TextInput
              value={draftUrl}
              onChangeText={setDraftUrl}
              onBlur={commitBackendUrl}
              onSubmitEditing={commitBackendUrl}
              placeholder={getAutoApiOrigin()}
              placeholderTextColor={theme.colors.inkMuted}
              style={styles.addressInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              accessibilityLabel="Backend address"
            />
          </View>
          {health.isSuccess ? (
            <>
              <Row label="Search" value={health.data.search === 'youtube-data-api' ? 'YouTube Data API' : 'yt-dlp (slower, set API key)'} />
              <Row label="yt-dlp" value={health.data.ytDlp.version ?? health.data.ytDlp.error ?? '—'} />
              <Row
                label="Stream cache"
                value={`${health.data.cache.cached} ready · ${health.data.cache.hits} hits / ${health.data.cache.misses} misses`}
              />
            </>
          ) : null}
          <Row label="Check again" onPress={() => void health.refetch()} />
        </View>
        <Text style={styles.hint}>
          {backendUrl
            ? `Using ${backendUrl}. Clear the field to auto-detect (${getAutoApiOrigin()}).`
            : 'Auto-detecting the machine that serves the app. Enter a Tailscale or LAN address (e.g. 100.64.1.2:3000) to use a phone or server running the backend.'}
        </Text>

        <Text style={styles.sectionTitle}>Storage</Text>
        <View style={styles.card}>
          <Row label="Downloads" value={`${pluralize(downloadedTracks.length, 'song')} · ${formatBytes(downloadedBytes)}`} />
          <Row label="Delete all downloads" onPress={downloadedTracks.length > 0 ? deleteAllDownloads : undefined} destructive={downloadedTracks.length > 0} />
        </View>

        <Text style={styles.sectionTitle}>Search</Text>
        <View style={styles.card}>
          <Row label="Clear recent searches" value={historyCount > 0 ? String(historyCount) : undefined} onPress={historyCount > 0 ? clearSearchHistory : undefined} />
        </View>

        {__DEV__ ? (
          <>
            <Text style={styles.sectionTitle}>Development</Text>
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.m }]}>
              <DevPerfBadge />
              <Text style={styles.hint}>Last tap → audio measurement. Full timings print in the Metro console as [perf].</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.footer}>
          {Constants.expoConfig?.name ?? 'Music'} {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (theme: Theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingTop: spacing.s },
  sectionTitle: { ...type.eyebrow, color: theme.colors.inkMuted, paddingHorizontal: spacing.xl + spacing.s, marginTop: spacing.xl, marginBottom: spacing.s },
  card: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.l,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden' as const,
    ...shadow(theme, 'soft'),
  },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, minHeight: 48, paddingHorizontal: spacing.l, gap: spacing.l },
  rowLabel: { ...type.body, color: theme.colors.ink },
  rowValue: { ...type.footnote, color: theme.colors.inkMuted, flexShrink: 1, textAlign: 'right' as const },
  addressInput: { flex: 1, ...type.footnote, color: theme.colors.ink, textAlign: 'right' as const, paddingVertical: 0, minHeight: 44 },
  statusWrap: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.s },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  hint: { ...type.footnote, color: theme.colors.inkMuted, paddingHorizontal: spacing.xl + spacing.s, paddingTop: spacing.s, lineHeight: 18 },
  footer: { ...type.caption, color: theme.colors.inkMuted, textAlign: 'center' as const, marginTop: spacing.xxxl },
});

export default SettingsScreen;
