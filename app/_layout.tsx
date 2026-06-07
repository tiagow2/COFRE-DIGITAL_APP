import 'react-native-get-random-values';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { FinanceProvider } from '@/context/FinanceContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, totpRequired } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const routerRef = useRef(router);
  const rootSegment = (segments as string[])[0];

  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => {
    if (loading) return;
    if (!rootSegment) return;

    const inAuth = rootSegment === '(auth)';
    const inApp  = rootSegment === '(app)';

    if (!user && !totpRequired && !inAuth) {
      routerRef.current.replace('/(auth)/login');
      return;
    }
    if (totpRequired && !inAuth) {
      routerRef.current.replace('/(auth)/login');
      return;
    }
    if (user && !totpRequired && !inApp) {
      routerRef.current.replace('/(app)/(tabs)');
      return;
    }
  }, [user, loading, totpRequired, rootSegment]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1565C0' }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
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
              <Stack.Screen name="index"  options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(app)"  options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
          <StatusBar style="auto" />
        </ThemeProvider>
      </FinanceProvider>
    </AuthProvider>
  );
}
