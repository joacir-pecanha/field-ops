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
- `web/src/app/pages/inspections/inspection.service.ts` (Contratos de revisão, evidências, não conformidades, histórico e métodos HTTP)
- `web/src/app/pages/inspections/inspection-review.component.ts` / `.html` (Tela principal de revisão técnica)
- `web/src/app/pages/inspections/components/checklist-review-tree.component.ts` (Visualização hierárquica de seções e itens)
- `web/src/app/pages/inspections/components/evidence-lightbox.component.ts` (Visualizador modal de imagens em tela cheia)
- `web/src/app/pages/inspections/components/rejection-modal.component.ts` (Modais de aprovação opcional e reprovação com motivo obrigatório)
- `web/src/app/pages/inspections/components/location-map.component.ts` (Componente de mapa exibindo coordenadas de início e término)
- `web/src/app/pages/inspections/inspection-list.component.html` (Atalho "Revisar" na listagem e no modal de detalhes)
- `web/src/app/app.routes.ts` (Rotas `/app/inspections/:inspectionId/review` e `/app/inspections/:inspectionId`)
- `web/src/app/shared/styles/master-crud.scss` (Badges semânticos compartilhados de criticidade de não conformidade)
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
- [x] **Passo 1:** Criar métodos no serviço `inspection.service.ts` para carregar dados completos de revisão e submeter pareceres.
- [x] **Passo 2:** Desenvolver o componente `checklist-review-tree` exibindo perguntas e respostas tipadas.
- [x] **Passo 3:** Implementar o visualizador de imagens `evidence-lightbox` com navegação entre fotos.
- [x] **Passo 4:** Criar componente `location-map` utilizando OpenStreetMap / Leaflet ou coordenadas formatadas.
- [x] **Passo 5:** Desenvolver os modais de aprovação e reprovação com validação de texto.
- [x] **Passo 6:** Escrever testes de componentes para o fluxo de revisão e submissão de veredito.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Supervisor visualiza todas as respostas, fotos e não conformidades em uma única tela.
- [x] **CA-02:** Clicar em uma foto abre o modal com a imagem em alta resolução.
- [x] **CA-03:** Aprovar inspeção atualiza a visualização com badge `APROVADA` e desabilita novas ações.
- [x] **CA-04:** Reprovar sem preencher o motivo é bloqueado; preencher o motivo envia a solicitação e exibe toast de sucesso.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Data da Execução:** 2026-11-22
- **Passo 1 (`web/src/app/pages/inspections/inspection.service.ts`):** Estendido `InspectionDetailsResponse` de forma retrocompatível com campos de revisão, geolocalização de início/fim, `responses`, `nonConformities`, `evidences` e `reviews`; adicionados os métodos `getReviewDetails`, `startReview`, `approve`, `reject`, `getReviewHistory`, `getEvidenceContentUrl` e `getEvidenceBlob`, além de helpers puros para ordenação por severidade (`sortNonConformitiesBySeverity`), bloqueio de ações em `APROVADA`/`CANCELADA` (`isInspectionActionLocked`) e resolução de URLs/metadados de evidências.
- **Passo 2 (`web/src/app/pages/inspections/components/checklist-review-tree.component.ts`):** Criado `ChecklistReviewTreeComponent` agrupando os itens por seção na ordem congelada do snapshot, exibindo respostas tipadas para todos os 8 `ResponseType`, observações do técnico, bloco diferenciado de ajuste administrativo auditado preservando a resposta original (`RN-084`, `RN-085`), miniaturas de evidências vinculadas e fallback amigável `"Imagem indisponível"` em erro de carregamento (`EX-02`).
- **Passo 3 (`web/src/app/pages/inspections/components/evidence-lightbox.component.ts`):** Criado `EvidenceLightboxComponent` em tela cheia com zoom (`50%` a `300%` e clique na imagem), navegação entre fotos por botões, faixa de miniaturas e teclado (`ArrowLeft`, `ArrowRight`, `Escape`, `+`, `-`, `0`) e fallback em erro de imagem (`EX-02`).
- **Passo 4 (`web/src/app/pages/inspections/components/location-map.component.ts`):** Criado `LocationMapComponent` exibindo coordenadas formatadas de início e conclusão com precisão (`±m`) e timestamp (`RN-062`), cálculo de deslocamento geodésico (Haversine), links diretos para o OpenStreetMap, mapa vetorial SVG e opção sob demanda para carregar o mapa embarcado do OpenStreetMap sem disparar requisições externas automáticas.
- **Passo 5 (`web/src/app/pages/inspections/components/rejection-modal.component.ts`):** Criados `RejectionModalComponent` e `ApprovalModalComponent`. O modal de reprovação valida estritamente motivo não vazio (`trim().length > 0`, bloqueando espaços em branco — `EX-01`), o modal de aprovação oferece campo opcional de parecer técnico (`RN-081`) e ambos respeitam o bloqueio para inspeções `APROVADA`/`CANCELADA` (`RT-03`).
- **Passo 6 (`inspection-review.component.ts` / `.html`, rotas, atalho e testes):**
  - Criada a tela `InspectionReviewComponent` com layout responsivo em duas colunas para desktop/notebook (`>= 1024px`), cabeçalho completo (`RF-01`), seção destacada de Não Conformidades ordenadas por severidade (`CRITICA` → `ALTA` → `MEDIA` → `BAIXA`, `RF-05`), carregamento autenticado de blobs de evidência com `URL.createObjectURL` e revogação no destroy, árvore do checklist, localização no mapa, histórico de revisões, trilha de auditoria e fluxo completo de iniciar revisão / aprovar / reprovar com toast de sucesso e bloqueio pós-aprovação/cancelamento (`RT-03`).
  - Habilitadas rotas `/app/inspections/:inspectionId/review` e `/app/inspections/:inspectionId` em `web/src/app/app.routes.ts` e atalho **Revisar** em `web/src/app/pages/inspections/inspection-list.component.html`.
  - Criados 16 testes unitários em `web/src/app/pages/inspections/inspection-review.component.spec.ts` cobrindo serviço HTTP, árvore do checklist, fallback de imagem, lightbox, mapa, validação dos modais (`EX-01`, `RT-03`) e fluxo completo da tela de revisão (`CA-01` a `CA-04`).
- **Evidências de Verificação:**
  - `npm --prefix web run typecheck`: aprovado (`0` erros).
  - `npm --prefix web run build`: aprovado (`dist/web` gerado; nenhum warning de budget CSS nos componentes da `TASK-020`).
  - `npm --prefix web run test:ci`: **110/110 testes aprovados** no Karma / Edge Headless (`0` falhas, `0` ignorados).
