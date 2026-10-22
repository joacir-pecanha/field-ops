# SPEC-003: Motor e Componentes de Checklist Dinâmico

## 1. Metadados
- **ID:** SPEC-003
- **Módulo:** Mobile / Checklist Dinâmico
- **Status:** APPROVED
- **Responsável Humano:** Joacir Peçanha
- **Autor:** Planner Agent
- **Documentos de Referência:** [docs/aplicativo_mobile.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/aplicativo_mobile.md), [docs/fluxo_geral.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/fluxo_geral.md)

---

## 2. Visão Geral
O checklist de inspeção é dinâmico e carregado a partir do modelo publicado no backend. Cada item possui um tipo de dado específico que dita o componente de entrada, suas regras de validação (obrigatoriedade, limites) e o suporte a observações, fotos e apontamento de não conformidade.

---

## 3. Mapeamento de Tipos para Componentes

| Tipo na API (`response_type`) | Componente Mobile | Regras de Validação |
|---|---|---|
| `TEXT_SHORT` | Input de texto simples | Tamanho máximo, obrigatoriedade |
| `TEXT_LONG` | TextArea (múltiplas linhas) | Tamanho máximo, obrigatoriedade |
| `NUMBER` | Campo numérico com teclado numérico | Formato numérico, min/max quando configurado |
| `BOOLEAN` | Switch / Seletor Sim-Não | Valor booleano obrigatório |
| `CONFORMITY` | 3 Botões: Conforme / Não Conforme / N/A | Exige descrição se Não Conforme |
| `SINGLE_CHOICE` | Seletor de opções (Radio / Picker) | Uma opção obrigatória da lista |
| `DATE` | Seletor de data nativo (DatePicker) | Data válida no padrão ISO 8601 |

---

## 4. Requisitos de Usabilidade e Resiliência
1. **Fallback para Tipos Desconhecidos:** Se a API fornecer um tipo não suportado na versão atual do app, o componente não deve quebrar a tela; deve exibir um aviso visual de incompatibilidade de versão e alertar que o item precisa de atualização do app para ser preenchido.
2. **Auto-save com Debounce:** Alterações de texto são salvas no SQLite com debounce de 500ms; seletores e botões de conformidade salvam imediatamente.
3. **Cálculo de Progresso em Tempo Real:** A tela deve manter atualizado o percentual de itens respondidos e indicar a lista de itens obrigatórios pendentes para liberação do botão de conclusão.

---

## 5. Tarefas Associadas
- [TASK-003](file:///c:/Users/Joacir/Desktop/field-ops/governance/tasks/backlog/TASK-003-dynamic-checklist-components.md): Implementação dos componentes de renderização dinâmica do checklist.
