# Backlog do Projeto Cofre Digital – Divisão em 3 Sprints

## Visão Geral

O **Cofre Digital** é um aplicativo de controle financeiro pessoal desenvolvido em React Native com Expo, com
30 requisitos funcionais e 10 não funcionais.  
As três sprints planejaram a base da aplicação, as funcionalidades essenciais de segurança, gestão financeira
e inteligência de dados. O aplicativo agora possui persistência local robusta, navegação ágil, backend isolado
e uma interface Premium e responsiva.

---

## Sprint 1 – Fundação da Aplicação *(13/04/2026)*

**Objetivo:** Autenticação segura, dashboard inicial e persistência local.

| Entregável                                      | RFs / RNFs atendidos         | Principais itens                                              |
|------------------------------------------------|------------------------------|---------------------------------------------------------------|
| Autenticação Firebase + 2FA (TOTP)             | RF1, RNF4                   | Login/cadastro, validação, recuperação de senha, indicador de força da senha, sessão persistente, ativação do Google Authenticator |
| Dashboard financeiro                           | RF4, RF7, RF27 (parcial)     | Saldo total, receitas/despesas do mês, ações rápidas, orçamentos com barra de progresso, últimas transações, mini-cards de cartões |
| Metas de economia e simulador de investimentos | RF6, RF15                   | Criação de metas, depósitos, progresso visual, projeção de conclusão, simulador (Poupança, CDB, Tesouro Direto) |
| Persistência local com AsyncStorage            | RNF2 (parcial)              | Dados isolados por UID do Firebase                            |

**Resultado:** O aplicativo já permitia cadastro, login seguro com 2FA, visualização do saldo, registro de
transações básicas e metas financeiras. Tudo funcionando offline com armazenamento local simples.

---

## Sprint 2 – Produção e Segurança *(09–10/05/2026)*

**Objetivo:** Migrar para banco de dados real, implementar assinatura digital, foto de comprovantes e
gerenciamento completo de cartões de crédito.

| Entregável                                      | RFs / RNFs atendidos         | Principais itens                                              |
|------------------------------------------------|------------------------------|---------------------------------------------------------------|
| Migração para SQLite + fila de sincronização   | RNF2, RNF8                   | Substituição do AsyncStorage pelo SQLite, tabelas com índices, fila de sync offline → online automática |
| Assinatura digital em transações > R$ 5.000    | RF2                          | Canvas de assinatura com `react-native-signature-canvas`, assinatura salva por usuário e validação simulada antes da autorização |
| Foto do comprovante (câmera)                   | RF3                          | `expo-image-picker` para capturar recibos, armazenamento base64 no SQLite, indicador visual no extrato |
| Cartões de crédito com alertas de limite       | RF9, RF11 (parcial)          | CRUD completo (local + backend), alerta via `Alert` quando uso atinge 80%, 90% ou 100% do limite |
| Extrato reformulado                            | RF8 (parcial)                | Filtros por categoria, busca textual, agrupamento mensal, modal detalhado com foto e status da assinatura |
| Onboarding pós-cadastro                        | (apoio ao fluxo)             | Configuração da renda mensal logo após o primeiro login        |
| Backend API (Node.js + Express + PostgreSQL)   | RNF3, RNF7 (parcial)        | Endpoints REST: `/api/sync`, `/api/regional-averages`, `/api/user/profile`; cálculo de médias regionais (ainda com dados estáticos no app) |
| UX e design system                             | RNF9 (parcial)              | Tema centralizado (`constants/theme.ts`), substituição de emojis por Ionicons, feedback tátil (expo-haptics), tipografia hierárquica |

**Resultado:** O app ganhou robustez com banco de dados real, funcionalidades de segurança (assinatura e
comprovante), gestão de cartões de crédito e um backend pronto para sincronização e dados regionais.

---

## Sprint 3 – Experiência Financeira Avançada *(Concluída)*

**Objetivo:** Finalizar funcionalidades complexas (Dívidas, Scanner, GPS), aplicar o polimento visual definitivo (Responsividade, Tema Dinâmico, Glassmorphism) e preparar para a nuvem.

### Entregas Realizadas

| Entregável                                     | RFs / RNFs     | Detalhamento                                                   |
|------------------------------------------------|----------------|----------------------------------------------------------------|
| Scanner de Boletos e PIX                       | RF16, RNF5     | Implementação da regra da Febraban para validar data e proibir boletos vencidos. Suporte à extração de valores via PIX (EMV QR Code). |
| Gestão de Dívidas e Financiamentos             | RF10           | CRUD em SQLite com proteção de pagamento: impede pagamento se não houver saldo ou limite no cartão, alertando sobre juros compostos. |
| Comparação de Média da Região Real             | RF19, RNF7     | Integração real com o backend. Substituição de dados mockados por validação real, resguardando total anonimato dos usuários (LGPD). |
| Tema Dinâmico e UI/UX Responsivo               | RF27, RNF9     | Cores globais do app mudam com o saldo. Implementação de `KeyboardAvoidingView` em todo o projeto. Cartões com sombras suaves. |
| Lembretes Geolocalizados (GPS)                 | RF17           | Integração com Nominatim (OSM) gratuita. Alertas visuais internos ao se aproximar de locais cadastrados. |
| Exportação do IR Inteligente                   | RF28           | Geração de arquivo estruturado para a Receita (simulação), agrupando Receitas e Gastos Dedutíveis do ano letivo. |
| Otimizações de Desempenho e Remoções           | RF8, RF12, RF29| Para manter a integridade acadêmica do app, falsos mocks como OCR visual e Importação OFX fake foram extraídos. |

