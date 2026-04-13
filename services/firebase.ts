import { initializeApp, getApps } from 'firebase/app';
import { Platform } from 'react-native';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  reload,
  onAuthStateChanged,
  User,
} from '@firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBg_H_YNLf0VPk7BSsb7q12rHw4uIVmvlA",
  authDomain: "aplicativo-financas.firebaseapp.com",
  projectId: "aplicativo-financas",
  storageBucket: "aplicativo-financas.firebasestorage.app",
  messagingSenderId: "440217178907",
  appId: "1:440217178907:web:7411848d88a9279cfef9be",
  measurementId: "G-YS3RSZZGSX",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Usa persistência via AsyncStorage no React Native (v2 API)
export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : (() => {
        try {
          return initializeAuth(app, {
            persistence: getReactNativePersistence(ReactNativeAsyncStorage),
          });
        } catch {
          return getAuth(app);
        }
      })();

function getErrorMessage(code: string): string {
  const errors: Record<string, string> = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'Senha fraca. Use pelo menos 6 caracteres.',
    'auth/configuration-not-found': 'Firebase Auth não está configurado corretamente nesse projeto. Verifique se Authentication está ativado e se você copiou a configuração do projeto certo.',
    'auth/operation-not-allowed': 'Cadastro por e-mail/senha não está ativado no Firebase. Ative Authentication > Sign-in method > Email/Password.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    'auth/user-disabled': 'Esta conta foi desativada.',
  };
  return errors[code] ?? `Ocorreu um erro. Tente novamente. (${code || 'sem código'})`;
}

export const authService = {
  async register(name: string, email: string, password: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await reload(cred.user);
    return cred.user;
  },

  async login(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  onAuthChanged(cb: (user: User | null) => void) {
    return onAuthStateChanged(auth, cb);
  },

  getErrorMessage,
};

export default app;
