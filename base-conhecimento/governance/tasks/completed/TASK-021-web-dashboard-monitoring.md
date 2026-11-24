# TASK-021: Dashboard Operacional e Acompanhamento Gerencial na Interface Web

## 1. Metadados
- **ID:** TASK-021
- **Épico / Módulo:** Web Admin / Dashboard & Monitoramento
- **Status:** IN_PROGRESS
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-11-24

---

## 2. Contexto e Valor de Negócio
O Dashboard é a visão executiva do FieldOps para o supervisor e o administrador. Ele consolida indicadores vitais sobre o ritmo operacional das inspeções: total de atividades programadas, contagem de inspeções em atraso, número de inspeções aguardando revisão e ocorrências de não conformidades agrupadas por severidade. Ele oferece atalhos rápidos para que o supervisor atue imediatamente nas pendências mais críticas.

---

## 3. Arquivos Impactados
- `backend/src/main/java/com/fieldops/modules/inspection/repository/InspectionRepository.java` (Queries agregadas de contagem por status, atrasadas e listagem recente)
- `backend/src/main/java/com/fieldops/modules/sync/repository/NonConformityRepository.java` (Query agregada de não conformidades ativas por severidade)
- `backend/src/main/java/com/fieldops/modules/inspection/dto/DashboardMetricsResponse.java` (DTO consolidado de métricas do Dashboard)
- `backend/src/main/java/com/fieldops/modules/inspection/service/DashboardMetricsService.java` (Serviço agregador leve de indicadores)
- `backend/src/main/java/com/fieldops/modules/inspection/controller/DashboardController.java` (Endpoint `GET /api/v1/dashboard/metrics`)
- `backend/src/main/java/com/fieldops/config/DevBootstrapSeedConfig.java` (Massa inicial enriquecida com inspeção `EM_ANDAMENTO`, inspeção `ENVIADA` e 4 NCs para validação do Dashboard)
- `backend/src/test/java/com/fieldops/modules/inspection/InspectionReviewIntegrationTest.java` (Teste de integração do endpoint e RBAC)
- `web/src/app/pages/dashboard/dashboard.component.ts` / `.html` (Página principal do Dashboard)
- `web/src/app/pages/dashboard/components/metric-card.component.ts` (Card com número, ícone, gradiente e skeleton loader)
- `web/src/app/pages/dashboard/components/severity-chart.component.ts` (Barras de distribuição de não conformidades por gravidade)
- `web/src/app/pages/dashboard/components/recent-inspections.component.ts` (Tabela rápida de inspeções recentes com badges clicáveis)
- `web/src/app/pages/dashboard/dashboard.service.ts` (Serviço HTTP de métricas com cache de curta duração)
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
- [x] **Passo 1:** Criar endpoint backend `/api/v1/dashboard/metrics` retornando DTO consolidado de contadores.
- [x] **Passo 2:** Desenvolver `dashboard.service.ts` no frontend com cache de curta duração.
- [x] **Passo 3:** Implementar o componente reutilizável `metric-card` com gradientes e tipografia moderna.
- [x] **Passo 4:** Criar componente visual de distribuição de severidade de não conformidades.
- [x] **Passo 5:** Integrar tabela de inspeções recentes com badges de status clicáveis.
- [x] **Passo 6:** Escrever testes unitários para o carregamento e renderização dos cards.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Dashboard carrega e renderiza todos os 4 cards de métricas principais.
- [x] **CA-02:** Clicar no card "Aguardando Revisão" filtra e direciona para a lista correspondente.
- [x] **CA-03:** A distribuição de não conformidades reflete com precisão os dados cadastrados.
- [x] **CA-04:** Interface responsiva sem barras de rolagem horizontais em notebook.
- [x] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Data da Execução:** 2026-11-24
- **Passo 1 (Backend `/api/v1/dashboard/metrics`):**
  - Adicionadas queries agregadas em `InspectionRepository` (`countGroupedByStatus`, `countOverdue`, `findByStatusNotOrderByUpdatedAtDescScheduledForDesc`) e `NonConformityRepository` (`countActiveGroupedBySeverity`, desconsiderando ocorrências `CANCELED`).
  - Criados `DashboardMetricsResponse`, `DashboardMetricsService` e `DashboardController` expondo `GET /api/v1/dashboard/metrics` restrito a `ADMIN` e `SUPERVISOR` com retorno consolidado de totais por status, atrasadas, aguardando revisão (`ENVIADA + EM_REVISÃO`), severidades (`BAIXA`, `MEDIA`, `ALTA`, `CRITICA`) e atividades recentes com contagem em lote de snapshots.
  - Adicionado teste de integração em `InspectionReviewIntegrationTest` validando agregação, RBAC (401/403) e documentação OpenAPI (`/v3/api-docs`).
