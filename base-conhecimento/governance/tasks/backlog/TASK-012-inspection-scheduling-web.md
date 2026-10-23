# TASK-012: Telas de Agendamento, Atribuição e Monitoramento de Inspeções na Web

## 1. Metadados
- **ID:** TASK-012
- **Épico / Módulo:** Web Admin / Planejamento & Agendamento
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
Para que a operação em campo aconteça de forma planejada, supervisores utilizam a interface web para criar novas inspeções, selecionar clientes e locais, vincular equipamentos por código/QR Code, associar modelos publicados e atribuir técnicos responsáveis. A tela de acompanhamento deve fornecer uma visão clara dos estados operacionais (Atribuída, Em Andamento, Enviada, Atrasada).

---

## 3. Arquivos Impactados
- `web/src/app/pages/inspections/inspection-list.component.ts` / `.html` (Listagem geral de inspeções com filtros)
- `web/src/app/pages/inspections/inspection-schedule.component.ts` / `.html` (Formulário de agendamento em cascata)
- `web/src/app/pages/inspections/components/cancel-modal.component.ts` (Modal de cancelamento com campo de justificativa)
- `web/src/app/pages/inspections/components/status-badge.component.ts` (Badge com cores semânticas para estados)
- `web/src/app/pages/inspections/inspection.service.ts` (Serviço HTTP de inspeções)
- `web/src/app/pages/inspections/inspection-schedule.component.spec.ts` (Testes unitários)

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
- [ ] **Passo 1:** Criar serviço HTTP `inspection.service.ts` com métodos de agendamento, cancelamento e busca paginada com filtros.
- [ ] **Passo 2:** Desenvolver a tela `inspection-schedule.component` com selects dependentes e calendário para data prevista.
- [ ] **Passo 3:** Implementar componente de listagem com tabela responsiva, paginação e ordenação por data.
- [ ] **Passo 4:** Criar componente `status-badge` e modal de cancelamento com validação de justificativa.
- [ ] **Passo 5:** Escrever testes de componentes cobrindo seleção de cliente/local e submissão de agendamento.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Supervisor consegue agendar uma inspeção completa em menos de 1 minuto pela interface.
- [ ] **CA-02:** A lista de inspeções reflete o novo agendamento com o badge `ATRIBUÍDA`.
- [ ] **CA-03:** O cancelamento exige justificativa e atualiza imediatamente o status para `CANCELADA`.
- [ ] **CA-04:** Filtros por técnico e período funcionam corretamente sem quebra de layout.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
