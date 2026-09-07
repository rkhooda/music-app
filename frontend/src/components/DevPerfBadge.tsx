import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePerfStore } from '../lib/perf';
import { useTheme } from '../theme';

/** Last tap→audio measurement. Development builds only. */
export const DevPerfBadge = () => {
  const last = usePerfStore((s) => s.last);
  const { colors } = useTheme();
  if (!__DEV__ || !last) return null;

  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.text, { color: colors.inkSoft }]}>
        tap→audio {last.tapToAudio}ms · {last.source}
        {last.tapToResolve !== null ? ` · resolve ${last.tapToResolve}ms` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  text: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
