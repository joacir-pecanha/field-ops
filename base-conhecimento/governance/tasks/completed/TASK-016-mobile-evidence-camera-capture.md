# TASK-016: Captura, Compressão e Armazenamento Local de Evidências Fotográficas no Mobile

## 1. Metadados
- **ID:** TASK-016
- **Épico / Módulo:** Mobile / Evidências & Fotografia
- **Status:** IN_REVIEW
- **Responsável Humano / Aprovador:** Joacir Peçanha
- **Agente Executor:** Coder Agent
- **Especificação de Referência:** [base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md](file:///c:/Users/Joacir/Desktop/field-ops/base-conhecimento/governance/specs/SPEC-001-mobile-sqlite-schema.md), [docs/criterios-de-avaliacao.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/criterios-de-avaliacao.md)
- **Data de Criação:** 2026-10-22
- **Data de Conclusão:** 2026-11-17

---

## 2. Contexto e Valor de Negócio
A fotografia técnica é a comprovação visual mais importante de uma inspeção em campo. O técnico necessita capturar fotos com boa resolução para demonstrar anomalias ou comprovar conformidade. Como o dispositivo opera sem internet por períodos prolongados, as fotos devem ser redimensionadas, comprimidas, salvas no sistema de arquivos local do aparelho e registradas no banco SQLite com referências únicas (UUID), garantindo que nunca sejam apagadas por limpezas acidentais de cache.

---

## 3. Arquivos Impactados
- `mobile/src/features/evidence/services/photoCaptureService.ts` (Captura, compressão e geração de thumbnails)
- `mobile/src/features/evidence/services/photoStorageService.ts` (Persistência em pasta dedicada do app via Expo FileSystem)
- `mobile/src/features/evidence/components/PhotoPreviewModal.tsx` (Tela de confirmação ou refazer foto)
- `mobile/src/features/evidence/components/EvidenceGallery.tsx` (Carrossel / Grid de miniaturas anexadas ao item)
- `mobile/src/app/(protected)/evidence/capture.tsx` (Rota de câmera dedicada a evidências)
- `mobile/__tests__/features/evidence/photoCaptureService.test.ts` (Testes unitários)

---

## 4. Requisitos Funcionais e Técnicos

### 4.1 Requisitos Funcionais (RF)
- **RF-01:** Solicitar permissão de câmera antes da captura (RN-058, AC-EVIDENCE).
- **RF-02:** Apresentar pré-visualização imediata após o clique, permitindo confirmar ou refazer a fotografia (AC-EVIDENCE).
- **RF-03:** Associar a fotografia a um item específico do checklist ou a uma não conformidade (RN-045, AC-EVIDENCE).
- **RF-04:** Em modo offline, a foto capturada deve permanecer no dispositivo e ser exibida na galeria local (RN-047, AC-EVIDENCE).
- **RF-05:** Criar registro na tabela `evidence_files` com status `PENDING` para futuro upload (RN-047, AC-EVIDENCE).
- **RF-06:** Cada arquivo de foto deve possuir identificador UUID próprio em vez de depender apenas do nome original do arquivo (RN-050, AC-EVIDENCE).

### 4.2 Requisitos Técnicos e Arquiteturais (RT)
- **RT-01:** Utilizar `expo-image-manipulator` para redimensionar a imagem (máx. 1920x1080 px) e comprimir em JPEG (qualidade 0.8), evitando uploads excessivamente pesados.
- **RT-02:** Salvar o arquivo no diretório persistente do app (`FileSystem.documentDirectory + 'evidences/'`), nunca no diretório temporário (`cacheDirectory`) (RN-047).
- **RT-03:** Gerar e salvar miniatura leve (thumbnail) para renderização fluida no checklist.
- **RT-04:** Sanitizar metadados sensíveis desnecessários (RN-051).

### 4.3 Tratamento de Exceções e Casos de Borda
- **EX-01:** Falha de armazenamento por falta de espaço no dispositivo deve emitir alerta sem fechar o app.
- **EX-02:** Exclusão de foto antes do envio deve ser permitida localmente; fotos de inspeções já aprovadas são estritamente somente leitura (RN-049).

---

## 5. Plano de Execução Passo a Passo
- [x] **Passo 1:** Configurar serviço de armazenamento `photoStorageService.ts` garantindo criação da pasta permanente.
- [x] **Passo 2:** Implementar pipeline de processamento e compressão em `photoCaptureService.ts`.
- [x] **Passo 3:** Desenvolver o componente `PhotoPreviewModal.tsx` com botões de confirmar e descartar/refazer.
- [x] **Passo 4:** Criar o componente `EvidenceGallery.tsx` para exibição de miniaturas com opção de toque para expandir.
- [x] **Passo 5:** Integrar o botão de captura aos componentes de checklist e telas de não conformidade.
- [x] **Passo 6:** Escrever testes unitários para a geração de identificadores e persistência de metadados.

---

## 6. Critérios de Aceitação (Definition of Done)
- [x] **CA-01:** Foto capturada é comprimida e gravada na pasta de documentos do app com UUID único.
- [x] **CA-02:** Miniatura da foto aparece vinculada ao item de checklist correspondente.
- [x] **CA-03:** Fechar e reabrir o aplicativo preserva todas as fotografias capturadas offline.
- [x] **CA-04:** Registro correspondente é criado em `evidence_files` com estado pendente.
- [x] **CA-05:** Aprovação de Joacir Peçanha.

---

## 7. Registro de Execução & Decisões Técnicas
- **Dependências (`mobile/package.json`):**
  - Adicionados `expo-file-system` (`~57.0.7`) e `expo-image-manipulator` (`~57.0.21`) compatíveis com Expo SDK 57.
- **Passo 1 — `photoStorageService.ts` (`mobile/src/features/evidence/services/photoStorageService.ts`):**
  - Configurado armazenamento permanente em `FileSystem.documentDirectory + 'evidences/'` via `expo-file-system/legacy` com guarda explícita `assertNotCacheDirectory` bloqueando qualquer gravação em `cacheDirectory` (`RT-02`, `RN-047`, `CA-01`).
  - Implementada detecção e conversão de falhas de armazenamento (`InsufficientStorageError`, `MIN_FREE_STORAGE_BYTES = 5 MB`, `ENOSPC`, `QuotaExceededError`, `SQLITE_FULL`) sem fechar a aplicação (`EX-01`).
  - Adicionado suporte persistente multiplataforma em Web (`localStorage` sob chave `fieldops:web_evidence_files:v1`) e `resolveRenderableEvidenceUri` para preservar fotos offline após fechar e reabrir o aplicativo (`CA-03`, `RF-04`).
- **Passo 2 — `photoCaptureService.ts` (`mobile/src/features/evidence/services/photoCaptureService.ts`):**
  - Implementada solicitação de permissão prévia de câmera (`ensureCameraPermission`, `RF-01`, `RN-058`).
  - Implementado pipeline com `expo-image-manipulator` (`processAndCompressPhoto`) redimensionando proporcionalmente para no máximo `1920x1080` px em JPEG qualidade `0.8` (`RT-01`) e gerando miniatura leve (`320x240`, JPEG `0.6`) (`RT-03`).
  - Implementada sanitização estrita de metadados sensíveis (`sanitizePhotoMetadata`, removendo EXIF, GPS, hardware e nome original) (`RT-04`, `RN-051`) e geração de UUID v4 exclusivo por fotografia (`RF-06`, `RN-050`).
  - Implementadas `ensureEvidenceFilesTable`, `captureAndSaveEvidence`, `listInspectionEvidences` e `deleteEvidencePhoto`: gravação atômica em `evidence_files` e `inspection_evidences` com `status = 'PENDING'` + operação `UPLOAD_EVIDENCE` na Outbox (`RF-05`, `CA-04`), e bloqueio estrito contra exclusão em inspeções aprovadas/somente leitura ou fotos já enviadas (`EX-02`, `RN-049`).
- **Passos 3, 4 e 5 — Componentes, Rota de Captura e Integrações:**
  - Desenvolvido `PhotoPreviewModal.tsx` com pré-visualização imediata, identificação do item/não conformidade vinculada, confirmação e descarte/refazer (`RF-02`, `RF-03`).
  - Desenvolvido `EvidenceGallery.tsx` com carrossel de miniaturas, modal expandido com metadados UUID, selo somente leitura e exclusão local quando permitida (`CA-02`, `EX-02`).
  - Criada a rota dedicada `mobile/src/app/(protected)/evidence/capture.tsx` (registrada em `(protected)/_layout.tsx` e `router.d.ts`) com `CameraView`, controle de lanterna e simulador de captura/disco cheio para validação em Expo Web.
  - Integrado botão de captura e galeria em `ConformityInput.tsx` (bloco de Não Conformidade), `DynamicItemRenderer.tsx`, `inspections/[inspectionId]/index.tsx` e `inspections/[inspectionId]/summary.tsx`.
- **Passo 6 — Mocks, Testes Unitários & Verificações (`mobile/__tests__/features/evidence/photoCaptureService.test.ts`):**
  - Criados mocks `mobile/__tests__/mocks/expo-file-system.mjs` e `mobile/__tests__/mocks/expo-image-manipulator.mjs` registrados em `mobile/__tests__/ts-loader.mjs`.
  - `node mobile\node_modules\typescript\bin\tsc -p mobile\tsconfig.json --noEmit` -> Exit code `0` (`0` erros de tipagem).
  - `npm --prefix mobile test` -> Exit code `0` (`150/150` testes aprovados em `41` suítes, `0` falhas, incluindo 8 testes dedicados da TASK-016).