- **Passo 2 (`web/src/app/pages/dashboard/dashboard.service.ts`):**
  - Implementado `DashboardService` com cache em memória de curta duração (`CACHE_TTL_MS = 15_000` ms) via `shareReplay`, suporte a `refreshMetrics()` (recarga forçada), normalização defensiva de contadores e invalidação imediata do cache em caso de falha HTTP (`DashboardApiError`).
- **Passo 3 (`web/src/app/pages/dashboard/components/metric-card.component.ts`):**
  - Implementado `MetricCardComponent` reutilizável com gradientes semânticos, ícones SVG, `tabular-nums`, acessibilidade por teclado (`role="button"`, `Enter`/`Space`) e skeleton loader (`RT-02`).
- **Passo 4 (`web/src/app/pages/dashboard/components/severity-chart.component.ts`):**
  - Implementado `SeverityChartComponent` com barra empilhada proporcional, barras individuais para `CRITICA`, `ALTA`, `MEDIA` e `BAIXA` com percentuais exatos e estado vazio encorajador com contadores zerados (`EX-01`).
- **Passo 5 (`recent-inspections.component.ts` e `dashboard.component.ts` / `.html`):**
  - Implementada tabela de inspeções recentes com badges de status clicáveis (filtrando `/app/inspections?status=...`) e clique na linha/botão direcionando diretamente para `/app/inspections/:id/review`.
  - Substituído o placeholder de `DashboardComponent` pela visão executiva completa com atalhos rápidos (`Nova Inspeção`, `Revisar Pendentes`, `Ver Atrasadas`), botão de atualização manual (`Atualizar dados`), mensagem `"Nenhuma inspeção em atraso no momento!"` quando aplicável (`EX-01`) e banner de erro resiliente com botão `"Tentar Novamente"` sem quebrar o layout (`EX-02`).
- **Passo 6 (`web/src/app/pages/dashboard/dashboard.component.spec.ts`):**
  - Criada suíte unitária cobrindo `DashboardService` (cache TTL, `refreshMetrics` e erro), `MetricCardComponent`, `SeverityChartComponent`, `RecentInspectionsComponent` e `DashboardComponent` (`CA-01`, `CA-02`, `CA-03`, `RT-02`, `EX-01`, `EX-02`, `RF-03`, `RF-04`, `RF-05`).
- **Evidências de Verificação:**
  - `npm --prefix web run typecheck`: aprovado (`0` erros).
  - `npm --prefix web run build`: aprovado (`dist/web` gerado sem warnings de budget nos componentes do dashboard).
  - `npm --prefix web run test:ci`: **122/122 testes aprovados** (Edge Headless, `0` falhas).
  - `.\backend\mvnw.cmd -f backend\pom.xml test "-Djava.version=23"`: **44/44 testes aprovados** (`0` falhas, `0` erros, `0` ignorados). Note-se que o `pom.xml` declara `<java.version>26</java.version>` e o ambiente local possui JDK `23.0.1`, sendo necessário passar `"-Djava.version=23"` na linha de comando Maven.
