# TASK-005: Autenticação JWT, Autorização Baseada em Roles e Gestão de Sessão na API

## 1. Metadados
- **ID:** TASK-005
- **Épico / Módulo:** Backend API / Autenticação & Segurança
- **Status:** COMPLETED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/arquitetura.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/arquitetura.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-11-13

---

## 2. Contexto e Valor de Negócio
A API REST em Spring Boot é o ponto centralizador da segurança da plataforma FieldOps. Ela é responsável por autenticar usuários, validar perfis (`ADMIN`, `SUPERVISOR`, `TECHNICIAN`), emitir tokens assinados com claims mínimas, renovar sessões via refresh token, impedir o acesso de usuários inativados e garantir que credenciais nunca vazem em logs ou em respostas de erro.

---

## 3. Arquivos Impactados
- `backend/src/main/java/com/fieldops/security/config/SecurityConfig.java` (Configuração do Spring Security 6)
- `backend/src/main/java/com/fieldops/security/jwt/JwtTokenProvider.java` (Geração e validação de tokens JWT)
- `backend/src/main/java/com/fieldops/security/jwt/JwtAuthenticationFilter.java` (Filtro de requisição para Bearer token)
- `backend/src/main/java/com/fieldops/modules/auth/controller/AuthController.java` (Endpoints `/login`, `/refresh`, `/logout`)
- `backend/src/main/java/com/fieldops/modules/auth/service/AuthService.java` (Lógica de autenticação e revogação)
- `backend/src/main/java/com/fieldops/modules/auth/dto/LoginRequest.java` / `AuthResponse.java` (DTOs com validação Bean Validation)
- `backend/src/test/java/com/fieldops/modules/auth/AuthControllerTest.java` (Testes de integração)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Autenticar usuários ativos por e-mail e senha com hash seguro (BCrypt / Argon2) (RN-001, AC-AUTH).
- **RF-02:** Negar acesso a usuários inativos ou bloqueados (RN-001, RN-008, AC-AUTH).
- **RF-03:** Emitir par de tokens: Access Token (curta duração, ex: 15 min) e Refresh Token (longa duração, ex: 7 dias) (AC-AUTH).
- **RF-04:** Validar permissão baseada em roles nas anotações de serviço e controller (`@PreAuthorize`) (RN-003, AC-SECURITY).
- **RF-05:** Invalidar tokens de refresh ao trocar de senha, bloquear o usuário ou executar logout explícito (RN-008, AC-AUTH).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Proibir qualquer log que contenha senhas, tokens ou dados de cartão (RN-007, DoD 18.4).
- **RT-02:** Respostas de erro padronizadas (RFC 7807 Problem Details) sem stack traces expostos (AC-SECURITY, DoD 18.4).
- **RT-03:** Documentar todos os endpoints de autenticação na especificação OpenAPI / Swagger (DoD 18.4).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Requisição com credencial inválida retorna HTTP 401 com mensagem padronizada "Credenciais inválidas" sem distinguir existência do e-mail.
- **EX-02:** Tentativa de refresh com token revogado ou expirado retorna HTTP 401 forçando novo login.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Configurar cadeia de filtros do Spring Security com sessão stateless.
- [x] **Passo 2:** Implementar gerador e validador de JWT (`JwtTokenProvider`) com chave assimétrica ou HMAC segura.
- [x] **Passo 3:** Criar entidade e repositório de persistência para tokens de refresh com auditoria de data e IP.
- [x] **Passo 4:** Implementar controller REST com endpoints `/api/v1/auth/login`, `/api/v1/auth/refresh` e `/api/v1/auth/logout`.
- [x] **Passo 5:** Configurar sanitização de logs com Logback para mascarar campos sensíveis.
- [x] **Passo 6:** Escrever testes de integração com MockMvc cobrindo cenários de sucesso, erro de senha, usuário inativo e refresh expirado.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Login com usuário válido retorna status 200 com tokens e dados públicos do perfil.
- [x] **CA-02:** Requisição a rotas protegidas sem Bearer token retorna 401 Unauthorized.
- [x] **CA-03:** Técnico não consegue acessar endpoints com role `ADMIN` ou `SUPERVISOR` (retorna 403 Forbidden).
- [x] **CA-04:** Suíte de testes unitários e de integração passa com 100% de sucesso.
- [x] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **2026-11-10 (Coder Agent):**
  - **Passo 1 (`SecurityConfig.java` & `JwtAuthenticationFilter.java`):** Configurada cadeia de filtros do Spring Security com política `SessionCreationPolicy.STATELESS`, `@EnableMethodSecurity(prePostEnabled = true)` para validação de roles via `@PreAuthorize` (RF-04, RN-003), `BCryptPasswordEncoder(12)` (RF-01), CORS restrito e handlers de exceção (`AuthenticationEntryPoint` HTTP 401 e `AccessDeniedHandler` HTTP 403) padronizados em formato RFC 7807 Problem Details sem stack traces (RT-02, CA-02, CA-03).
  - **Passo 2 (`JwtTokenProvider.java` & `AuthenticatedUser.java`):** Implementado gerador e validador de JWT assinado com HMAC-SHA256 (`HS256`) utilizando `javax.crypto.Mac` nativo da JDK e verificação de assinatura em tempo constante (`MessageDigest.isEqual`), emitindo tokens com claims mínimas (`sub`, `email`, `role`, `type`, `jti`, `iat`, `exp`) e separação estrita entre tokens `ACCESS` (15 min) e `REFRESH` (7 dias) (RF-03).
  - **Passo 3 (`User.java`, `RefreshToken.java`, `UserRepository.java`, `RefreshTokenRepository.java` & `V1__init_auth_schema.sql`):** Criadas entidades JPA e migração Flyway para `users` e `refresh_tokens` com chaves UUID, auditoria de data de criação/expiração/revogação, endereço IP e User-Agent, além de consultas para revogação em lote por usuário (RF-05, RN-008).
  - **Passo 4 (`AuthController.java`, `AuthService.java`, DTOs e `GlobalExceptionHandler.java`):** Implementados endpoints REST `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`, `/api/v1/auth/me` e `/api/v1/auth/sessions/{userId}/revoke`. Tratamento padronizado RFC 7807 para credenciais inválidas (HTTP 401 `"Credenciais inválidas"` sem distinguir existência do e-mail — EX-01), usuário inativo/bloqueado (HTTP 403 `"USER_INACTIVE"` / `"USER_BLOCKED"` — RF-02) e refresh token expirado/revogado (HTTP 401 `"INVALID_REFRESH_TOKEN"` — EX-02), em total conformidade com o contrato esperado pelo aplicativo mobile (`TASK-004`).
  - **Passo 5 (`SensitiveDataMaskingConverter.java` & `logback-spring.xml`):** Configurado conversor customizado do Logback (`%maskedMsg`) e sobrescrita de `toString()` em todos os DTOs/entidades de autenticação para mascarar senhas, tokens JWT, refresh tokens, cabeçalhos `Bearer` e números de cartão como `[REDACTED]` (RT-01, RN-007, DoD 18.4).
  - **Passo 6 (`AuthControllerTest.java`):** Implementada suíte de testes de integração com `MockMvc` e `SpringSecurity` cobrindo login válido (CA-01), senha incorreta / e-mail inexistente (EX-01), usuário inativo (RF-02), rotação e expiração de refresh token (RF-03, EX-02), logout explícito, invalidação por troca de senha/bloqueio (RF-05), acesso sem token (CA-02), bloqueio 403 para `TECHNICIAN` em rota de `ADMIN`/`SUPERVISOR` (CA-03) e sanitização de logs (RT-01).
