# Backlog do Projeto Cofre Digital – Divisão em 3 Sprints

## Visão Geral

O **Cofre Digital** é um aplicativo de controle financeiro pessoal desenvolvido em React Native com Expo, com
30 requisitos funcionais e 10 não funcionais.  
As duas primeiras sprints estabeleceram a base da aplicação e as funcionalidades essenciais de segurança e
gestão financeira. A terceira sprint (proposta) visa completar os itens parcialmente implementados e acrescentar
funcionalidades de alto valor percebido.

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

## Sprint 3 – Experiência Financeira Avançada *(proposta)*

**Objetivo:** Completar requisitos parcialmente implementados, adicionar funcionalidades de alto impacto visual e
prático, e iniciar cobertura de testes.

### Tarefas propostas

| Tarefa                                         | RFs / RNFs     | Justificativa / Detalhamento                                   |
|------------------------------------------------|----------------|----------------------------------------------------------------|
| Busca por voz no extrato                       | RF8            | Integrar `react-native-voice` para ativar microfone e filtrar transações por comando de voz. Baixo esforço, alto impacto em apresentações. |
| Orçamentos por período (semanal, trimestral)   | RF5            | A lógica de orçamento mensal já existe; basta parametrizar o período e ajustar os cálculos de progresso proporcionalmente. |
| Locais salvos com Google Places                | RF11           | Busca lugares próximos pelo Google Places e permite verificar manualmente se o usuário está perto de um local salvo. Sem notificações para manter compatibilidade com Expo Go. |
| Conexão da comparação regional com backend     | RF19, RNF7     | Usar a localização (GPS) para obter a cidade e consultar médias reais do backend. Substituir os dados estáticos da tela `compare.tsx`. |
| Tema dinâmico completo                         | RF27           | Com base no saldo, alterar cores de fundo, navbar e cards (verde para positivo, vermelho para negativo). Usar Context API para gerenciar o tema. |
| Gamificação dos desafios de economia           | RF30           | Aproveitar a estrutura de metas para criar desafios com progresso real e medalhas virtuais (pode ser apenas emblemas visuais). |
| Categorias com ícones personalizáveis          | RF25           | Permitir que o usuário escolha ícones alternativos para cada categoria (ex: lista de Ionicons disponíveis). |
| Fluxo de caixa futuro (12 meses)               | RF23, RF24     | Expandir o gráfico de 6 para 12 meses, considerando contas fixas (empréstimos) e receitas futuras cadastradas. |
| Testes unitários para cálculos financeiros     | RNF10          | Criar testes com Jest para funções críticas: `getBalance`, `getBudgetStatus`, `suggestCategory`, simulações de investimento. |

### Por que essas tarefas?

- **Completam itens já iniciados:** RF5, RF8, RF11, RF19, RF27, RF30, RF25, RF23, RNF10.  
- **Mantém o app funcional no Expo Go:** Notificações e monitoramento em background foram removidos; a tela de locais usa verificação manual de proximidade.  
- **Oferecem um salto de qualidade percebida:** Busca por voz, tema dinâmico e gamificação são diferenciais visuais imediatos para apresentações e avaliações.  
- **Trazem dados reais para a comparação regional:** O backend já está pronto, faltando apenas a integração com GPS e chamada à API.  
- **Iniciam a cobertura de testes:** Fundamental para garantir a estabilidade dos cálculos financeiros à medida que o app cresce.

### Resultado esperado

Ao final da Sprint 3, o aplicativo terá:

- Extrato com comando de voz funcional.
- Orçamentos flexíveis (semanal, trimestral, etc.).
- Notificações locais reais (em desenvolvimento ou preparadas para build).
- Comparação regional com dados do backend em tempo real.
- Tema que se adapta automaticamente ao saldo do usuário.
- Desafios de economia com progresso e recompensas visuais.
- Ícones de categoria customizáveis.
- Projeção financeira de 12 meses.
- Conjunto inicial de testes unitários.

---

## Anexo – Status consolidado dos requisitos

*(Incluído para referência rápida)*

| ID    | Requisito                                              | Status |
|-------|--------------------------------------------------------|--------|
| RF1   | Cadastro e autenticação com múltiplos fatores          | ✅     |
| RF2   | Perfil financeiro com assinatura digital               | ✅     |
| RF3   | Registro de despesas/receitas com foto do comprovante  | ✅     |
| RF4   | Categorias de gastos inteligentes                      | 🟡     |
| RF5   | Orçamentos flexíveis por período                        | ⚪     |
| RF6   | Metas de economia com acompanhamento visual            | ✅     |
| RF7   | Dashboard interativo com widgets                       | 🟡     |
| RF8   | Extrato completo com busca por voz                     | 🟡     |
| RF9   | Controle de cartões de crédito múltiplos com alertas   | ✅     |
| RF10  | Gerenciamento de empréstimos e dívidas                 | 🟡     |
| RF11  | Notificações push personalizáveis                      | 🟡     |
| RF12  | Importação automática de extratos bancários (API mock) | ⚪     |
| RF13  | Relatórios anuais interativos                          | ⚪     |
| RF14  | Divisão de despesas recorrentes em grupo               | ⚪     |
| RF15  | Simulador de investimentos com cenários                | ✅     |
| RF16  | Scanner de código de barras de boletos                 | ⚪     |
| RF17  | Lembretes geolocalizados de contas                     | ⚪     |
| RF18  | Orçamento por projeto ou evento                        | ⚪     |
| RF19  | Comparação de gastos com média da região               | 🟡     |
| RF20  | Modo offline com sincronização seletiva                | 🟡     |
| RF21  | Backup criptografado com senha mestra                  | 🟡     |
| RF22  | Planejamento de aposentadoria com projeção             | ✅     |
| RF23  | Análise de fluxo de caixa futuro                       | 🟡     |
| RF24  | Previsão de saldo com base em receitas futuras         | ⚪     |
| RF25  | Categorias com ícones personalizáveis                  | 🟡     |
| RF26  | Integração com contatos para cobranças                 | ⚪     |
| RF27  | Tema dinâmico que muda conforme o saldo                | 🟡     |
| RF28  | Exportação de dados para declaração de imposto de renda| ⚪     |
| RF29  | Importação de despesas por foto (OCR simulado)         | ⚪     |
| RF30  | Desafios de economia gamificados                       | 🟡     |

| RNF   | Requisito                                                          | Status |
|-------|--------------------------------------------------------------------|--------|
| RNF1  | React Native com Expo                                              | ✅     |
| RNF2  | Persistência com SQLite e criptografia                             | ✅     |
| RNF3  | Backend Node.js + Express + PostgreSQL                             | ✅     |
| RNF4  | Autenticação Firebase Auth com TOTP                                | ✅     |
| RNF5  | Scanner de código de barras                                        | ⚪     |
| RNF6  | Reconhecimento de voz                                              | ⚪     |
| RNF7  | Dados anonimizados para médias regionais                           | 🟡     |
| RNF8  | Funcionamento offline com sincronização                            | ✅     |
| RNF9  | UI moderna, temas e acessibilidade                                 | 🟡     |
| RNF10 | Testes automatizados                                               | ⚪     |
