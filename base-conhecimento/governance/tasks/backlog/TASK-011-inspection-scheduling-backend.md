# TASK-011: Agendamento, Atribuição e Geração de Snapshots de Inspeção na API

## 1. Metadados
- **ID:** TASK-011
- **Épico / Módulo:** Backend API / Planejamento & Agendamento
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/modelo-de-dados.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/modelo-de-dados.md), [docs/regras-de-negocio.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/regras-de-negocio.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
O módulo de planejamento conecta a configuração de modelos ao trabalho prático de campo. Ao agendar uma inspeção, o supervisor define o cliente, local, equipamento, modelo publicado, técnico responsável e prazo previsto. O backend deve congelar imediatamente a estrutura do checklist em registros de snapshot (`InspectionItemSnapshot`), garantindo que o técnico execute exatamente a versão contratada, mesmo que o modelo seja alterado futuramente.

---

## 3. Arquivos Impactados
- `backend/src/main/resources/db/migration/V3__inspections_and_snapshots_schema.sql` (Tabelas de inspeções e snapshots de itens)
- `backend/src/main/java/com/fieldops/modules/inspection/domain/Inspection.java` (Entidade mestre de inspeção e status)
- `backend/src/main/java/com/fieldops/modules/inspection/domain/InspectionItemSnapshot.java` (Cópia imutável do checklist)
- `backend/src/main/java/com/fieldops/modules/inspection/controller/InspectionSchedulingController.java` (Endpoints REST)
- `backend/src/main/java/com/fieldops/modules/inspection/service/InspectionSchedulingService.java` (Regras de agendamento e cancelamento)
- `backend/src/main/java/com/fieldops/modules/inspection/dto/ScheduleInspectionRequest.java` / `CancelInspectionRequest.java`
- `backend/src/test/java/com/fieldops/modules/inspection/InspectionSchedulingTest.java` (Testes de integração)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Toda inspeção deve estar vinculada a uma versão publicada de modelo (RN-024, AC-SCHEDULING).
- **RF-02:** Cliente, local, técnico responsável e data prevista são obrigatórios (RN-025, AC-SCHEDULING).
- **RF-03:** Validar compatibilidade: o equipamento deve pertencer ao local e o local deve pertencer ao cliente (RN-014, AC-SCHEDULING).
- **RF-04:** Somente técnico ativo pode receber atribuição de inspeção (RN-027, AC-SCHEDULING).
- **RF-05:** No MVP, cada inspeção possui somente um técnico responsável (RN-031).
- **RF-06:** No ato do agendamento, copiar todos os itens do modelo para a tabela `inspection_item_snapshots` (RN-021, AC-SCHEDULING).
- **RF-07:** Permitir cancelamento por supervisor/admin registrando obrigatoriamente usuário, data e justificativa (RN-029, AC-SCHEDULING).
- **RF-08:** Inspeções já aprovadas não podem ser canceladas pelo fluxo comum (RN-030).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar estados formais de inspeção: `RASCUNHO`, `ATRIBUÍDA`, `EM_ANDAMENTO`, `ENVIADA`, `EM_REVISÃO`, `APROVADA`, `REPROVADA`, `CANCELADA`.
- **RT-02:** Operação transacional para criar a inspeção e os registros de snapshot de uma só vez.
- **RT-03:** Trilha de auditoria em `audit_logs` ao criar, atribuir ou cancelar a inspeção (RN-086).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de agendar com técnico inativo retorna HTTP 400 Bad Request com mensagem descritiva.
- **EX-02:** Cancelamento sem justificativa é bloqueado com erro de validação (HTTP 422).

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Criar scripts Flyway com as tabelas `inspections` e `inspection_item_snapshots`.
- [ ] **Passo 2:** Mapear entidades JPA com anotações de auditoria e validação de enum de estados.
- [ ] **Passo 3:** Desenvolver serviço de agendamento que valida as entidades relacionadas e gera o snapshot.
- [ ] **Passo 4:** Criar endpoint de agendamento `POST /api/v1/inspections/schedule` e endpoint de cancelamento `POST /api/v1/inspections/{id}/cancel`.
- [ ] **Passo 5:** Implementar endpoint para consulta de inspeções atribuídas a um técnico específico para sincronização (`GET /api/v1/inspections/assigned`).
- [ ] **Passo 6:** Criar testes automatizados para cenários de agendamento válido, incompatibilidade de local/equipamento e cancelamento com auditoria.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Inspeção agendada com sucesso adquire estado `ATRIBUÍDA` e gera snapshots de todos os itens do modelo.
- [ ] **CA-02:** O cancelamento exige justificativa e altera o estado para `CANCELADA`.
- [ ] **CA-03:** Técnico ativo consegue listar suas inspeções atribuídas.
- [ ] **CA-04:** Alterar o modelo original posteriormente não modifica os snapshots da inspeção já criada.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
