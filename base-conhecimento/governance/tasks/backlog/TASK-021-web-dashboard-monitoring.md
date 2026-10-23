# TASK-021: Dashboard Operacional e Acompanhamento Gerencial na Interface Web

## 1. Metadados
- **ID:** TASK-021
- **Épico / Módulo:** Web Admin / Dashboard & Monitoramento
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
O Dashboard é a visão executiva do FieldOps para o supervisor e o administrador. Ele consolida indicadores vitais sobre o ritmo operacional das inspeções: total de atividades programadas, contagem de inspeções em atraso, número de inspeções aguardando revisão e ocorrências de não conformidades agrupadas por severidade. Ele oferece atalhos rápidos para que o supervisor atue imediatamente nas pendências mais críticas.

---

## 3. Arquivos Impactados
- `web/src/app/pages/dashboard/dashboard.component.ts` / `.html` (Página principal do Dashboard)
- `web/src/app/pages/dashboard/components/metric-card.component.ts` (Card com número, ícone e variação)
- `web/src/app/pages/dashboard/components/severity-chart.component.ts` (Gráfico ou barras de não conformidades por gravidade)
- `web/src/app/pages/dashboard/components/recent-inspections.component.ts` (Tabela rápida de inspeções aguardando ação)
- `web/src/app/pages/dashboard/dashboard.service.ts` (Serviço HTTP de métricas)
- `web/src/app/pages/dashboard/dashboard.component.spec.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Exibir cards de métricas consolidadas: Total de Inspeções, Em Andamento, Aguardando Revisão e Atrasadas (AC-ADMIN-MONITOR, docs/inferface-web.md 14.5).
- **RF-02:** Exibir gráfico/indicador de Não Conformidades classificadas por criticidade (`BAIXA`, `MEDIA`, `ALTA`, `CRITICA`) (AC-ADMIN-MONITOR).
- **RF-03:** Apresentar atalhos rápidos: "Nova Inspeção", "Revisar Pendentes" e "Ver Atrasadas" (docs/inferface-web.md 14.5).
- **RF-04:** Tabela de atividades recentes permitindo clicar para navegar diretamente para a tela de revisão ou detalhes (AC-ADMIN-MONITOR).
- **RF-05:** Atualização automática ou botão de recarga manual de dados sem necessidade de recarregar a página completa.

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Endpoint backend agregador leve (`GET /api/v1/dashboard/metrics`) evitando múltiplas consultas lentas.
- **RT-02:** Tratamento de skeleton loaders durante o carregamento dos cards de métricas.
- **RT-03:** Componentes visuais responsivos adaptados para notebooks e telas ultrawide.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Em caso de ausência de dados, exibir contadores com zero e mensagem encorajadora ("Nenhuma inspeção em atraso no momento!").
- **EX-02:** Falha na requisição de métricas exibe banner com botão "Tentar Novamente" sem quebrar o layout.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Criar endpoint backend `/api/v1/dashboard/metrics` retornando DTO consolidado de contadores.
- [ ] **Passo 2:** Desenvolver `dashboard.service.ts` no frontend com cache de curta duração.
- [ ] **Passo 3:** Implementar o componente reutilizável `metric-card` com gradientes e tipografia moderna.
- [ ] **Passo 4:** Criar componente visual de distribuição de severidade de não conformidades.
- [ ] **Passo 5:** Integrar tabela de inspeções recentes com badges de status clicáveis.
- [ ] **Passo 6:** Escrever testes unitários para o carregamento e renderização dos cards.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Dashboard carrega e renderiza todos os 4 cards de métricas principais.
- [ ] **CA-02:** Clicar no card "Aguardando Revisão" filtra e direciona para a lista correspondente.
- [ ] **CA-03:** A distribuição de não conformidades reflete com precisão os dados cadastrados.
- [ ] **CA-04:** Interface responsiva sem barras de rolagem horizontais em notebook.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
