# TASK-022: Roteiro de Demonstração E2E, Massa de Testes (Seed Data) e Validação de Release do MVP

## 1. Metadados
- **ID:** TASK-022
- **Épico / Módulo:** Infra & E2E / Release MVP
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md) (Seção 17.19 AC-RELEASE), [docs/checklist-executivo.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/checklist-executivo.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
Para a entrega final do MVP e homologação com stakeholders e banca avaliadora, a plataforma FieldOps deve comprovar a execução do fluxo ponta a ponta descrito no critério AC-RELEASE, sem necessidade de edição direta no banco de dados durante a demonstração. Esta tarefa consolida os scripts de carga de dados iniciais (Seed Data) e o roteiro de homologação executiva contendo todos os 19 passos do fluxo integrado.

---

## 3. Arquivos Impactados
- `backend/src/main/resources/db/seed/R__demo_seed_data.sql` (Carga reprodutível de usuários, clientes, locais, equipamentos e template publicado)
- `docs/roteiro-demonstracao-e2e.md` (Roteiro passo a passo para a demonstração final)
- `scripts/e2e-healthcheck.sh` / `scripts/e2e-healthcheck.ps1` (Script de validação automatizada de integridade dos serviços)
- `mobile/assets/demo-qr-codes/` (Imagens para impressão dos QR Codes de teste)
- `docs/evidencias-release-mvp.md` (Checklist executivo com evidências de teste e limitações registradas)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Disponibilizar massa de dados pré-configurada contendo:
  - 1 Administrador (`admin@fieldops.com`), 1 Supervisor (`supervisor@fieldops.com`), 1 Técnico (`tecnico@fieldops.com`).
  - 1 Cliente com 2 Locais distintos.
  - 3 Equipamentos cadastrados com códigos e QR Codes únicos.
  - 1 Modelo publicado completo contendo todos os 7 tipos de resposta obrigatórios.
  - 1 Inspeção atribuída de teste pronta para download.
- **RF-02:** Validar o roteiro completo dos 19 passos do critério AC-RELEASE (do login administrativo à aprovação final com sincronização sem duplicidade) (AC-RELEASE).
- **RF-03:** Validar simulação de queda de conectividade (modo avião / offline) durante a execução do checklist e sincronização bem-sucedida após o retorno da rede (RN-065 a RN-078).
- **RF-04:** Registro formal das limitações conhecidas do MVP e preenchimento integral do Checklist Executivo (DoD 18.6).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Script de Seed idempotente e reexecutável sem corromper dados existentes.
- **RT-02:** Build Android executável (`.apk` de demonstração ou execução direta via Expo Go) (DoD 18.6).
- **RT-03:** Build da interface Web executável ou servida localmente sem erros de console (DoD 18.6).
- **RT-04:** API executável a partir de comandos documentados no README (DoD 18.6).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Dados corrompidos durante o teste devem ser redefinidos de forma instantânea através do script de seed.
- **EX-02:** Registro explícito de que operações em segundo plano não suportadas (ex: portal público, IoT) pertencem a versões futuras (P2).

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Escrever o script SQL `R__demo_seed_data.sql` com senhas criptografadas em BCrypt.
- [ ] **Passo 2:** Gerar arquivos de imagem PNG com os QR Codes de demonstração e salvar em pasta acessível.
- [ ] **Passo 3:** Executar o fluxo ponta a ponta completo simulando o usuário Supervisor (Web) e Técnico (Mobile).
- [ ] **Passo 4:** Validar cenários de desconexão de rede (conclusão offline e envio posterior sem duplicidade).
- [ ] **Passo 5:** Elaborar documento `roteiro-demonstracao-e2e.md` com prints e passo a passo cronometrado.
- [ ] **Passo 6:** Revisar o cumprimento integral de todos os itens do `checklist-executivo.md`.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** O fluxo ponta a ponta dos 19 passos do AC-RELEASE é executado com 100% de sucesso sem interrupções.
- [ ] **CA-02:** O script de seed popula o ambiente com dados consistentes em menos de 10 segundos.
- [ ] **CA-03:** Nenhum erro de duplicação ocorre após reconexão e reenvio de lote.
- [ ] **CA-04:** Documento de roteiro e limitações revisado e publicado.
- [ ] **CA-05:** Aprovação e validação final de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
