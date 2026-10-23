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
- [ ] **Passo 1:** Definir schemas Zod e tipos TypeScript para Não Conformidades.
- [ ] **Passo 2:** Implementar operações no SQLite em `nonConformityRepository.ts`.
- [ ] **Passo 3:** Desenvolver o componente modal `NonConformityFormModal.tsx` com seletores de criticidade com cores de advertência.
- [ ] **Passo 4:** Conectar o botão de anexo de foto ao fluxo de câmera desenvolvido na TASK-016.
- [ ] **Passo 5:** Criar a tela de lista `non-conformities.tsx` agrupando ocorrências por nível de gravidade.
- [ ] **Passo 6:** Escrever testes unitários validando as regras condicionais do schema Zod.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Uma não conformidade cadastrada é gravada em SQLite e listada na inspeção.
- [ ] **CA-02:** Salvar como `CRITICA` sem foto é bloqueado pela validação visual e de schema.
- [ ] **CA-03:** A não conformidade é enviada para a fila Outbox para sincronização com o backend.
- [ ] **CA-04:** `npx tsc --noEmit` executa sem nenhum erro de tipagem.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
