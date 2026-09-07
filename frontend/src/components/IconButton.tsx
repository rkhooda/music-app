import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { hit, useTheme } from '../theme';

interface IconButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  label: string;
  size?: number;
  variant?: 'plain' | 'surface' | 'accent';
  disabled?: boolean;
  style?: ViewStyle;
}

/** 44pt-minimum circular tap target with a subtle press state. */
export const IconButton = ({ children, onPress, label, size = hit.min, variant = 'plain', disabled, style }: IconButtonProps) => {
  const { colors } = useTheme();
  const background = variant === 'surface' ? colors.surfaceStrong : variant === 'accent' ? colors.accent : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      android_ripple={{ color: colors.line, borderless: true, radius: size / 2 }}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        variant === 'surface' && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.4 },
});
