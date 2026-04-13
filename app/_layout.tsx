import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-get-random-values';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { FinanceProvider } from '@/context/FinanceContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, totpRequired } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => { 
    routerRef.current = router; 
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!user && !totpRequired) {
      // 1. Não está logado -> Vai para o login (se já não estiver lá)
      if (!inAuthGroup) {
        routerRef.current.replace('/(auth)/login');
      }
    } else if (totpRequired) {
      // 2. Precisa do TOTP -> Vai para o login digitar o código (se já não estiver lá)
      if (!inAuthGroup) {
        routerRef.current.replace('/(auth)/login');
      }
    } else if (user && !totpRequired) {
      // 3. Logado e tudo OK -> Vai para as abas do app (se já não estiver lá)
      // Isso resolve o erro da tela preta na raiz!
      if (!inAppGroup) {
        routerRef.current.replace('/(app)/(tabs)');
      }
    }

  }, [user, loading, totpRequired, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1565C0' }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>Lock</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 24 }}>Cofre Digital</Text>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <FinanceProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthGate>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(app)"  options={{ headerShown: false }} />
              <Stack.Screen name="modal"  options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </AuthGate>
          <StatusBar style="auto" />
        </ThemeProvider>
      </FinanceProvider>
    </AuthProvider>
  );
}