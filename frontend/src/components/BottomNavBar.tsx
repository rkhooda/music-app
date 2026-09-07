import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { House, Library, Search, Settings } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/types';
import { Theme, radius, shadow, spacing, useStyles, useTheme } from '../theme';

export const NAV_BAR_HEIGHT = 60;

type TabRoute = 'Home' | 'Search' | 'Library' | 'Settings';

const TABS: Array<{ route: TabRoute; label: string; Icon: typeof House }> = [
  { route: 'Home', label: 'Home', Icon: House },
  { route: 'Search', label: 'Search', Icon: Search },
  { route: 'Library', label: 'Library', Icon: Library },
  { route: 'Settings', label: 'Settings', Icon: Settings },
];

/** Which tab a given route belongs to (detail screens light up their parent tab). */
const tabFor = (route: string): TabRoute | null => {
  if (route === 'PlaylistDetail' || route === 'Downloads' || route === 'Library') return 'Library';
  if (route === 'Home' || route === 'Search' || route === 'Settings') return route;
  return null;
};

interface BottomNavBarProps {
  routeName: string;
}

export const BottomNavBar = ({ routeName }: BottomNavBarProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const activeTab = tabFor(routeName);

  useEffect(() => {
    if (!width) return;
    const index = TABS.findIndex((tab) => tab.route === activeTab);
    if (index < 0) return;
    const slot = width / TABS.length;
    Animated.spring(indicatorX, { toValue: slot * index + slot / 2 - 3, useNativeDriver: true, damping: 16, stiffness: 220, mass: 0.7 }).start();
  }, [activeTab, width, indicatorX]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <Animated.View style={[styles.indicator, { transform: [{ translateX: indicatorX }] }]} />
        {TABS.map(({ route, label, Icon }) => {
          const active = route === activeTab;
          return (
            <Pressable
              key={route}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => navigation.navigate(route)}
              android_ripple={{ color: theme.colors.line, borderless: true, radius: 28 }}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
            >
              <Icon size={23} strokeWidth={active ? 2.3 : 1.9} color={active ? theme.colors.ink : theme.colors.inkMuted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (theme: Theme) => ({
  wrapper: { paddingHorizontal: spacing.l },
  bar: {
    height: NAV_BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    ...shadow(theme, 'float'),
  },
  tab: { flex: 1, height: NAV_BAR_HEIGHT, alignItems: 'center' as const, justifyContent: 'center' as const },
  indicator: { position: 'absolute' as const, bottom: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accentStrong },
});
