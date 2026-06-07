import { HapticTab } from '@/components/haptic-tab';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function tabIcon(
  inactive: React.ComponentProps<typeof Ionicons>['name'],
  active: React.ComponentProps<typeof Ionicons>['name'],
) {
  function TabBarIcon({ color, focused }: { color: string; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={focused ? 24 : 22} color={color} />;
  }

  return TabBarIcon;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const theme = useFinancialTheme();
  const tabBarBottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: '#F9FAFB' },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: 58 + tabBarBottom,
          paddingBottom: tabBarBottom,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarLabel: 'Início',
          tabBarAccessibilityLabel: 'Ir para início',
          tabBarIcon: tabIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="extrato"
        options={{
          title: 'Extrato',
          tabBarLabel: 'Extrato',
          tabBarAccessibilityLabel: 'Ir para extrato',
          tabBarIcon: tabIcon('receipt-outline', 'receipt'),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Resumo',
          tabBarLabel: 'Resumo',
          tabBarAccessibilityLabel: 'Ir para resumo financeiro',
          tabBarIcon: tabIcon('pie-chart-outline', 'pie-chart'),
        }}
      />
      <Tabs.Screen
        name="metas"
        options={{
          title: 'Metas',
          tabBarLabel: 'Metas',
          tabBarAccessibilityLabel: 'Ir para metas',
          tabBarIcon: tabIcon('flag-outline', 'flag'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Usuário',
          tabBarLabel: 'Usuário',
          tabBarAccessibilityLabel: 'Ir para usuário e configurações',
          tabBarIcon: tabIcon('person-outline', 'person'),
        }}
      />

      {/* Telas sem tab visível */}
      <Tabs.Screen name="compare"      options={{ href: null }} />
      <Tabs.Screen name="credit-cards" options={{ href: null }} />
      <Tabs.Screen name="boleto-scanner" options={{ href: null }} />
      <Tabs.Screen name="split-expenses" options={{ href: null }} />
      <Tabs.Screen name="geo-reminders" options={{ href: null }} />
      <Tabs.Screen name="totp-setup"   options={{ href: null }} />
      <Tabs.Screen name="profile-edit" options={{ href: null }} />
      <Tabs.Screen name="simulator"    options={{ href: null }} />
      <Tabs.Screen name="challenges"   options={{ href: null }} />
      <Tabs.Screen name="loans"        options={{ href: null }} />
      <Tabs.Screen name="debug"        options={{ href: null }} />
    </Tabs>
  );
}
