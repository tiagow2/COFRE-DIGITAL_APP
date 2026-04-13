// app/(app)/(tabs)/_layout.tsx
import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tint = '#1565C0';

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#888' : '#9CA3AF',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarIcon: () => null,
        tabBarLabel: route.name === 'index' ? 'Início'
          : route.name === 'explore'  ? 'Dashboard'
          : route.name === 'extrato'  ? 'Extrato'
          : route.name === 'metas'    ? 'Metas'
          : route.name === 'settings' ? 'Config'
          : route.name,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      })}
    >
      <Tabs.Screen name="index"    options={{ title: 'Início' }} />
      <Tabs.Screen name="explore"  options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="extrato"  options={{ title: 'Extrato' }} />
      <Tabs.Screen name="metas"    options={{ title: 'Metas' }} />
      <Tabs.Screen name="settings" options={{ title: 'Config' }} />

      <Tabs.Screen name="totp-setup" options={{ title: '2FA' }} />
      
      <Tabs.Screen name="debug" options={{ title: '🐛 Debug', href: null }} />

    </Tabs>
  );
}
