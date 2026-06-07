# Como gerar o APK do Cofre Digital

## Pré-requisitos

1. Conta gratuita em [expo.dev](https://expo.dev)
2. Node.js instalado
3. EAS CLI instalado:

```bash
npm install -g eas-cli
```

## Passos para gerar o APK

### 1. Login no Expo

```bash
eas login
```

### 2. Configurar o projeto (apenas uma vez)

```bash
eas build:configure
```

### 3. Gerar o APK (preview = APK instalável)

```bash
eas build --platform android --profile preview
```

O build leva cerca de **5-10 minutos** na nuvem. Ao terminar, você receberá um link para baixar o `.apk` diretamente.

### 4. Instalar no celular

- Baixe o `.apk` gerado
- No Android: Configurações → Segurança → **Fontes desconhecidas** (ativar)
- Abra o arquivo `.apk` e instale

## Build de produção (AAB para Play Store)

```bash
eas build --platform android --profile production
```

## Notas

- O `eas.json` já está configurado com `"buildType": "apk"` no perfil `preview`
- O `app.json` já tem `package: "com.tiago.cofredigital"` e todas as permissões
- O projeto já inclui os plugins necessários para o fluxo atual, incluindo câmera e localização.
- Notificações foram removidas para manter o app funcionando no Expo Go.
