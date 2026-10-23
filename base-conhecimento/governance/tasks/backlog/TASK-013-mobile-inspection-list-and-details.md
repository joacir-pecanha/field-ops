# TASK-013: Interface Mobile de Listagem de Inspeções Atribuídas e Detalhes Offline

## 1. Metadados
- **ID:** TASK-013
- **Épico / Módulo:** Mobile / Inspeções & Navegação
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md), [docs/aplicativo_mobile.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/aplicativo_mobile.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
O técnico em campo precisa de uma interface ágil e clara para visualizar sua carga de trabalho diária. As inspeções baixadas durante a sincronização devem permanecer disponíveis offline em SQLite. A tela deve apresentar informações críticas de forma direta (cliente, endereço do local, equipamento, prioridade, data limite) e permitir navegação rápida para iniciar ou continuar o checklist.

---

## 3. Arquivos Impactados
- `mobile/src/app/(protected)/(tabs)/index.tsx` (Dashboard Home do técnico com contadores e atalhos rápidos)
- `mobile/src/app/(protected)/(tabs)/inspections.tsx` (Lista de inspeções com abas de status)
- `mobile/src/app/(protected)/inspections/[inspectionId]/index.tsx` (Detalhes completos da inspeção)
- `mobile/src/features/inspections/components/InspectionCard.tsx` (Card de inspeção com status, prioridade e prazo)
- `mobile/src/features/inspections/hooks/useInspectionList.ts` (Hook de consulta local em SQLite)
- `mobile/src/features/inspections/hooks/useInspectionDetails.ts` (Hook de detalhes da inspeção)
- `mobile/__tests__/features/inspections/InspectionCard.test.tsx` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Exibir apenas inspeções atribuídas ao técnico autenticado (RN-004, AC-MOBILE-LIST).
- **RF-02:** A listagem deve apresentar estado, prioridade, data prevista, cliente e local da atividade (AC-MOBILE-LIST).
- **RF-03:** Diferenciação visual clara entre inspeções atrasadas, em andamento e pendentes de envio (AC-MOBILE-LIST).
- **RF-04:** Filtragem local por estado (`TODAS`, `PENDENTES`, `EM_ANDAMENTO`, `CONCLUÍDAS`) e busca por texto (AC-MOBILE-LIST).
- **RF-05:** Tela de detalhes apresentando informações do equipamento (nome, código, QR Code previsto), endereço completo e botão de ação dinâmico ("Iniciar Inspeção", "Continuar Checklist" ou "Consultar") (AC-MOBILE-LIST).
- **RF-06:** Funcionamento 100% offline para inspeções previamente baixadas no SQLite (RN-065, AC-MOBILE-LIST).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Leitura primária em SQLite via repositório local sem bloquear a interface em caso de indisponibilidade de rede.
- **RT-02:** Tratamento de estado vazio amigável ("Nenhuma inspeção atribuída no momento") ao invés de mensagens de erro (AC-MOBILE-LIST).
- **RT-03:** Preservação de dados locais intactos mesmo se a chamada de refresh falhar na rede (AC-MOBILE-LIST).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de abrir inspeção que pertence a outro usuário deve retornar aviso de permissão negada e retornar à lista.
- **EX-02:** Em caso de falha de conexão durante o pull-to-refresh, exibir um snackbar discreto mantendo os dados da tela inalterados.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Criar consultas tipadas em `inspectionRepository.ts` para listagem com filtros e busca por ID.
- [ ] **Passo 2:** Desenvolver hooks reativos `useInspectionList` e `useInspectionDetails` integrados ao SQLite.
- [ ] **Passo 3:** Implementar o componente reutilizável `InspectionCard` com badges de prioridade e status.
- [ ] **Passo 4:** Criar a tela `(tabs)/index.tsx` com contadores de hoje, atrasadas e botão rápido de sincronizar.
- [ ] **Passo 5:** Criar a tela de lista `(tabs)/inspections.tsx` com tabs e busca.
- [ ] **Passo 6:** Criar a tela de detalhes `[inspectionId]/index.tsx`.
- [ ] **Passo 7:** Escrever testes de renderização com Jest e React Native Testing Library.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** A lista exibe as inspeções atribuídas ordenadas por data com dados carregados do SQLite local.
- [ ] **CA-02:** Desativar a conexão de rede no dispositivo/emulador e navegar entre lista e detalhes sem nenhuma lentidão ou falha.
- [ ] **CA-03:** O botão de ação altera de "Iniciar" para "Continuar" quando o status é `EM_ANDAMENTO`.
- [ ] **CA-04:** `npx tsc --noEmit` executa sem erros.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
