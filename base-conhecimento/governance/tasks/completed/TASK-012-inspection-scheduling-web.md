# TASK-012: Telas de Agendamento, Atribuição e Monitoramento de Inspeções na Web

## 1. Metadados
- **ID:** TASK-012
- **Épico / Módulo:** Web Admin / Planejamento & Agendamento
- **Status:** COMPLETED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-11-13

---

## 2. Contexto e Valor de Negócio
Para que a operação em campo aconteça de forma planejada, supervisores utilizam a interface web para criar novas inspeções, selecionar clientes e locais, vincular equipamentos por código/QR Code, associar modelos publicados e atribuir técnicos responsáveis. A tela de acompanhamento deve fornecer uma visão clara dos estados operacionais (Atribuída, Em Andamento, Enviada, Atrasada).

---

## 3. Arquivos Impactados
- `web/src/app/pages/inspections/inspection-list.component.ts` / `.html` (Listagem geral de inspeções com filtros, ordenação, paginação, destaque de atraso, modal de cancelamento e modal de detalhes/snapshot)
- `web/src/app/pages/inspections/inspection-schedule.component.ts` / `.html` (Formulário de agendamento em cascata via `valueChanges`, busca por código/QR Code e calendário/horário)
- `web/src/app/pages/inspections/components/cancel-modal.component.ts` (Modal dedicado de cancelamento com campo de justificativa — Passo 4)
- `web/src/app/pages/inspections/components/status-badge.component.ts` (Badge reutilizável com cores semânticas para estados — Passo 4)
- `web/src/app/pages/inspections/inspection.service.ts` (Serviço HTTP de inspeções)
- `web/src/app/pages/inspections/inspection-schedule.component.spec.ts` (Testes unitários — Passo 5)
- `web/src/app/app.routes.ts` (Rotas `/app/inspections` e `/app/inspections/new`)
- `backend/src/main/java/com/fieldops/config/DevBootstrapSeedConfig.java` (Segundo técnico ativo e massa inicial de 3 inspeções para validação humana)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Seleção hierárquica e reativa: ao selecionar Cliente, filtrar Locais; ao selecionar Local, filtrar Equipamentos (AC-SCHEDULING).
- **RF-02:** Seleção de modelo de inspeção restrita a versões publicadas ativas (AC-SCHEDULING, RN-024).
- **RF-03:** Seleção de técnico responsável restrita a usuários ativos com perfil `TECHNICIAN` (RN-027).
- **RF-04:** Definição obrigatória de data prevista de realização e nível de prioridade (BAIXA, MEDIA, ALTA, URGENTE) (RN-025).
- **RF-05:** Listagem geral com filtros combinados por estado, técnico, cliente, período e prioridade (AC-ADMIN-MONITOR).
- **RF-06:** Identificação visual e destaque para inspeções em atraso (AC-ADMIN-MONITOR).
- **RF-07:** Ação de cancelamento exigindo justificativa em modal obrigatório (RN-029).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilização de formulários reativos do Angular com `valueChanges` para recarregar combos dependentes sem recarregar a tela inteira.
- **RT-02:** Paginação no servidor e debounce no campo de pesquisa textual por código/título.
- **RT-03:** Cores semânticas consistentes para os estados: Atribuída (azul), Em Andamento (laranja), Enviada (amarelo), Aprovada (verde), Reprovada (vermelho), Cancelada (cinza).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Bloqueio do botão de envio do agendamento enquanto os campos obrigatórios não forem preenchidos.
- **EX-02:** Bloqueio da ação de cancelamento caso a inspeção já esteja no estado `APROVADA` (RN-030).

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Criar serviço HTTP `inspection.service.ts` com métodos de agendamento, cancelamento e busca paginada com filtros.
- [x] **Passo 2:** Desenvolver a tela `inspection-schedule.component` com selects dependentes e calendário para data prevista.
- [x] **Passo 3:** Implementar componente de listagem com tabela responsiva, paginação e ordenação por data.
- [x] **Passo 4:** Criar componente `status-badge` e modal de cancelamento com validação de justificativa.
- [x] **Passo 5:** Escrever testes de componentes cobrindo seleção de cliente/local e submissão de agendamento.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Supervisor consegue agendar uma inspeção completa em menos de 1 minuto pela interface.
- [x] **CA-02:** A lista de inspeções reflete o novo agendamento com o badge `ATRIBUÍDA`.
- [x] **CA-03:** O cancelamento exige justificativa e atualiza imediatamente o status para `CANCELADA`.
- [x] **CA-04:** Filtros por técnico e período funcionam corretamente sem quebra de layout.
- [x] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **2026-11-13 (Checkpoint Passos 1 a 3 para Validação Humana):**
  - **Passo 1 (`web/src/app/pages/inspections/inspection.service.ts`):** Implementado serviço HTTP tipado integrado a `/api/v1/inspections` (`list`, `schedule`, `cancel`, `listAssigned`, `getById`, `getSnapshots`, `getAuditLogs`), DTOs completos espelhando os contratos Java, metadados de prioridade (`BAIXA`, `MEDIA`, `ALTA`, `URGENTE`), cores semânticas de status (`RT-03`), `canCancelInspection` (`EX-02`) e mapeamento de erros RFC 7807 (`InspectionApiError`).
  - **Passo 2 (`web/src/app/pages/inspections/inspection-schedule.component.ts` / `.html`):** Implementado formulário reativo com cascata reativa via `valueChanges` + `switchMap` (`Cliente -> Local -> Equipamento` e `Modelo -> Versão Publicada`), atalho de localização rápida por QR Code/código de equipamento que preenche toda a hierarquia, restrição de modelos publicados ativos (`RF-02`) e técnicos ativos com perfil `TECHNICIAN` (`RF-03`), seletores de data/horário previstos e prioridade (`RF-04`), bloqueio de submissão enquanto campos obrigatórios estiverem pendentes (`EX-01`) e painel lateral com resumo ao vivo do agendamento.
  - **Passo 3 (`web/src/app/pages/inspections/inspection-list.component.ts` / `.html`):** Implementada listagem paginada no servidor (`<app-pagination>`) com debounce de 350ms na pesquisa textual (`RT-02`), filtros combinados por estado, prioridade, cliente, técnico, período e atrasadas (`RF-05`), ordenação por data prevista (`scheduledFor`) e colunas operacionais, destaque visual de linhas e badge `⚠ Em atraso` (`RF-06`), badges semânticos (`RT-03`), modal de cancelamento com justificativa obrigatória (`RF-07`) e bloqueio da ação em inspeções `APROVADA` (`EX-02`), além de modal de detalhes exibindo o snapshot congelado e a trilha de auditoria.
  - **Rotas & Massa Inicial (`app.routes.ts` e `DevBootstrapSeedConfig.java`):** Rotas `/app/inspections` e `/app/inspections/new` habilitadas em `web/src/app/app.routes.ts`; seed de desenvolvimento atualizado com a técnica ativa `ana.tecnica@fieldops.com` e 3 inspeções iniciais (1 `ATRIBUÍDA` no prazo, 1 `ATRIBUÍDA` em atraso e 1 `APROVADA`) para validação imediata.
  - **Evidências de verificação:**
    - `npm --prefix web run typecheck`: aprovado (saída 0).
    - `npm --prefix web run build`: aprovado (saída 0; `dist/web` gerado).
    - `npm --prefix web run test:ci`: **77/77 testes aprovados** (Edge Headless, saída 0).
    - `.\backend\mvnw.cmd -f backend\pom.xml test`: **31/31 testes aprovados** (`FieldOpsBackendApplicationTests`, `AuthControllerTest`, `InspectionSchedulingTest`, `MasterDataIntegrationTest`, `TemplateLifecycleTest`, saída 0).
