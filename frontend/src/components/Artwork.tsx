import React, { useState } from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { Music } from 'lucide-react-native';
import { useTheme } from '../theme';

interface ArtworkProps {
  uri?: string;
  size: number;
  radius?: number;
  style?: ViewStyle;
}

/** Thumbnail with a quiet placeholder; never shows a broken-image glyph. */
export const Artwork = ({ uri, size, radius = Math.round(size * 0.22), style }: ArtworkProps) => {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;

  return (
    <View style={[{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }, style]}>
      {showImage ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <View style={styles.placeholder}>
          <Music size={Math.max(16, size * 0.38)} color={colors.inkMuted} strokeWidth={1.6} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
