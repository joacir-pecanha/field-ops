# TASK-010: Construtor Visual de Modelos de Inspeção e Prévia de Checklist na Web

## 1. Metadados
- **ID:** TASK-010
- **Épico / Módulo:** Web Admin / Modelos de Inspeção
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
O supervisor necessita de uma ferramenta ágil e intuitiva para criar e manter modelos de inspeção padronizados. Esta tela permite criar seções, adicionar itens, configurar tipos de resposta (texto, número, booleano, conformidade, rádio, data, foto), marcar obrigatoriedade, definir exigência de observação ou foto em caso de não conformidade, e visualizar uma prévia interativa do checklist antes da publicação oficial.

---

## 3. Arquivos Impactados
- `web/src/app/pages/templates/template-list.component.ts` / `.html` (Listagem de modelos e status da versão)
- `web/src/app/pages/templates/template-builder.component.ts` / `.html` (Editor de seções e itens)
- `web/src/app/pages/templates/components/section-editor.component.ts` (Edição de título e ordem da seção)
- `web/src/app/pages/templates/components/item-editor.component.ts` (Configuração detalhada de item)
- `web/src/app/pages/templates/components/template-preview.component.ts` (Pré-visualização do checklist simulando a tela mobile)
- `web/src/app/pages/templates/template.service.ts` (Serviço HTTP de templates)
- `web/src/app/pages/templates/template-builder.component.spec.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Permitir criação de novo modelo com título, categoria e descrição (AC-TEMPLATE).
- **RF-02:** Adicionar, editar, reordenar e excluir seções e itens em modelos em rascunho (RN-017, RN-018).
- **RF-03:** Configuração de cada item: tipo de resposta, campo obrigatório (`required`), exigir observação em não conforme (`require_observation_on_fail`), exigir evidência fotográfica em não conforme (`require_evidence_on_fail`) (AC-TEMPLATE, RN-038, RN-039).
- **RF-04:** Fornecer aba ou modal de "Prévia do Checklist" para testar visualmente o fluxo do formulário antes de publicar (AC-TEMPLATE).
- **RF-05:** Botão "Publicar Versão" com validação de regras de bloqueio e confirmação explícita (AC-TEMPLATE, RN-015).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar formulários dinâmicos (`FormArray`) para gerenciar as seções e itens aninhados.
- **RT-02:** Drag and drop ou botões para subir/descer a ordem de seções e itens.
- **RT-03:** Alertas visuais e desativação do botão de publicação caso haja itens incompletos ou sem tipo de resposta.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Se o usuário tentar sair sem salvar alterações em rascunho, exibir diálogo de confirmação de perda de dados.
- **EX-02:** Modelos publicados não permitem alteração direta de itens na UI; a interface deve exibir badge "Publicado" e botão "Criar Nova Versão".

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Criar serviço HTTP `template.service.ts` integrado aos endpoints do backend.
- [ ] **Passo 2:** Desenvolver a tela de listagem de templates com filtros por categoria e status.
- [ ] **Passo 3:** Implementar o componente `template-builder` com estrutura em árvore de seções e itens.
- [ ] **Passo 4:** Criar subcomponentes para configuração de opções de escolha única e regras de não conformidade.
- [ ] **Passo 5:** Desenvolver o componente `template-preview` simulando a experiência do técnico.
- [ ] **Passo 6:** Escrever testes de componentes para adição de seções, validações e publicação de versão.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Supervisor consegue montar um checklist com 2 seções e múltiplos tipos de respostas.
- [ ] **CA-02:** O preview exibe os inputs renderizados de acordo com as opções configuradas.
- [ ] **CA-03:** A tentativa de publicar sem itens exibe mensagem clara de bloqueio.
- [ ] **CA-04:** Publicação gera nova versão e atualiza o status na listagem.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
