# TASK-008: Telas de Gestão Administrativa de Clientes, Locais e Equipamentos

## 1. Metadados
- **ID:** TASK-008
- **Épico / Módulo:** Web Admin / Cadastros Mestres
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/inferface-web.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/inferface-web.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
Supervisores e administradores necessitam de uma interface eficiente para cadastrar, editar e consultar a estrutura de clientes, unidades/locais e parques de equipamentos. A interface deve permitir a geração visual do QR Code único para fixação física nos equipamentos e fornecer mecanismos claros de filtragem e inativação de registros.

---

## 3. Arquivos Impactados
- `web/src/app/pages/users/users-list.component.ts` / `.html` (Gestão de usuários e perfis)
- `web/src/app/pages/clients/clients-list.component.ts` / `.html` (Listagem e cadastro de clientes)
- `web/src/app/pages/sites/sites-list.component.ts` / `.html` (Listagem e cadastro de locais)
- `web/src/app/pages/equipment/equipment-list.component.ts` / `.html` (Gestão de equipamentos)
- `web/src/app/pages/equipment/components/qr-code-modal.component.ts` (Modal de exibição e impressão do QR Code)
- `web/src/app/shared/components/confirm-modal/confirm-modal.component.ts` (Modal genérico de confirmação para ações críticas)
- `web/src/app/shared/components/pagination/pagination.component.ts` (Componente de paginação)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Listar Clientes, Locais e Equipamentos com suporte a busca textual por nome, documento ou código (AC-MASTER).
- **RF-02:** Ao cadastrar/editar um Local, exigir a seleção obrigatória de um Cliente ativo (RN-009).
- **RF-03:** Ao cadastrar/editar um Equipamento, permitir selecionar somente Locais pertencentes ao Cliente selecionado (RN-010, RN-014).
- **RF-04:** Gerar QR Code único com base no identificador/código do equipamento e permitir impressão ou download em imagem (AC-MASTER, RN-011).
- **RF-05:** Inativação de registros mediante confirmação explícita em modal com alerta sobre impedimento em novas inspeções (DoD 18.3, RN-013).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar paginação no cliente integrada aos parâmetros `page`, `size` e `sort` da API (DoD 18.3).
- **RT-02:** Tratamento dos estados de carregamento (skeletons / spinners), estado vazio amigável e exibição de erros 400/409 (DoD 18.3).
- **RT-03:** Validação em tempo real dos formulários com mensagens claras de erro por campo.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Tentativa de inativar cliente com inspeções ativas deve exibir modal informativo com confirmação adicional.
- **EX-02:** Erro de colisão de código QR retornado pela API deve ser destacado diretamente no campo com feedback visual em vermelho.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Criar serviços HTTP no frontend para consumo dos endpoints de Users, Clients, Sites e Equipment.
- [ ] **Passo 2:** Implementar tabelas com ordenação e paginação para cada entidade.
- [ ] **Passo 3:** Desenvolver formulários reativos para criação e edição com validações assíncronas.
- [ ] **Passo 4:** Implementar componente de geração de QR Code usando biblioteca de renderização em Canvas/SVG (ex: `qrcode`).
- [ ] **Passo 5:** Integrar modais de confirmação para ações críticas de inativação.
- [ ] **Passo 6:** Escrever testes de componentes para as telas de listagem e formulários.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Administrador consegue cadastrar um fluxo completo: Cliente -> Local -> Equipamento com QR Code gerado.
- [ ] **CA-02:** Seleção de Local filtra automaticamente apenas os equipamentos vinculados a ele.
- [ ] **CA-03:** O QR Code gerado pode ser visualizado e impresso em alta definição.
- [ ] **CA-04:** Nenhuma ação crítica de inativação ocorre sem diálogo de confirmação.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
