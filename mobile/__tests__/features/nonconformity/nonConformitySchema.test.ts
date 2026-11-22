import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRITICAL_DESCRIPTION_REQUIRED_MESSAGE,
  CRITICAL_PHOTO_REQUIRED_MESSAGE,
  MIN_DETAILED_DESCRIPTION_LENGTH,
  NON_CONFORMITY_SEVERITIES,
  isCriticalSeverity,
  isNonConformitySeverity,
  requiresCompulsoryEvidenceAndDescription,
} from '../../../src/features/nonconformity/domain/types';
import {
  nonConformitySchema,
  nonConformitySeveritySchema,
  normalizeNonConformityPayload,
  validateNonConformity,
} from '../../../src/features/nonconformity/schemas/nonConformitySchema';

describe('TASK-017 Passo 6: Schema Zod e Regras Condicionais de Não Conformidade', () => {
  describe('RF-01 / RF-02 / RF-03: Vínculos obrigatórios, título e criticidade válida', () => {
    test('deve aceitar todos os níveis de criticidade permitidos (BAIXA, MEDIA, ALTA, CRITICA)', () => {
      for (const sev of NON_CONFORMITY_SEVERITIES) {
        const parsed = nonConformitySeveritySchema.safeParse(sev);
        assert.equal(parsed.success, true);
        assert.equal(isNonConformitySeverity(sev), true);
      }
    });

    test('deve rejeitar criticidade fora do conjunto permitido (RN-054)', () => {
      const invalidValues = ['URGENTE', 'NORMAL', '', 'MODERADA', null, undefined];
      for (const invalid of invalidValues) {
        const result = validateNonConformity({
          inspection_id: 'insp-1',
          title: 'Falha elétrica',
          severity: invalid,
        });
        assert.equal(result.success, false);
        assert.ok(result.fieldErrors.severity);
      }
      assert.equal(isNonConformitySeverity('URGENTE'), false);
    });

    test('deve exigir vínculo obrigatório com uma inspeção específica (RF-01 / RN-052)', () => {
      const withoutInspection = validateNonConformity({
        inspection_id: '   ',
        title: 'Tampa solta',
        severity: 'BAIXA',
      });
      assert.equal(withoutInspection.success, false);
      assert.match(
        withoutInspection.fieldErrors.inspection_id,
        /inspeção específica/i
      );
    });

    test('deve aceitar tanto vinculada a item específico quanto à inspeção geral (RF-02 / RN-053)', () => {
      const linkedToItem = validateNonConformity({
        inspection_id: 'insp-1',
        item_id: 'item-10',
        item_title: 'Painel Frontal',
        title: 'Parafuso frouxo no painel',
        severity: 'BAIXA',
      });
      assert.equal(linkedToItem.success, true);
      assert.equal(linkedToItem.data?.item_id, 'item-10');

      const linkedToInspection = validateNonConformity({
        inspection_id: 'insp-1',
        item_id: null,
        title: 'Área ao redor com iluminação deficiente',
        severity: 'MEDIA',
      });
      assert.equal(linkedToInspection.success, true);
      assert.equal(linkedToInspection.data?.item_id, null);
    });

    test('deve validar comprimento mínimo (3) e máximo (160) do título', () => {
      const tooShort = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Oi',
        severity: 'BAIXA',
      });
      assert.equal(tooShort.success, false);
      assert.ok(tooShort.fieldErrors.title);

      const tooLong = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'A'.repeat(161),
        severity: 'BAIXA',
      });
      assert.equal(tooLong.success, false);
      assert.ok(tooLong.fieldErrors.title);
    });
  });

  describe('RF-04 / RT-01 / EX-01: Regras condicionais para BAIXA e MEDIA vs ALTA e CRITICA', () => {
    test('deve permitir criticidade BAIXA e MEDIA sem descrição e sem evidência fotográfica', () => {
      const baixa = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Pequeno risco superficial na pintura',
        description: '',
        severity: 'BAIXA',
        evidence_uris: [],
      });
      assert.equal(baixa.success, true);

      const media = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Etiqueta de advertência desbotada',
        description: null,
        severity: 'MEDIA',
      });
      assert.equal(media.success, true);
    });

    test('EX-01 / CA-02: deve bloquear CRITICA sem foto com mensagem exata e sem descrição detalhada', () => {
      const result = nonConformitySchema.safeParse({
        inspection_id: 'insp-1',
        title: 'Vazamento grave de óleo hidráulico',
        description: 'Curta',
        severity: 'CRITICA',
        evidence_uris: [],
        evidence_ids: [],
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        assert.ok(messages.includes(CRITICAL_DESCRIPTION_REQUIRED_MESSAGE));
        assert.ok(messages.includes(CRITICAL_PHOTO_REQUIRED_MESSAGE));
      }

      const validated = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Vazamento grave de óleo hidráulico',
        description: 'Vazamento contínuo detectado na mangueira principal sob pressão.',
        severity: 'CRITICA',
        evidence_uris: [],
      });
      assert.equal(validated.success, false);
      assert.equal(
        validated.fieldErrors.evidence_uris,
        'Itens críticos exigem ao menos uma fotografia como evidência'
      );
    });

    test('RF-04: deve exigir descrição >= 10 caracteres e ao menos 1 foto também para criticidade ALTA', () => {
      const missingPhoto = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Superaquecimento no mancal',
        description: 'Temperatura medida acima de 95 graus durante operação contínua.',
        severity: 'ALTA',
        evidence_uris: [],
      });
      assert.equal(missingPhoto.success, false);
      assert.equal(missingPhoto.fieldErrors.evidence_uris, CRITICAL_PHOTO_REQUIRED_MESSAGE);

      const shortDescription = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Superaquecimento no mancal',
        description: '   curta   ',
        severity: 'ALTA',
        evidence_uris: ['file:///documents/evidences/foto-1.jpg'],
      });
      assert.equal(shortDescription.success, false);
      assert.equal(
        shortDescription.fieldErrors.description,
        CRITICAL_DESCRIPTION_REQUIRED_MESSAGE
      );
      assert.equal(MIN_DETAILED_DESCRIPTION_LENGTH, 10);
    });

    test('deve ignorar strings vazias/espaços em evidence_uris ao contar fotos obrigatórias', () => {
      const blankPhotos = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Cabo energizado exposto',
        description: 'Isolamento rompido próximo ao barramento principal de entrada.',
        severity: 'CRITICA',
        evidence_uris: ['   ', ''],
        evidence_ids: ['   '],
      });

      assert.equal(blankPhotos.success, false);
      assert.equal(
        blankPhotos.fieldErrors.evidence_uris,
        CRITICAL_PHOTO_REQUIRED_MESSAGE
      );
    });

    test('deve aprovar ALTA e CRITICA quando possuir descrição detalhada e ao menos 1 evidência (URI ou ID)', () => {
      const withUri = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Cabo energizado exposto',
        description: 'Isolamento rompido próximo ao barramento principal de entrada.',
        severity: 'CRITICA',
        evidence_uris: ['file:///documents/evidences/ev-123.jpg'],
      });
      assert.equal(withUri.success, true);

      const withEvidenceIdOnly = validateNonConformity({
        inspection_id: 'insp-1',
        title: 'Falha no freio de emergência',
        description: 'Acionamento apresenta atraso superior ao limite de segurança.',
        severity: 'ALTA',
        evidence_ids: ['uuid-ev-001'],
      });
      assert.equal(withEvidenceIdOnly.success, true);
    });
  });

  describe('Normalização de Payload & Helpers de Domínio', () => {
    test('normalizeNonConformityPayload deve converter aliases camelCase e normalizar severity', () => {
      const normalized = normalizeNonConformityPayload({
        inspectionId: 'insp-99',
        itemId: '',
        itemTitle: 'Sensor de Pressão',
        title: 'Vazamento na junta',
        description: 'Gotejamento constante observado após pressurização da linha.',
        severity: ' critica ',
        photos: ['file:///documents/evidences/a.jpg', '  '],
        evidenceIds: ['ev-a'],
      });

      assert.equal(normalized.inspection_id, 'insp-99');
      assert.equal(normalized.item_id, null);
      assert.equal(normalized.severity, 'CRITICA');
      assert.deepEqual(normalized.evidence_uris, ['file:///documents/evidences/a.jpg']);
      assert.deepEqual(normalized.evidence_ids, ['ev-a']);

      const validated = validateNonConformity({
        inspectionId: 'insp-99',
        title: 'Vazamento na junta',
        description: 'Gotejamento constante observado após pressurização da linha.',
        severity: 'critica',
        photos: ['file:///documents/evidences/a.jpg'],
      });
      assert.equal(validated.success, true);
      assert.equal(validated.data?.severity, 'CRITICA');
    });

    test('helpers de criticidade devem identificar corretamente níveis compulsórios', () => {
      assert.equal(requiresCompulsoryEvidenceAndDescription('CRITICA'), true);
      assert.equal(requiresCompulsoryEvidenceAndDescription('alta'), true);
      assert.equal(requiresCompulsoryEvidenceAndDescription('MEDIA'), false);
      assert.equal(requiresCompulsoryEvidenceAndDescription('BAIXA'), false);
      assert.equal(requiresCompulsoryEvidenceAndDescription(null), false);

      assert.equal(isCriticalSeverity('CRITICA'), true);
      assert.equal(isCriticalSeverity('critica'), true);
      assert.equal(isCriticalSeverity('ALTA'), false);
    });
  });
});
