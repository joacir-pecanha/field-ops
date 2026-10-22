# [TASK-ID]: [Título Conciso da Tarefa]

## 1. Metadados
- **ID:** TASK-XXX
- **Épico / Módulo:** [Mobile | Backend API | Web Admin | Infra]
- **Status:** [DRAFT | APPROVED | IN_PROGRESS | IN_REVIEW | DONE]
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** [Nome ou ID do Agente]
- **Especificação de Referência:** [governance/specs/SPEC-XXX.md](file:///c:/Users/Joacir/Desktop/field-ops/governance/specs/SPEC-XXX.md)
- **Data de Criação:** AAAA-MM-DD
- **Data de Conclusão:** AAAA-MM-DD

---

## 2. Contexto e Valor de Negócio
Contextualização da tarefa no fluxo de valor do FieldOps conforme documentado na pasta `docs/`. Explique brevemente o problema resolvido e o impacto no usuário técnico ou supervisor.

---

## 3. Arquivos Impactados
Liste todos os arquivos que serão criados, modificados ou excluídos (agentes não devem alterar arquivos fora desta lista sem autorização explícita):
- `mobile/src/...` (Modificação)
- `mobile/src/...` (Novo)
- `mobile/__tests__/...` (Testes)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** O sistema deve...
- **RF-02:** O usuário deve ser capaz de...

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Uso estrito do SQLite local como SSOT operacional.
- **RT-02:** Registro idempotente na Outbox para operações com o backend.
- **RT-03:** Schemas de validação estritos com Zod.
- **RT-04:** Compatibilidade total com Expo 57 (`react-native` 0.86, React 19).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Comportamento em caso de ausência de rede (offline).
- **EX-02:** Comportamento em caso de permissão de hardware negada (câmera, localização).
- **EX-03:** Recuperação e reabertura após encerramento inesperado do aplicativo.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Modelagem de tipos e entidades em `src/domain/`.
- [ ] **Passo 2:** Implementação do acesso a dados / repositório em `src/infrastructure/`.
- [ ] **Passo 3:** Implementação do caso de uso ou hook em `src/application/` ou `src/features/`.
- [ ] **Passo 4:** Integração de interface ou rota no `src/app/`.
- [ ] **Passo 5:** Criação e execução de testes unitários.
- [ ] **Passo 6:** Validação estática de tipos (`npx tsc --noEmit`).

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Critério funcional mensurável 1.
- [ ] **CA-02:** Critério funcional mensurável 2.
- [ ] **CA-03:** Ausência total de erros em `npx tsc --noEmit`.
- [ ] **CA-04:** Registro de auditoria e logs adequados (sem expor dados sensíveis).
- [ ] **CA-05:** Validação e aprovação final de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido pelo Agente durante o desenvolvimento)*
- **Data de Início:** 
- **Decisões Arquiteturais:** 
- **Desafios Encontrados:** 
- **Evidências de Teste:**
