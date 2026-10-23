# TASK-004: Gerenciamento Seguro de Sessão JWT e Rotas Protegidas no Mobile

## 1. Metadados
- **ID:** TASK-004
- **Épico / Módulo:** Mobile / Autenticação & Sessão
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
O aplicativo mobile precisa gerenciar a identidade do técnico de campo de forma segura e resiliente a falhas de rede. O token de acesso JWT e o refresh token devem ser armazenados em hardware seguro (`expo-secure-store`). O usuário deve permanecer autenticado mesmo após fechar o aplicativo e ter sua sessão renovada automaticamente, mas rotas protegidas não podem ser expostas se a sessão for inválida ou se o técnico for inativado.

---

## 3. Arquivos Impactados
- `mobile/src/features/auth/services/authStorage.ts` (Persistência segura com Expo SecureStore)
- `mobile/src/features/auth/services/authApi.ts` (Serviço de login, refresh e logout)
- `mobile/src/features/auth/context/AuthContext.tsx` (Provedor de estado global de sessão com Zustand / React Context)
- `mobile/src/infrastructure/http/apiClient.ts` (Interceptor Axios / Fetch para anexar Bearer token e tratar 401 silencioso)
- `mobile/src/app/(public)/login.tsx` (Tela de login do técnico com feedback de erro e estado offline)
- `mobile/src/app/(protected)/_layout.tsx` (Guard de navegação protegida)
- `mobile/__tests__/auth/authStorage.test.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** O técnico deve autenticar-se informando e-mail e senha válidos (RN-001, AC-AUTH).
- **RF-02:** Em caso de credenciais inválidas, a mensagem deve ser genérica sem revelar se o e-mail existe no sistema (AC-AUTH).
- **RF-03:** Em caso de usuário inativo, o login deve ser negado com orientação clara (RN-001, AC-AUTH).
- **RF-04:** Ao realizar logout, todos os tokens e dados sensíveis devem ser eliminados do dispositivo e as rotas protegidas bloqueadas (RN-007, AC-AUTH).
- **RF-05:** Quando o token de acesso expirar durante uma operação protegida, o sistema deve executar a renovação automática via refresh token de forma transparente (AC-AUTH).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Tokens JWT devem ser gravados exclusivamente via `expo-secure-store`, nunca em `AsyncStorage` ou texto plano (RN-007, DoD 18.2).
- **RT-02:** Senhas e tokens nunca devem ser registrados em logs de console ou de auditoria (RN-007, DoD 18.1).
- **RT-03:** Rotas do Expo Router devem redirecionar para `(public)/login` caso não exista token válido.
- **RT-04:** Validação dos formulários de entrada utilizando schemas Zod.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Login sem conectividade deve orientar o usuário sobre a necessidade de internet para a primeira autenticação ou informar sobre sessão local prévia.
- **EX-02:** Falha na renovação com refresh token inválido deve revogar a sessão e redirecionar para a tela de login.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Implementar serviço `authStorage.ts` para salvar, carregar e remover tokens e dados do perfil no SecureStore.
- [ ] **Passo 2:** Configurar interceptor HTTP em `apiClient.ts` com fila de reintentos para tratamento de 401 e renovação de token.
- [ ] **Passo 3:** Criar o hook/store `useAuth` e provedor de contexto de autenticação.
- [ ] **Passo 4:** Desenvolver a tela `login.tsx` com tratamento de loading, mensagens de erro compreensíveis e acessibilidade.
- [ ] **Passo 5:** Configurar guards de rota em `app/_layout.tsx` e `app/(protected)/_layout.tsx`.
- [ ] **Passo 6:** Criar testes unitários para o fluxo de armazenamento, renovação e expiração de sessão.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Login bem-sucedido redireciona para a aba principal `(tabs)/index` e persiste a sessão no SecureStore.
- [ ] **CA-02:** Token expirado é renovado silenciosamente e repete a requisição protegida sem intervenção do usuário.
- [ ] **CA-03:** Logout elimina tokens locais e impede retorno a telas protegidas pelo botão voltar.
- [ ] **CA-04:** `npx tsc --noEmit` executa sem erros de tipagem.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
