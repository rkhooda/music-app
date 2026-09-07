import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownToLine, Pause } from 'lucide-react-native';
import { formatTime } from '../lib/format';
import { Theme, radius, spacing, type, useStyles, useTheme } from '../theme';
import { MusicTrack } from '../types/music';
import { Artwork } from './Artwork';
import { PlayingBars } from './PlayingBars';

interface TrackRowProps {
  track: MusicTrack;
  onPress: (track: MusicTrack) => void;
  onLongPress?: (track: MusicTrack) => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
  isLoading?: boolean;
  isDownloaded?: boolean;
  index?: number;
  trailing?: React.ReactNode;
}

const TrackRowComponent = ({ track, onPress, onLongPress, isCurrent, isPlaying, isLoading, isDownloaded, index, trailing }: TrackRowProps) => {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { colors } = theme;

  const status = isLoading ? (
    <ActivityIndicator size="small" color={colors.accentStrong} />
  ) : isCurrent ? (
    isPlaying ? (
      <PlayingBars color={colors.accentStrong} active />
    ) : (
      <Pause size={16} color={colors.accentStrong} fill={colors.accentStrong} strokeWidth={2} />
    )
  ) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${track.title} by ${track.artist}`}
      onPress={() => onPress(track)}
      onLongPress={onLongPress ? () => onLongPress(track) : undefined}
      android_ripple={{ color: colors.line }}
      style={({ pressed }) => [styles.row, isCurrent && styles.rowActive, pressed && styles.rowPressed]}
    >
      {typeof index === 'number' ? <Text style={[styles.index, isCurrent && styles.indexActive]}>{index + 1}</Text> : null}
      <Artwork uri={track.thumbnail} size={48} />
      <View style={styles.meta}>
        <Text style={[styles.title, isCurrent && styles.titleActive]} numberOfLines={1}>
          {track.title}
        </Text>
        <View style={styles.subtitleRow}>
          {isDownloaded ? <ArrowDownToLine size={12} color={colors.success} strokeWidth={2.4} /> : null}
          <Text style={styles.subtitle} numberOfLines={1}>
            {track.artist}
            {track.duration ? `  ·  ${formatTime(track.duration)}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.trailing}>
        {status}
        {trailing}
      </View>
    </Pressable>
  );
};

export const TrackRow = memo(TrackRowComponent);

const makeStyles = (theme: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 64,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    borderRadius: radius.m,
    gap: spacing.m,
  },
  rowActive: { backgroundColor: theme.dark ? 'rgba(220, 171, 112, 0.10)' : 'rgba(212, 165, 116, 0.14)' },
  rowPressed: { opacity: 0.75 },
  index: { width: 22, textAlign: 'center' as const, ...type.callout, color: theme.colors.inkMuted, fontVariant: ['tabular-nums' as const] },
  indexActive: { color: theme.colors.accentStrong },
  meta: { flex: 1, gap: 3 },
  title: { ...type.body, fontWeight: '600' as const, color: theme.colors.ink },
  titleActive: { color: theme.colors.accentStrong },
  subtitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  subtitle: { ...type.footnote, color: theme.colors.inkMuted, flexShrink: 1 },
  trailing: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.s, minWidth: 24, justifyContent: 'flex-end' as const },
});

export const trackRowStyles = StyleSheet.create({});
