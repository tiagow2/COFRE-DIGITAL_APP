# Como Gerar o APK do Cofre Digital

## Pré-requisitos

1. Conta em https://expo.dev
2. Node.js instalado
3. EAS CLI instalado:

```bash
npm install -g eas-cli
```

## 1. Login no Expo

```bash
eas login
```

## 2. Configurar o projeto

Rode uma vez, se ainda não tiver configurado:

```bash
eas build:configure
```

## 3. Configurar Google Places para o APK

Para testar no Expo Go, crie `.env.local` na raiz do projeto:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:3000
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=SUA_CHAVE_GOOGLE_PLACES
```

Para o APK buildado pelo EAS, configure a mesma chave no ambiente `preview` do EAS:

```bash
eas env:create --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value SUA_CHAVE_GOOGLE_PLACES --environment preview --visibility plaintext
```

Se o app usar backend em nuvem no APK, configure também:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://sua-api.com --environment preview --visibility plaintext
```

Importante: o APK não lê o `.env.local` do seu computador. No APK, o valor é colocado durante o build usando as variáveis do EAS.

## 4. Gerar APK Instalável

```bash
eas build --platform android --profile preview
```

O build roda na nuvem da Expo. Ao terminar, você receberá um link para baixar o `.apk`.

## 5. Instalar no Celular

- Baixe o `.apk` gerado.
- No Android, permita instalação de apps de fonte externa, se necessário.
- Abra o arquivo `.apk` e instale.

## Produção

Para Play Store, normalmente o ideal é AAB, mas seu perfil atual está configurado como APK:

```bash
eas build --platform android --profile production
```

## Segurança da Chave Google

Chaves `EXPO_PUBLIC_*` ficam embutidas no app. Para reduzir risco de uso indevido, restrinja a chave no Google Cloud:

- Application restriction: Android apps.
- Package name: `com.tiago.cofredigital`.
- SHA-1: fingerprint do certificado usado pelo EAS/Play Store.
- API restriction: apenas Google Places API/Places API.

Se trocar a chave depois do build, gere outro APK.
