# TASK-001: Implementar Camada de Persistência SQLite Real e Migrações (Expo 57)

## 1. Metadados
- **ID:** TASK-001
- **Épico / Módulo:** Mobile / Offline-First / Database
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

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
- [ ] **Passo 1:** Atualizar `types.ts` com as interfaces de Inspeção, Seções, Itens, Respostas, Evidências e Outbox.
- [ ] **Passo 2:** Estruturar arquivo de migração inicial `migrations.ts` com o DDL completo do SPEC-001.
- [ ] **Passo 3:** Implementar abertura assíncrona do banco em `db.ts` e orquestrador de migrações.
- [ ] **Passo 4:** Criar `inspectionRepository.ts` e `outboxRepository.ts` consumindo o banco SQLite real.
- [ ] **Passo 5:** Executar testes unitários e rodar `npx tsc --noEmit` para validação estática.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** O banco de dados inicia sem erros em ambiente mobile e aplica todas as tabelas na versão 1.
- [ ] **CA-02:** É possível inserir e buscar uma inspeção e uma operação outbox no SQLite nativo.
- [ ] **CA-03:** `npx tsc --noEmit` executa sem nenhum erro de tipagem no projeto mobile.
- [ ] **CA-04:** Validação e aprovação final de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(A ser preenchido durante a execução)*