**Resultado:** O Cofre Digital se transformou de um protótipo em um produto maduro, com lógicas financeiras reais (travas de saldo, cartões e dívidas interligados), visual limpo e preparado para a nuvem.

---

## Anexo – Status consolidado dos requisitos

*(Legenda: ✅ Concluído | 🚫 Removido do Escopo (Foco em dados reais))*

| ID    | Requisito                                              | Status |
|-------|--------------------------------------------------------|--------|
| RF1   | Cadastro e autenticação com múltiplos fatores          | ✅     |
| RF2   | Perfil financeiro com assinatura digital               | ✅     |
| RF3   | Registro de despesas/receitas com foto do comprovante  | ✅     |
| RF4   | Categorias de gastos inteligentes                      | ✅     |
| RF5   | Orçamentos flexíveis por período                       | ✅     |
| RF6   | Metas de economia com acompanhamento visual            | ✅     |
| RF7   | Dashboard interativo com widgets                       | ✅     |
| RF8   | Extrato completo com busca por voz                     | 🚫     |
| RF9   | Controle de cartões de crédito múltiplos com alertas   | ✅     |
| RF10  | Gerenciamento de empréstimos e dívidas                 | ✅     |
| RF11  | Notificações push personalizáveis (alertas in-app)     | ✅     |
| RF12  | Importação automática de extratos bancários (API mock) | 🚫     |
| RF13  | Relatórios anuais interativos                          | ✅     |
| RF14  | Divisão de despesas recorrentes em grupo               | ✅     |
| RF15  | Simulador de investimentos com cenários                | ✅     |
| RF16  | Scanner de código de barras de boletos                 | ✅     |
| RF17  | Lembretes geolocalizados de contas                     | ✅     |
| RF18  | Orçamento por projeto ou evento                        | ✅     |
| RF19  | Comparação de gastos com média da região               | ✅     |
| RF20  | Modo offline com sincronização seletiva                | ✅     |
| RF21  | Backup criptografado com senha mestra                  | ✅     |
| RF22  | Planejamento de aposentadoria com projeção             | ✅     |
| RF23  | Análise de fluxo de caixa futuro                       | ✅     |
| RF24  | Previsão de saldo com base em receitas futuras         | ✅     |
| RF25  | Categorias com ícones personalizáveis                  | ✅     |
| RF26  | Integração com contatos para cobranças                 | ✅     |
| RF27  | Tema dinâmico que muda conforme o saldo                | ✅     |
| RF28  | Exportação de dados para declaração de imposto de renda| ✅     |
| RF29  | Importação de despesas por foto (OCR simulado)         | 🚫     |
| RF30  | Desafios de economia gamificados                       | ✅     |

| RNF   | Requisito                                                          | Status |
|-------|--------------------------------------------------------------------|--------|
| RNF1  | React Native com Expo                                              | ✅     |
| RNF2  | Persistência com SQLite e criptografia                             | ✅     |
| RNF3  | Backend Node.js + Express + PostgreSQL                             | ✅     |
| RNF4  | Autenticação Firebase Auth com TOTP                                | ✅     |
| RNF5  | Scanner de código de barras                                        | ✅     |
| RNF6  | Reconhecimento de voz                                              | 🚫     |
| RNF7  | Dados anonimizados para médias regionais                           | ✅     |
| RNF8  | Funcionamento offline com sincronização                            | ✅     |
| RNF9  | UI moderna, temas e acessibilidade                                 | ✅     |
| RNF10 | Testes automatizados (Adiado para focar no APK)                    | 🚫     |

---

## 🚀 Como Rodar o Projeto Localmente (Expo)

Para visualizar o app no seu próprio computador ou no celular usando o aplicativo **Expo Go**:

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor do Expo (com limpeza de cache garantida):
   ```bash
   npx expo start -c
   ```
3. Escaneie o QR Code com o aplicativo Expo Go (Android) ou a câmera do celular (iOS).

---

## 📦 Como Gerar o App (APK e Play Store)

Para gerar o arquivo final do aplicativo, utilize o EAS (Expo Application Services):

1. Faça o login na sua conta do Expo (se ainda não tiver feito):
   ```bash
   eas login
   ```
2. **Gerar APK de Teste (.apk)** - *Para instalar direto no Android enviando via WhatsApp/Cabo:*
   ```bash
   eas build -p android --profile preview
   ```
3. **Gerar Arquivo de Produção (.aab)** - *Para publicar oficialmente na Google Play Store:*
   ```bash
   eas build -p android --profile production
   ```

---

## ☁️ Como Rodar o Backend (Média Regional e API)

O aplicativo vem acompanhado de uma pasta `backend` estruturada em Node.js e PostgreSQL, otimizada para implantação gratuita no Render.

Para hospedar gratuitamente:
1. Crie um banco PostgreSQL no Render.
2. Crie um Web Service no Render apontando para o seu GitHub, configurando o `Root Directory` como `backend`.
3. Defina os comandos `Build` (`npm install && npm run build`) e `Start` (`npm start`).
4. Copie a URL do seu backend gerada pelo Render e coloque no arquivo `.env` da raiz do aplicativo:
   `EXPO_PUBLIC_API_URL=https://seu-backend.onrender.com`
