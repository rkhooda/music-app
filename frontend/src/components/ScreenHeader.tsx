import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { Theme, spacing, type, useStyles, useTheme } from '../theme';
import { IconButton } from './IconButton';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  large?: boolean;
  back?: boolean;
  right?: React.ReactNode;
}

export const ScreenHeader = ({ title, subtitle, large, back, right }: ScreenHeaderProps) => {
  const navigation = useNavigation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {back ? (
        <IconButton label="Back" onPress={() => navigation.goBack()} variant="surface" size={40}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </IconButton>
      ) : null}
      <View style={styles.text}>
        <Text style={large ? styles.largeTitle : styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
};

const makeStyles = (theme: Theme) => ({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
    gap: spacing.m,
    minHeight: 56,
  },
  text: { flex: 1, gap: 2 },
  largeTitle: { ...type.largeTitle, color: theme.colors.ink },
  title: { ...type.title, color: theme.colors.ink },
  subtitle: { ...type.footnote, color: theme.colors.inkMuted },
  right: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
});
