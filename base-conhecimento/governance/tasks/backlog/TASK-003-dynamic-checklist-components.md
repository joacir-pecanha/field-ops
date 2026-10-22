# TASK-003: Implementar Componentes de Entrada do Checklist Dinâmico

## 1. Metadados
- **ID:** TASK-003
- **Épico / Módulo:** Mobile / Checklist Dinâmico / UI
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [governance/specs/SPEC-003-mobile-dynamic-checklist.md](file:///c:/Users/Joacir/Desktop/field-ops/governance/specs/SPEC-003-mobile-dynamic-checklist.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
O núcleo da experiência em campo é o preenchimento de checklists. Esta tarefa cria a biblioteca de componentes visuais especializados por tipo de resposta (`TEXT_SHORT`, `TEXT_LONG`, `NUMBER`, `BOOLEAN`, `CONFORMITY`, `SINGLE_CHOICE`, `DATE`), garantindo validação em tempo real com React Hook Form e Zod, salvamento automático local e layout adaptado para uso em campo (botões largos, contraste adequado).

---

## 3. Arquivos Impactados
- `mobile/src/features/checklist/components/DynamicItemRenderer.tsx` (Componente orquestrador de tipos)
- `mobile/src/features/checklist/components/inputs/ConformityInput.tsx` (Conforme / Não Conforme / N/A)
- `mobile/src/features/checklist/components/inputs/SingleChoiceInput.tsx` (Seleção única com rádio)
- `mobile/src/features/checklist/components/inputs/DateInput.tsx` (Seletor de data)
- `mobile/src/features/checklist/components/inputs/NumericInput.tsx` (Input numérico com formatação)
- `mobile/src/features/checklist/schemas/checklistSchema.ts` (Validações Zod)
- `mobile/__tests__/checklist/DynamicItemRenderer.test.tsx` (Testes de renderização)

---

## 4. Requisitos Funcionais e Técnicos
- **RF-01:** Renderizar o controle de entrada correto de acordo com a propriedade `response_type` do item.
- **RF-02:** Ao selecionar "Não Conforme", abrir compulsoriamente a área de registro de descrição da não conformidade.
- **RT-01:** Utilizar tokens do `design-system` para estilização e acessibilidade visual.
- **RT-02:** Prevenir renderização em cascata excessiva do formulário ao digitar em itens específicos.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Definir schemas de validação Zod para cada variante de resposta.
- [ ] **Passo 2:** Implementar os subcomponentes de input individuais.
- [ ] **Passo 3:** Implementar o despachante `DynamicItemRenderer` com fallback seguro para tipos desconhecidos.
- [ ] **Passo 4:** Criar testes de renderização unitários para cada um dos 7 tipos de entrada suportados.
- [ ] **Passo 5:** Executar `npx tsc --noEmit` para validação de tipos.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Todos os 7 tipos mapeados no SPEC-003 renderizam seus componentes visuais adequados.
- [ ] **CA-02:** Tipo desconhecido renderiza um fallback de alerta sem travar a interface.
- [ ] **CA-03:** Testes unitários com Jest validam a renderização e interação de cada componente.
- [ ] **CA-04:** Aprovação de Joacir Peçanha.
