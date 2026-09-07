import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useUserStore } from '../store/user.store';
import { Theme, radius, shadow, spacing, type, useStyles, useTheme } from '../theme';
import { Feeling } from '../types/music';

const { width } = Dimensions.get('window');

const moods: Array<{ id: Feeling; label: string; light: string; dark: string }> = [
  { id: 'chill', label: 'Chill', light: '#dfece8', dark: '#22302c' },
  { id: 'rap', label: 'Rap', light: '#eadfd6', dark: '#33271f' },
  { id: 'hardcore', label: 'Hardcore', light: '#eadfce', dark: '#35291a' },
  { id: 'love', label: 'Love', light: '#f1e2dd', dark: '#3a2626' },
];

const GreetingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const setFeeling = useUserStore((s) => s.setFeeling);
  const resetFeeling = useUserStore((s) => s.reset);
  const selected = useUserStore((s) => s.feeling);

  const title = useRef(new Animated.Value(0)).current;
  const grid = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    resetFeeling();
    Animated.stagger(140, [
      Animated.timing(title, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(grid, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [resetFeeling, title, grid]);

  const continueToHome = () => {
    if (!selected) setFeeling('freestyle');
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Animated.View style={[styles.header, { opacity: title, transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <Text style={styles.greeting}>Hola Rkxee</Text>
        <Text style={styles.subGreeting}>How are you feeling?</Text>
      </Animated.View>

      <Animated.View style={[styles.grid, { opacity: grid, transform: [{ translateY: grid.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }]}>
        {moods.map((mood) => {
          const active = selected === mood.id;
          return (
            <Pressable
              key={mood.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => (active ? resetFeeling() : setFeeling(mood.id))}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.dark ? mood.dark : mood.light, borderColor: active ? theme.colors.accentStrong : theme.colors.glassBorder, borderWidth: active ? 2 : 1 },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={styles.cardLabel}>{mood.label}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={continueToHome} style={({ pressed }) => [styles.continueButton, pressed && { opacity: 0.85 }]}>
          <Text style={styles.continueText}>{selected ? 'Continue' : "I'll freestyle"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (theme: Theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.bg, paddingHorizontal: spacing.xxxl, justifyContent: 'center' as const },
  header: { marginBottom: spacing.xxxl + spacing.l },
  greeting: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -1, color: theme.colors.ink },
  subGreeting: { fontSize: 26, fontWeight: '500' as const, color: theme.colors.inkMuted, marginTop: spacing.s },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'space-between' as const, rowGap: spacing.l },
  card: {
    width: (width - spacing.xxxl * 2 - spacing.l) / 2,
    aspectRatio: 1,
    borderRadius: radius.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...shadow(theme, 'card'),
  },
  cardLabel: { ...type.headline, color: theme.colors.ink, textTransform: 'uppercase' as const, letterSpacing: 1 },
  footer: { position: 'absolute' as const, bottom: spacing.xxxl + spacing.l, left: 0, right: 0, alignItems: 'center' as const },
  continueButton: {
    minHeight: 50,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...shadow(theme, 'card'),
  },
  continueText: { ...type.headline, color: theme.colors.onAccent },
});

export default GreetingScreen;
