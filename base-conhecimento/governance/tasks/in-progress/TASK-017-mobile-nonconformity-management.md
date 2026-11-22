# TASK-017: Gestão e Registro de Não Conformidades com Criticidade no Mobile

## 1. Metadados
- **ID:** TASK-017
- **Épico / Módulo:** Mobile / Não Conformidades
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
O apontamento de não conformidades (defeitos, riscos operacionais, inconformidades técnicas) é o principal entregável de segurança e qualidade do FieldOps. Ao identificar um problema no checklist ou no ambiente do equipamento, o técnico registra a ocorrência classificando sua severidade (`BAIXA`, `MEDIA`, `ALTA`, `CRITICA`). O sistema deve garantir que itens classificados como críticos exijam compulsoriamente descrição detalhada e pelo menos uma evidência fotográfica.

---

## 3. Arquivos Impactados
- `mobile/src/features/nonconformity/domain/types.ts` (Modelos e interfaces de Não Conformidade)
- `mobile/src/features/nonconformity/services/nonConformityRepository.ts` (CRUD local no SQLite)
- `mobile/src/features/nonconformity/components/NonConformityFormModal.tsx` (Formulário modal de cadastro e edição)
- `mobile/src/app/(protected)/inspections/[inspectionId]/non-conformities.tsx` (Tela de listagem de não conformidades da inspeção)
- `mobile/src/features/nonconformity/schemas/nonConformitySchema.ts` (Validações estritas com Zod)
- `mobile/__tests__/features/nonconformity/nonConformitySchema.test.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Toda não conformidade deve pertencer a uma inspeção específica (RN-052, AC-NONCONFORMITY).
- **RF-02:** A não conformidade pode ser vinculada a um item específico do checklist ou à inspeção como um todo (RN-053, AC-NONCONFORMITY).
- **RF-03:** A criticidade deve assumir obrigatoriamente um valor válido: `BAIXA`, `MEDIA`, `ALTA` ou `CRITICA` (RN-054, AC-NONCONFORMITY).
- **RF-04:** Quando a criticidade for `CRITICA` ou `ALTA`, exigir compulsoriamente descrição textual detalhada e ao menos uma evidência fotográfica anexada (RN-039, RN-055, AC-NONCONFORMITY).
- **RF-05:** Ao marcar um item do checklist como "Não Conforme", disparar automaticamente a abertura do modal de registro (RN-038).
- **RF-06:** O registro e listagem de não conformidades devem funcionar integralmente offline (AC-NONCONFORMITY).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar schema Zod com refinamento condicional (`superRefine`) para impor foto e descrição obrigatórias quando criticidade for crítica.
- **RT-02:** Gravar registros na tabela `non_conformities` do SQLite e criar a respectiva mutação na Outbox.
- **RT-03:** Permitir exclusão ou cancelamento antes do envio; exclusão após o envio deve respeitar auditoria no backend (RN-056).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de salvar uma não conformidade crítica sem foto bloqueia o botão de salvar e exibe mensagem em destaque: "Itens críticos exigem ao menos uma fotografia como evidência".
- **EX-02:** Edições locais em não conformidades de inspeções já concluídas ou aprovadas são proibidas.

---

## 5. Plano de Execução Passo a Passo
- [X] **Passo 1:** Definir schemas Zod e tipos TypeScript para Não Conformidades.
- [X] **Passo 2:** Implementar operações no SQLite em `nonConformityRepository.ts`.
- [X] **Passo 3:** Desenvolver o componente modal `NonConformityFormModal.tsx` com seletores de criticidade com cores de advertência.
- [X] **Passo 4:** Conectar o botão de anexo de foto ao fluxo de câmera desenvolvido na TASK-016.
- [X] **Passo 5:** Criar a tela de lista `non-conformities.tsx` agrupando ocorrências por nível de gravidade.
- [X] **Passo 6:** Escrever testes unitários validando as regras condicionais do schema Zod.

---

## 6. Critérios de Aceitação (Definition of Done)
- [X] **CA-01:** Uma não conformidade cadastrada é gravada em SQLite e listada na inspeção.
- [X] **CA-02:** Salvar como `CRITICA` sem foto é bloqueado pela validação visual e de schema.
- [X] **CA-03:** A não conformidade é enviada para a fila Outbox para sincronização com o backend.
- [X] **CA-04:** `npx tsc --noEmit` executa sem nenhum erro de tipagem.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Passos 1, 2 e 3 (Commit `940117e` & `a41ee38`):**
  - Definidos tipos, constantes de criticidade (`BAIXA`, `MEDIA`, `ALTA`, `CRITICA`) e mensagens de validação em `mobile/src/features/nonconformity/domain/types.ts`.
  - Implementado `nonConformitySchema` com `superRefine` em `mobile/src/features/nonconformity/schemas/nonConformitySchema.ts` exigindo descrição detalhada (`>= 10` caracteres) e pelo menos 1 evidência fotográfica para criticidades `ALTA` e `CRITICA` (`RF-04`, `RT-01`, `EX-01`).
  - Implementado repositório offline-first `NonConformityRepository` em `mobile/src/features/nonconformity/services/nonConformityRepository.ts` com tabela `non_conformities`, geração atômica de mutações na Outbox (`CREATE_NON_CONFORMITY`, `UPDATE_NON_CONFORMITY`, `CANCEL_NON_CONFORMITY`), agrupamento `findGroupedBySeverity` e bloqueio de edições em inspeções concluídas/aprovadas (`EX-02`).
  - Desenvolvido `NonConformityFormModal.tsx` com seletores de criticidade coloridos, vínculo opcional a item/inspeção, alerta visual `EX-01` e bloqueio do botão de salvar quando falta foto em ocorrência crítica/alta.
- **Passo 4 — Conexão com Fluxo de Câmera (TASK-016):**
  - Criado o store efêmero de rascunho `useNonConformityDraftStore` (`mobile/src/features/nonconformity/store/nonConformityDraftStore.ts`) para preservar todos os campos preenchidos no `NonConformityFormModal` durante a navegação até `/(protected)/evidence/capture`.
  - Atualizados `NonConformityFormModal.tsx` (suporte a `editingNonConformityId` e `preferDraftValues`), `mobile/src/app/(protected)/evidence/capture.tsx` (`returnToNcModal` / `returnRoute`, anexação imediata da foto capturada ao rascunho e retorno com parâmetros) e `mobile/src/app/(protected)/inspections/[inspectionId]/index.tsx` para reabrir automaticamente o modal com a nova fotografia anexada.
- **Passo 5 — Tela `non-conformities.tsx` Agrupada por Gravidade:**
  - Criada a rota `mobile/src/app/(protected)/inspections/[inspectionId]/non-conformities.tsx` (registrada em `mobile/src/app/(protected)/inspections/_layout.tsx` e `.expo/types/router.d.ts`) listando ocorrências 100% offline do SQLite agrupadas em ordem decrescente de gravidade (`CRITICA` → `ALTA` → `MEDIA` → `BAIXA`), com KPIs, filtros rápidos por severidade, alternância de canceladas para auditoria (`RT-03`), miniaturas das evidências e fluxo completo de criação/edição/câmera.
  - Adicionados atalhos de navegação para a lista agrupada em `inspections/[inspectionId]/index.tsx` e `inspections/[inspectionId]/summary.tsx`.
- **Passo 6 — Testes Unitários & Verificações:**
  - Criados `mobile/__tests__/features/nonconformity/nonConformitySchema.test.ts` (regras condicionais Zod) e `mobile/__tests__/features/nonconformity/nonConformityFlow.test.ts` (repositório SQLite, Outbox, store de rascunho de câmera e renderização SSR de `NonConformityFormModal` e `non-conformities.tsx`).
  - `node mobile\node_modules\typescript\bin\tsc -p mobile\tsconfig.json --noEmit` → Exit code `0` (`0` erros de tipagem).
  - `npm --prefix mobile test` → Exit code `0` (`167/167` testes aprovados em `46` suítes, `0` falhas).
