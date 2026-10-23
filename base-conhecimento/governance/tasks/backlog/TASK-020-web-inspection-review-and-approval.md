# TASK-020: Interface Web para Revisão Técnica, Visualização de Evidências e Aprovação

## 1. Metadados
- **ID:** TASK-020
- **Épico / Módulo:** Web Admin / Revisão Técnica
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
A tela de revisão é onde o supervisor técnico avalia minuciosamente o resultado do trabalho executado pelo técnico de campo. A interface deve exibir de forma organizada as seções do checklist, respostas fornecidas, comentários do técnico, fotos capturadas em alta definição com zoom, registro de não conformidades com destaque de criticidade e localização geográfica no mapa. A partir desta tela, o supervisor emite o parecer final de aprovação ou reprovação com motivo.

---

## 3. Arquivos Impactados
- `web/src/app/pages/inspections/inspection-review.component.ts` / `.html` (Tela principal de revisão técnica)
- `web/src/app/pages/inspections/components/checklist-review-tree.component.ts` (Visualização hierárquica de seções e itens)
- `web/src/app/pages/inspections/components/evidence-lightbox.component.ts` (Visualizador modal de imagens em tela cheia)
- `web/src/app/pages/inspections/components/rejection-modal.component.ts` (Modal de reprovação com campo obrigatório de motivo)
- `web/src/app/pages/inspections/components/location-map.component.ts` (Componente de mapa exibindo coordenadas de início e término)
- `web/src/app/pages/inspections/inspection-review.component.spec.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Exibir cabeçalho com identificação da inspeção, cliente, local, equipamento, técnico responsável, data de início e conclusão (AC-REVIEW).
- **RF-02:** Renderizar respostas organizadas por seções e itens mantendo o texto do snapshot original (AC-REVIEW).
- **RF-03:** Exibir miniaturas das evidências fotográficas vinculadas aos itens, com abertura em modal de alta resolução com zoom (AC-REVIEW).
- **RF-04:** Exibir coordenadas geográficas capturadas no início e conclusão em mapa ou link de localização (RN-062, AC-REVIEW).
- **RF-05:** Seção destacada com todas as Não Conformidades registradas, ordenadas por severidade (AC-REVIEW).
- **RF-06:** Botão "Aprovar Inspeção" abrindo modal de confirmação com campo opcional de parecer técnico (RN-081, AC-REVIEW).
- **RF-07:** Botão "Reprovar Inspeção" abrindo modal com campo obrigatório de motivo da recusa (RN-080, AC-REVIEW).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Tratamento de estados de carregamento, estado vazio e erro de carregamento das fotos (DoD 18.3).
- **RT-02:** Interface otimizada para navegadores desktop e notebooks (resolução 1366x768 ou superior) (DoD 18.3).
- **RT-03:** Desabilitação dos botões de ação caso a inspeção já se encontre nos estados `APROVADA` ou `CANCELADA`.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Bloqueio do botão de envio de reprovação enquanto o campo de motivo estiver vazio ou contiver apenas espaços.
- **EX-02:** Falha no carregamento de uma imagem exibe placeholder amigável de imagem indisponível sem quebrar o layout da tela.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Criar métodos no serviço `inspection.service.ts` para carregar dados completos de revisão e submeter pareceres.
- [ ] **Passo 2:** Desenvolver o componente `checklist-review-tree` exibindo perguntas e respostas tipadas.
- [ ] **Passo 3:** Implementar o visualizador de imagens `evidence-lightbox` com navegação entre fotos.
- [ ] **Passo 4:** Criar componente `location-map` utilizando OpenStreetMap / Leaflet ou coordenadas formatadas.
- [ ] **Passo 5:** Desenvolver os modais de aprovação e reprovação com validação de texto.
- [ ] **Passo 6:** Escrever testes de componentes para o fluxo de revisão e submissão de veredito.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Supervisor visualiza todas as respostas, fotos e não conformidades em uma única tela.
- [ ] **CA-02:** Clicar em uma foto abre o modal com a imagem em alta resolução.
- [ ] **CA-03:** Aprovar inspeção atualiza a visualização com badge `APROVADA` e desabilita novas ações.
- [ ] **CA-04:** Reprovar sem preencher o motivo é bloqueado; preencher o motivo envia a solicitação e exibe toast de sucesso.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
