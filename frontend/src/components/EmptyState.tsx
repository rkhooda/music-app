import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Theme, radius, spacing, type, useStyles, useTheme } from '../theme';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
  compact?: boolean;
}

export const EmptyState = ({ icon, title, message, actionLabel, onAction, tone = 'neutral', compact }: EmptyStateProps) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={[styles.container, compact && styles.compact, tone === 'error' && styles.error]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          android_ripple={{ color: colors.line }}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const makeStyles = (theme: Theme) => ({
  container: {
    alignItems: 'center' as const,
    paddingVertical: spacing.xxxl + spacing.l,
    paddingHorizontal: spacing.xxl,
    gap: spacing.s,
  },
  compact: { paddingVertical: spacing.xl },
  error: {
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: radius.l,
    marginHorizontal: spacing.l,
    paddingVertical: spacing.xl,
  },
  icon: { marginBottom: spacing.s, opacity: 0.8 },
  title: { ...type.headline, color: theme.colors.ink, textAlign: 'center' as const },
  message: { ...type.callout, color: theme.colors.inkMuted, textAlign: 'center' as const, lineHeight: 20, maxWidth: 300 },
  action: {
    marginTop: spacing.m,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionText: { ...type.callout, fontWeight: '700' as const, color: theme.colors.onAccent },
});
