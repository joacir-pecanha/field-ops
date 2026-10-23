# TASK-014: Scanner de QR Code de Equipamentos e Validação de Divergências no Mobile

## 1. Metadados
- **ID:** TASK-014
- **Épico / Módulo:** Mobile / Leitura de QR Code
- **Status:** APPROVED
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [docs/aplicativo_mobile.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/aplicativo_mobile.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** Pendente

---

## 2. Contexto e Valor de Negócio
Em inspeções técnicas industriais ou prediais, é frequente que o técnico encontre vários equipamentos semelhantes lado a lado. A leitura do QR Code fixado no equipamento garante que a inspeção esteja sendo executada no ativo correto. Caso o QR Code lido divirja do previsto na inspeção agendada, o aplicativo deve alertar o técnico explicitamente antes de permitir o avanço do preenchimento.

---

## 3. Arquivos Impactados
- `mobile/src/app/(protected)/scanner.tsx` (Tela do leitor de QR Code integrada à rota modal)
- `mobile/src/features/scanner/components/CameraScannerOverlay.tsx` (Mira visual, controle de flash e feedback sonoro/tátil)
- `mobile/src/features/scanner/hooks/useCameraPermission.ts` (Hook de permissão nativa de câmera)
- `mobile/src/features/scanner/services/qrValidator.ts` (Serviço de validação de compatibilidade com a inspeção)
- `mobile/src/features/scanner/components/DivergenceModal.tsx` (Diálogo de alerta em caso de código incompatível)
- `mobile/__tests__/scanner/qrValidator.test.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Solicitar consentimento explícito do usuário antes de abrir a câmera (RN-058, AC-QR).
- **RF-02:** Em caso de permissão negada, apresentar orientação explicativa e permitir digitação manual do código do equipamento (RN-059, AC-QR).
- **RF-03:** Leitura única com debounce para prevenir disparos repetidos no mesmo ciclo (AC-QR).
- **RF-04:** Comparar o código lido com o `equipment_qr_code` registrado no snapshot da inspeção (RN-064, AC-QR).
- **RF-05:** Se houver correspondência, confirmar a identificação com feedback tátil/visual e avançar automaticamente para o checklist.
- **RF-06:** Se houver divergência, exibir alerta crítico informando o equipamento esperado vs equipamento lido e exigir confirmação justificada ou cancelamento (RN-064, AC-QR).
- **RF-07:** A leitura de QR Code não deve autorizar acesso a equipamentos fora do escopo atribuído ao técnico (RN-063, AC-QR).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar `expo-camera` (`CameraView`) moderna compatível com Expo 57.
- **RT-02:** Permitir ligar/desligar a lanterna (flash) para ambientes de baixa luminosidade em campo.
- **RT-03:** Manter funcionamento 100% offline consultando o banco SQLite local.

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Equipamento com QR Code danificado ou ilegível permite fluxo alternativo de confirmação manual mediante confirmação explícita.
- **EX-02:** Código QR não reconhecido no catálogo do sistema produz mensagem "Código QR não identificado no FieldOps" sem travar o aplicativo.

---

## 5. Plano de Execução Passo a Passo
- [ ] **Passo 1:** Implementar hook de permissão de câmera com tratamento de status negado / bloqueado.
- [ ] **Passo 2:** Desenvolver a tela `scanner.tsx` com componente `CameraView` e máscara com mira central.
- [ ] **Passo 3:** Implementar lógica de debounce e verificação no serviço `qrValidator.ts`.
- [ ] **Passo 4:** Criar o modal `DivergenceModal.tsx` para apresentar alertas de divergência.
- [ ] **Passo 5:** Criar formulário modal de fallback para digitação manual do código de patrimônio.
- [ ] **Passo 6:** Escrever testes unitários para a regra de validação de correspondência e divergência.

---

## 6. Critérios de Aceitação (Definition of Done)
- [ ] **CA-01:** Ler o QR Code correto valida o equipamento e direciona para o início do checklist.
- [ ] **CA-02:** Ler um QR Code divergente bloqueia o avanço imediato e exibe alerta com dados dos dois equipamentos.
- [ ] **CA-03:** Se a permissão de câmera for negada, o técnico consegue prosseguir digitando o código manualmente.
- [ ] **CA-04:** `npx tsc --noEmit` executa sem erros de tipagem.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
*(Preenchido durante o desenvolvimento)*
