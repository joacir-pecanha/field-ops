# TASK-006: Autenticação, Interceptors e Guards de Rota na Interface Administrativa Web

## 1. Metadados
- **ID:** TASK-006
- **Épico / Módulo:** Web Admin / Autenticação & Sessão
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
A interface administrativa web é a porta de entrada para administradores e supervisores configurarem o FieldOps e acompanharem operações. O acesso às rotas web deve ser rigorosamente protegido por guards de autenticação e autorização por perfil, garantindo que usuários desautenticados ou técnicos sejam barrados antes de renderizar qualquer visualização sensível.

---

## 3. Arquivos Impactados
- `web/src/app/core/auth/auth.service.ts` (Serviço de autenticação e estado de sessão)
- `web/src/app/core/auth/auth.guard.ts` (Guards de rotas protegidas e restrição por perfil)
- `web/src/app/core/interceptors/jwt.interceptor.ts` (Injeção de Authorization Bearer)
- `web/src/app/core/interceptors/error.interceptor.ts` (Captura de 401/403 e renovação de token)
- `web/src/app/pages/login/login.component.ts` / `.html` (Formulário de login responsivo)
- `web/src/app/layout/admin-layout.component.ts` (Header com dados do usuário logado e botão Sair)
- `web/src/app/core/auth/auth.service.spec.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Formulário de login com e-mail, senha e feedback de validação visual (AC-AUTH).
- **RF-02:** Armazenar tokens de forma segura no navegador e restaurar a sessão na recarga da página (F5) (DoD 18.3).
- **RF-03:** Proteger rotas `/app/**` impedindo acesso direto sem token ativo (AC-AUTH, DoD 18.3).
- **RF-04:** Redirecionar usuário para `/login` ao detectar sessão expirada ou inválida (AC-AUTH).
- **RF-05:** Fornecer botão de logout no cabeçalho limpando tokens e redirecionando para `/login` (AC-AUTH).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar formulários reativos com validação de formato de e-mail e campo obrigatório.
- **RT-02:** Estados de carregamento com desabilitação de botões para prevenir envios duplicados acidentais (DoD 18.1, DoD 18.3).
- **RT-03:** Tratamento visual e feedback amigável para erros 401, 403 e 500 (DoD 18.3).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Em caso de perda de conexão no momento do login, exibir toast ou banner de erro de rede.
- **EX-02:** Usuário com perfil `TECHNICIAN` tentando logar na web recebe aviso claro de que seu acesso deve ser via aplicativo móvel.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Criar `AuthService` com métodos de login, refresh, logout e Signals/Observables de usuário logado.
- [ ] **Passo 2:** Implementar `jwt.interceptor.ts` para anexar o token em todas as chamadas para a API.
- [ ] **Passo 3:** Implementar `error.interceptor.ts` para gerenciar fluxo de 401 silencioso com refresh token.
- [ ] **Passo 4:** Criar `auth.guard.ts` validando presença de token e checando roles permitidas na rota.
- [ ] **Passo 5:** Desenvolver a página de login com design moderno, responsivo e estados de loading/erro.
- [ ] **Passo 6:** Escrever testes unitários para o serviço de autenticação e guards de rota.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Usuário sem credenciais é impedido de acessar `/app/dashboard` e redirecionado para `/login`.
- [ ] **CA-02:** Login válido navega para a página inicial da área administrativa com o nome do usuário exibido no header.
- [ ] **CA-03:** Logout desconecta o usuário e limpa o storage local do navegador.
- [ ] **CA-04:** Testes unitários com Karma/Jest passam sem falhas.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
