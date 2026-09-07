import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  DownloadsScreen,
  GreetingScreen,
  HomeScreen,
  LibraryScreen,
  PlayerScreen,
  PlaylistDetailScreen,
  SearchScreen,
  SettingsScreen,
} from '../screens';
import { useTheme } from '../theme';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'none',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Greeting" component={GreetingScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="Player"
        component={PlayerScreen}
        options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
      />
    </Stack.Navigator>
  );
};
