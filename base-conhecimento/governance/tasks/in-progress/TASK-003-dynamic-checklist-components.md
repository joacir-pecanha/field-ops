# TASK-003: Implementar Componentes de Entrada do Checklist Dinâmico

## 1. Metadados
- **ID:** TASK-003
- **Épico / Módulo:** Mobile / Checklist Dinâmico / UI
- **Status:** IN_REVIEW
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-003-mobile-dynamic-checklist.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-003-mobile-dynamic-checklist.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-10-23

---

## 2. Contexto e Valor de Negócio
O núcleo da experiência em campo é o preenchimento de checklists. Esta tarefa cria a biblioteca de componentes visuais especializados por tipo de resposta (`TEXT_SHORT`, `TEXT_LONG`, `NUMBER`, `BOOLEAN`, `CONFORMITY`, `SINGLE_CHOICE`, `DATE`), garantindo validação em tempo real com React Hook Form e Zod, salvamento automático local e layout adaptado para uso em campo (botões largos, contraste adequado).

---

## 3. Arquivos Impactados
- `mobile/src/features/checklist/components/DynamicItemRenderer.tsx` (Componente orquestrador de tipos)
- `mobile/src/features/checklist/components/inputs/ConformityInput.tsx` (Conforme / Não Conforme / N/A)
- `mobile/src/features/checklist/components/inputs/SingleChoiceInput.tsx` (Seleção única com rádio)
- `mobile/src/features/checklist/components/inputs/DateInput.tsx` (Seletor de data)
- `mobile/src/features/checklist/components/inputs/NumericInput.tsx` (Input numérico com formatação e steppers)
- `mobile/src/features/checklist/components/inputs/ShortTextInput.tsx` (Entrada de linha única)
- `mobile/src/features/checklist/components/inputs/LongTextInput.tsx` (Área de texto multilinha)
- `mobile/src/features/checklist/components/inputs/BooleanInput.tsx` (Seletor binário Sim/Não)
- `mobile/src/features/checklist/components/inputs/index.ts` (Exportação dos subcomponentes)
- `mobile/src/features/checklist/schemas/checklistSchema.ts` (Validações Zod)
- `mobile/src/features/checklist/index.ts` (Módulo de checklist)
- `mobile/__tests__/checklist/checklistSchema.test.ts` (Testes unitários dos schemas Zod)
- `mobile/__tests__/checklist/DynamicItemRenderer.test.ts` (Testes unitários e de renderização)

---

## 4. Requisitos Funcionais e Técnicos
- **RF-01:** Renderizar o controle de entrada correto de acordo com a propriedade `response_type` do item.
- **RF-02:** Ao selecionar "Não Conforme", abrir compulsoriamente a área de registro de descrição da não conformidade.
- **RT-01:** Utilizar tokens do `design-system` para estilização e acessibilidade visual.
- **RT-02:** Prevenir renderização em cascata excessiva do formulário ao digitar em itens específicos.

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Definir schemas de validação Zod para cada variante de resposta.
- [x] **Passo 2:** Implementar os subcomponentes de input individuais.
- [x] **Passo 3:** Implementar o despachante `DynamicItemRenderer` com fallback seguro para tipos desconhecidos.
- [x] **Passo 4:** Criar testes de renderização unitários para cada um dos 7 tipos de entrada suportados.
- [x] **Passo 5:** Executar `npx tsc --noEmit` para validação de tipos.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Todos os 7 tipos mapeados no SPEC-003 renderizam seus componentes visuais adequados.
- [x] **CA-02:** Tipo desconhecido renderiza um fallback de alerta sem travar a interface.
- [x] **CA-03:** Testes unitários validam a renderização e interação de cada componente.
- [ ] **CA-04:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Schemas de Validação Zod (`checklistSchema.ts`):**
  - Implementados schemas estritos para os 7 tipos: `createShortTextSchema`, `createLongTextSchema`, `createNumericSchema`, `createBooleanSchema`, `createConformitySchema`, `createSingleChoiceSchema`, `createDateSchema`.
  - **Fábrica Dinâmica (`createItemResponseSchema`):** Gera automaticamente o schema Zod adequado a partir da entidade `ChecklistItem` do SQLite (respeitando `required`, `options_json` e regras).
  - **Não Conformidade Compulsória (RF-02):** O schema `createConformitySchema` utiliza `.superRefine()` para exigir descrição com no mínimo 3 caracteres sempre que `conformity === 'NON_CONFORMING'` ou `'NAO_CONFORME'`.
  - **Resiliência e Fallback (CA-02):** Tipos desconhecidos geram schema seguro permissivo sem crash.
- **Subcomponentes Especializados de Entrada (`components/inputs/`):**
  - `ConformityInput`: 3 botões ergonômicos (alvo >= 52px). Ao selecionar "Não Conforme", expande compulsoriamente o container de descrição com badge de alerta, campo multilinha e feedback de validação.
  - `SingleChoiceInput`: Rádio botões estilizados a partir de `options_json`, com indicador visual circular e suporte a estados selecionado/desabilitado.
  - `DateInput`: Campo formatado ISO 8601 (`YYYY-MM-DD`) com atalho "Hoje" para preenchimento ágil pelo técnico em campo.
  - `NumericInput`: Entrada decimal/numérica com botões de incremento/decremento (+ / −) rápidos para uso com luvas e exibição de limites Min/Máx.
  - `ShortTextInput` & `LongTextInput`: Entradas de texto com contador de caracteres em tempo real e isolamento de estado interno.
  - `BooleanInput`: Botões de alternância binária largos (Sim / Não) com alto contraste.
- **Despachante Central (`DynamicItemRenderer.tsx`):**
  - Orquestra os 7 tipos mapeados de `response_type`.
  - Exibe cabeçalho padronizado com título, indicador de obrigatoriedade (* Obrigatório) e descrição de ajuda.
  - **Fallback Seguro (CA-02):** Se um tipo desconhecido for recebido do backend (ex: `HOLOGRAPHIC_3D_SCAN`), renderiza card amigável orientando o usuário a atualizar o app.
  - **Prevenção de Cascata (RT-02):** Componente envolto em `React.memo` com comparador estrito de propriedades (`arePropsEqual`). Alterações em itens vizinhos ou digitação em outros campos não disparam re-renderizações deste item.
- **Garantia de Qualidade e Guardrails:**
  - `npm test`: **64/64 testes passando com 100% de sucesso**, cobrindo schemas Zod, todos os 7 componentes de input, fallback seguro e regras de não conformidade compulsória.
  - `npx tsc --noEmit`: **0 erros de tipagem estática**.
