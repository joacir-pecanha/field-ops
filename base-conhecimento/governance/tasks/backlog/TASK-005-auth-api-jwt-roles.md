# TASK-005: Autenticação JWT, Autorização Baseada em Roles e Gestão de Sessão na API

## 1. Metadados
- **ID:** TASK-005
- **Épico / Módulo:** Backend API / Autenticação & Segurança
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/arquitetura.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/arquitetura.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

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
- [ ] **Passo 1:** Configurar cadeia de filtros do Spring Security com sessão stateless.
- [ ] **Passo 2:** Implementar gerador e validador de JWT (`JwtTokenProvider`) com chave assimétrica ou HMAC segura.
- [ ] **Passo 3:** Criar entidade e repositório de persistência para tokens de refresh com auditoria de data e IP.
- [ ] **Passo 4:** Implementar controller REST com endpoints `/api/v1/auth/login`, `/api/v1/auth/refresh` e `/api/v1/auth/logout`.
- [ ] **Passo 5:** Configurar sanitização de logs com Logback para mascarar campos sensíveis.
- [ ] **Passo 6:** Escrever testes de integração com MockMvc cobrindo cenários de sucesso, erro de senha, usuário inativo e refresh expirado.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Login com usuário válido retorna status 200 com tokens e dados públicos do perfil.
- [ ] **CA-02:** Requisição a rotas protegidas sem Bearer token retorna 401 Unauthorized.
- [ ] **CA-03:** Técnico não consegue acessar endpoints com role `ADMIN` ou `SUPERVISOR` (retorna 403 Forbidden).
- [ ] **CA-04:** Suíte de testes unitários e de integração passa com 100% de sucesso.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
