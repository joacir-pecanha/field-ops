# TASK-014: Scanner de QR Code de Equipamentos e Validação de Divergências no Mobile

## 1. Metadados
- **ID:** TASK-014
- **Épico / Módulo:** Mobile / Leitura de QR Code
- **Status:** IN_REVIEW
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
- [x] **Passo 1:** Implementar hook de permissão de câmera com tratamento de status negado / bloqueado.
- [x] **Passo 2:** Desenvolver a tela `scanner.tsx` com componente `CameraView` e máscara com mira central.
- [x] **Passo 3:** Implementar lógica de debounce e verificação no serviço `qrValidator.ts`.
- [x] **Passo 4:** Criar o modal `DivergenceModal.tsx` para apresentar alertas de divergência.
- [x] **Passo 5:** Criar formulário modal de fallback para digitação manual do código de patrimônio.
- [x] **Passo 6:** Escrever testes unitários para a regra de validação de correspondência e divergência.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Ler o QR Code correto valida o equipamento e direciona para o início do checklist.
- [x] **CA-02:** Ler um QR Code divergente bloqueia o avanço imediato e exibe alerta com dados dos dois equipamentos.
- [x] **CA-03:** Se a permissão de câmera for negada, o técnico consegue prosseguir digitando o código manualmente.
- [x] **CA-04:** `npx tsc --noEmit` executa sem erros de tipagem.
- [ ] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Dependência:** Adicionada `expo-camera@~57.0.6` e plugin configurado em `mobile/app.json`, respeitando a versão compatível com Expo SDK 57.
- **Permissão e Consentimento (`RF-01`, `RF-02`, `RN-058`, `RN-059`):** Criado `mobile/src/features/scanner/hooks/useCameraPermission.ts` com `resolveCameraPermissionState` e gate explícito de consentimento antes de acionar `CameraView`, além de orientação distinta para estados `denied` e `blocked` com fallback manual imediato.
- **Validação 100% Offline & Debounce (`RF-03`, `RF-04`, `RF-06`, `RF-07`, `RT-03`, `EX-02`):** Implementados `QrScanSessionGuard`, `createQrScanDebounceController`, `validateScannedQrCode` e `confirmEquipmentVerification` em `mobile/src/features/scanner/services/qrValidator.ts`, consultando o SQLite local via `InspectionRepository`, garantindo escopo por técnico (`isInspectionAssignedToTechnician`), mensagem exata `"Código QR não identificado no FieldOps"` para códigos não reconhecidos e transição `EM_ANDAMENTO` + enfileiramento `START_INSPECTION` no Outbox.
- **Componentes e Tela (`RT-01`, `RT-02`, `CA-01`, `CA-02`, `CA-03`, `EX-01`):** Implementados `CameraScannerOverlay.tsx` (irmão absoluto do `CameraView`, mira central, lanterna e botão de etiqueta danificada), `DivergenceModal.tsx` (comparativo esperado vs lido e justificativa técnica mínima de 10 caracteres), `ManualCodeModal.tsx` (fallback com seleção de motivo e confirmação explícita) e `mobile/src/app/(protected)/scanner.tsx` (registrado em `(protected)/_layout.tsx`, `router.d.ts`, integrado na Home `(tabs)/index.tsx` e nos Detalhes da Inspeção `[inspectionId]/index.tsx` com liberação interativa de checklist via `DynamicItemRenderer` persistido em SQLite).
- **Verificações Executadas:**
  - `node mobile\node_modules\typescript\bin\tsc -p mobile\tsconfig.json --noEmit` -> Exit code `0` (0 erros).
  - `npm --prefix mobile test` -> Exit code `0` (`131` testes aprovados em `37` suítes, `0` falhas).
