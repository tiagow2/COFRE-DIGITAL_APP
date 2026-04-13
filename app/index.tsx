// app/index.tsx
// Tela de entrada — exibe loading enquanto o AuthGate (_layout.tsx) decide
// para onde redirecionar o usuário (login ou app).
import React from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1565C0" />
    </View>
  );
}
