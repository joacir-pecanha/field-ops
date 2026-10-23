# TASK-001: Implementar Camada de Persistência SQLite Real e Migrações (Expo 57)

## 1. Metadados
- **ID:** TASK-001
- **Épico / Módulo:** Mobile / Offline-First / Database
- **Status:** COMPLETED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-10-23

---

## 2. Contexto e Valor de Negócio
Atualmente, o diretório `mobile/src/infrastructure/database` possui stubs e persistência em memória temporária. Esta tarefa implementa o banco SQLite nativo utilizando as APIs modernas do Expo 57 (`expo-sqlite`), executando as migrações sequenciais descritas no SPEC-001 para que o técnico possa operar 100% offline com persistência real em disco.

---

## 3. Arquivos Impactados
- `mobile/src/infrastructure/database/db.ts` (Substituição da conexão simulada por Expo SQLite)
- `mobile/src/infrastructure/database/migrations.ts` (Implementação do executor de migrações DDL)
- `mobile/src/infrastructure/database/types.ts` (Alinhamento dos tipos com o SPEC-001)
- `mobile/src/infrastructure/database/repositories/inspectionRepository.ts` (Implementação CRUD em SQLite)
- `mobile/src/infrastructure/database/repositories/outboxRepository.ts` (Implementação de fila Outbox em SQLite)
- `mobile/__tests__/database/migrations.test.ts` (Testes unitários de migração)

---

## 4. Requisitos Funcionais e Técnicos
- **RT-01:** Utilizar `expo-sqlite` seguindo a documentação do Expo v57 (`openDatabaseAsync`, `execAsync`, `runAsync`, `getAllAsync`).
- **RT-02:** Executar migrações automaticamente na inicialização da aplicação usando controle de versão via `PRAGMA user_version`.
- **RT-03:** Todas as tabelas do SPEC-001 devem ser criadas com chaves estrangeiras ativadas (`PRAGMA foreign_keys = ON;`).
- **RT-04:** Repositórios devem expor métodos tipados retornando promises.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Atualizar `types.ts` com as interfaces de Inspeção, Seções, Itens, Respostas, Evidências e Outbox.
- [x] **Passo 2:** Estruturar arquivo de migração inicial `migrations.ts` com o DDL completo do SPEC-001.
- [x] **Passo 3:** Implementar abertura assíncrona do banco em `db.ts` e orquestrador de migrações.
- [x] **Passo 4:** Criar `inspectionRepository.ts` e `outboxRepository.ts` consumindo o banco SQLite real.
- [x] **Passo 5:** Executar testes unitários e rodar `npx tsc --noEmit` para validação estática.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** O banco de dados inicia sem erros em ambiente mobile e aplica todas as tabelas na versão 1.
- [x] **CA-02:** É possível inserir e buscar uma inspeção e uma operação outbox no SQLite nativo.
- [x] **CA-03:** `npx tsc --noEmit` executa sem nenhum erro de tipagem no projeto mobile.
- [x] **CA-04:** Validação e aprovação final de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Instalação da biblioteca nativa:** Adicionado `expo-sqlite@~57.0.4` via Expo CLI em conformidade com o SDK Expo 57.
- **Tipagem (Passo 1):** `types.ts` atualizado com interfaces completas de `User`, `Inspection`, `ChecklistSection`, `ChecklistItem`, `ChecklistResponse`, `InspectionEvidence`, `OutboxOperation` e tipos de status de negócio/sincronização baseados no SPEC-001 e SPEC-002, mantendo retrocompatibilidade com UI existente.
- **DDL e Migrações (Passo 2):** Estruturado `migrations.ts` contendo o DDL integral das 7 tabelas com chaves estrangeiras (`ON DELETE CASCADE` e `ON DELETE SET NULL`), índices de status/sync e orquestrador via `PRAGMA user_version` dentro de transação atômica (`withTransactionAsync`).
- **Conexão SQLite (Passo 3):** Implementado `db.ts` com singleton assíncrono através de `openDatabaseAsync('fieldops.db')`, ativando compulsoriamente `PRAGMA foreign_keys = ON;` e `PRAGMA journal_mode = WAL;`. Incluído `setDatabaseInstance` para permitir injeção de conexões isoladas em testes unitários.
- **Repositórios SQLite (Passo 4):**
  - Implementado `inspectionRepository.ts` consumindo SQLite nativo via `runAsync`, `getAllAsync` e `getFirstAsync`. Inclui consultas otimizadas por status, sync_status, busca textual com LIKE e suporte a aliases retrocompatíveis (`client`, `site`, `equipment`).
  - Implementado `outboxRepository.ts` para controle da fila transacional com serialização JSON de dependências, ordenação FIFO por `created_at ASC`, filtragem por status (`findPendingOperations`), atualização de status e retentativas exponenciais (`incrementRetries`).
  - Atualizado `seed.ts` para popular tanto SQLite nativo quanto a memória temporária legada.
- **Testes Unitários & Validação (Passo 5):**
  - Criado `mobile/__tests__/database/migrations.test.ts` com 13 testes unitários cobrindo: controle de versão `PRAGMA user_version`, idempotência de migrações, integridade referencial com `PRAGMA foreign_keys = ON`, deleção em cascata (ON DELETE CASCADE), CRUD completo do `InspectionRepository` e ciclo de vida da fila do `OutboxRepository`.
  - Execução dos testes via `npm test` aprovada com 13/13 testes passando.
  - Execução do `npx tsc --noEmit` validada com 0 erros de tipagem.

