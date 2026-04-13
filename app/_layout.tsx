import 'react-native-get-random-values';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { FinanceProvider } from '@/context/FinanceContext';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, totpRequired } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; });

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';
    const inApp  = segments[0] === '(app)';

    // Sem usuário e sem TOTP pendente → vai para login
    if (!user && !totpRequired && !inAuth) {
      routerRef.current.replace('/(auth)/login' as any);
      return;
    }

    // TOTP pendente → fica na tela de login para digitar o código
    if (totpRequired && !inAuth) {
      routerRef.current.replace('/(auth)/login' as any);
      return;
    }

    // Logado e TOTP ok, ainda na área de auth → vai para o app
    if (user && !totpRequired && inAuth) {
      routerRef.current.replace('/(app)/(tabs)/index' as any);
      return;
    }

    // Já está no lugar certo → não faz nada

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, totpRequired, segments[0]]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1565C0" />
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
