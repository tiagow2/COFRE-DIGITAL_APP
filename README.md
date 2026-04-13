# Cofre Digital

App feito com Expo, TypeScript e Firebase.

## Rodar o projeto

```bash
npm install
npx expo start
```

## Firebase

O projeto usa Firebase Auth para login e cadastro.

Antes de testar o cadastro, confira no Firebase Console:

- Authentication ativado
- Email/Senha habilitado
- `firebaseConfig` correto em `services/firebase.ts`

## Estrutura principal

- `app/` — telas e rotas do Expo Router
- `context/` — estado global de autenticação e finanças
- `services/firebase.ts` — configuração do Firebase
- `components/` — componentes reutilizáveis

## Observação

Se o Expo Go der problema de conexão, tente abrir com:

```bash
npx expo start --lan
```