- **2026-11-13 (Conclusão Passos 4 e 5):**
  - **Correção de filtro de modelos publicados (`inspection-schedule.component.ts`):** Ajustado o filtro inicial de modelos em `loadInitialOptions()` para exigir `tpl.active && (tpl.status === 'PUBLISHED' || tpl.currentVersion > 0)`, impedindo que rascunhos sem versão publicada (como `TPL-SUB-02`, que retorna `activeVersionId` preenchido pelo `workingVersion.id` no backend) apareçam no seletor de agendamento (`RF-02`). Validado pelo usuário.
  - **Passo 4 (`web/src/app/pages/inspections/components/status-badge.component.ts` e `cancel-modal.component.ts`):**
    - Extraído `StatusBadgeComponent` (`<app-status-badge>`) encapsulando as classes semânticas `tone-blue`, `tone-orange`, `tone-yellow`, `tone-green`, `tone-red` e `tone-gray` (`RT-03`) e suporte opcional ao selo de atraso (`RF-06`).
    - Extraído `CancelModalComponent` (`<app-cancel-modal>`) com `FormControl` validando justificativa obrigatória não vazia (até 1000 caracteres), fechamento via tecla `Escape`, bloqueio explícito quando a inspeção estiver em estado `APROVADA` ou `CANCELADA` (`EX-02`) e exibição de erros de validação/API.
    - Refatorados `inspection-list.component.ts` e `inspection-list.component.html` para utilizar `<app-status-badge>` e `<app-cancel-modal>`.
  - **Passo 5 (`web/src/app/pages/inspections/inspection-schedule.component.spec.ts`):** Adicionados 17 testes unitários cobrindo filtragem de clientes/modelos publicados/técnicos ativos (excluindo rascunho `TPL-SUB-02`), seleção hierárquica via `valueChanges` (`Cliente -> Local -> Equipamento` e `Modelo -> Versão Publicada`), busca rápida por QR Code, bloqueio de submissão (`EX-01`), submissão válida com conversão ISO-8601, matriz semântica do `StatusBadgeComponent` (`RT-03`), validação do `CancelModalComponent` e fluxos da `InspectionListComponent` (atraso, debounce de 350ms, bloqueio em `APROVADA` e cancelamento com justificativa).
  - **Evidências de verificação pós-Passos 4 e 5:**
    - `npm --prefix web run typecheck`: aprovado (saída 0).
    - `npm --prefix web run build`: aprovado (saída 0; `dist/web` gerado).
    - `npm --prefix web run test:ci`: **94/94 testes aprovados** (Edge Headless, saída 0).
- **2026-11-13 (Conclusão e Aprovação Final):**
  - Validação e aprovação realizadas por **Joacir Peçanha** (`CA-05`).
  - Task marcada como `COMPLETED` e movida para `base-conhecimento/governance/tasks/completed/TASK-012-inspection-scheduling-web.md`.
