import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createShortTextSchema,
  createLongTextSchema,
  createNumericSchema,
  createBooleanSchema,
  createConformitySchema,
  createSingleChoiceSchema,
  createDateSchema,
  createItemResponseSchema,
  normalizeConformity,
  ConformityState,
} from '../../src/features/checklist/schemas/checklistSchema';
import type { ChecklistItem } from '../../src/infrastructure/database/types';

describe('Checklist Schemas de Validação Zod (SPEC-003 / TASK-003)', () => {
  describe('TEXT_SHORT', () => {
    test('deve validar texto curto obrigatório com sucesso', () => {
      const schema = createShortTextSchema({ required: true });
      const result = schema.safeParse('Painel verificado');
      assert.equal(result.success, true);
      if (result.success) assert.equal(result.data, 'Painel verificado');
    });

    test('deve rejeitar texto vazio quando obrigatório', () => {
      const schema = createShortTextSchema({ required: true });
      const result = schema.safeParse('   ');
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /obrigatório/i);
      }
    });

    test('deve respeitar tamanho máximo configurado', () => {
      const schema = createShortTextSchema({ required: false, maxLength: 10 });
      assert.equal(schema.safeParse('1234567890').success, true);
      assert.equal(schema.safeParse('12345678901').success, false);
    });
  });

  describe('TEXT_LONG', () => {
    test('deve aceitar texto longo com quebras de linha', () => {
      const schema = createLongTextSchema({ required: true });
      const text = 'Linha 1\nLinha 2\nObservações detalhadas de campo.';
      const result = schema.safeParse(text);
      assert.equal(result.success, true);
    });

    test('deve rejeitar texto vazio quando obrigatório', () => {
      const schema = createLongTextSchema({ required: true });
      assert.equal(schema.safeParse('').success, false);
    });

    test('deve aceitar vazio quando opcional', () => {
      const schema = createLongTextSchema({ required: false });
      assert.equal(schema.safeParse('').success, true);
      assert.equal(schema.safeParse(null).success, true);
    });
  });

  describe('NUMBER', () => {
    test('deve aceitar números e strings numéricas com vírgula ou ponto', () => {
      const schema = createNumericSchema({ required: true });
      const r1 = schema.safeParse(42);
      assert.equal(r1.success, true);
      if (r1.success) assert.equal(r1.data, 42);

      const r2 = schema.safeParse('12.5');
      assert.equal(r2.success, true);
      if (r2.success) assert.equal(r2.data, 12.5);

      const r3 = schema.safeParse('12,5');
      assert.equal(r3.success, true);
      if (r3.success) assert.equal(r3.data, 12.5);
    });

    test('deve rejeitar valores não numéricos', () => {
      const schema = createNumericSchema({ required: true });
      const result = schema.safeParse('abc');
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /número válido/i);
      }
    });

    test('deve validar limites mínimo e máximo (min / max)', () => {
      const schema = createNumericSchema({ required: true, min: 0, max: 100 });
      assert.equal(schema.safeParse(0).success, true);
      assert.equal(schema.safeParse(100).success, true);
      assert.equal(schema.safeParse(-1).success, false);
      assert.equal(schema.safeParse(101).success, false);
    });
  });

  describe('BOOLEAN', () => {
    test('deve aceitar valores booleanos e aliases comuns', () => {
      const schema = createBooleanSchema({ required: true });
      const rTrue = schema.safeParse(true);
      assert.equal(rTrue.success, true);
      if (rTrue.success) assert.equal(rTrue.data, true);

      const rFalse = schema.safeParse(false);
      assert.equal(rFalse.success, true);
      if (rFalse.success) assert.equal(rFalse.data, false);

      const rSim = schema.safeParse('sim');
      assert.equal(rSim.success, true);
      if (rSim.success) assert.equal(rSim.data, true);

      const rNao = schema.safeParse('não');
      assert.equal(rNao.success, true);
      if (rNao.success) assert.equal(rNao.data, false);
    });

    test('deve rejeitar quando obrigatório e não informado', () => {
      const schema = createBooleanSchema({ required: true });
      assert.equal(schema.safeParse(null).success, false);
      assert.equal(schema.safeParse('').success, false);
    });
  });

  describe('CONFORMITY (RF-02 / RN-038)', () => {
    test('deve aceitar CONFORMING sem descrição de não conformidade', () => {
      const schema = createConformitySchema({ required: true });
      const result = schema.safeParse({
        conformity: ConformityState.CONFORMING,
      });
      assert.equal(result.success, true);
    });

    test('deve aceitar NOT_APPLICABLE sem descrição de não conformidade', () => {
      const schema = createConformitySchema({ required: true });
      const result = schema.safeParse({
        conformity: ConformityState.NOT_APPLICABLE,
      });
      assert.equal(result.success, true);
    });

    test('RF-02: deve EXIGIR descrição quando NON_CONFORMING for selecionado', () => {
      const schema = createConformitySchema({ required: true });

      // Sem descrição -> DEVE FALHAR
      const failure1 = schema.safeParse({
        conformity: ConformityState.NON_CONFORMING,
      });
      assert.equal(failure1.success, false);
      if (!failure1.success) {
        assert.match(failure1.error.issues[0].message, /descrição da não conformidade é obrigatória/i);
      }

      // Descrição vazia ou espaços -> DEVE FALHAR
      const failure2 = schema.safeParse({
        conformity: ConformityState.NON_CONFORMING,
        nonConformityDescription: '   ',
      });
      assert.equal(failure2.success, false);

      // Descrição válida com detalhes -> DEVE PASSAR
      const success = schema.safeParse({
        conformity: ConformityState.NON_CONFORMING,
        nonConformityDescription: 'Vazamento de óleo identificado no retentor.',
      });
      assert.equal(success.success, true);
    });

    test('RF-02: deve aceitar alias NAO_CONFORME com descrição obrigatória', () => {
      const schema = createConformitySchema({ required: true });
      assert.equal(
        schema.safeParse({ conformity: 'NAO_CONFORME', nonConformityDescription: '' }).success,
        false
      );
      assert.equal(
        schema.safeParse({
          conformity: 'NAO_CONFORME',
          nonConformityDescription: 'Fio exposto com risco elétrico',
        }).success,
        true
      );
    });

    test('normalizeConformity deve mapear variações de strings para enum canônico', () => {
      assert.equal(normalizeConformity('Conforme'), ConformityState.CONFORMING);
      assert.equal(normalizeConformity('conforme'), ConformityState.CONFORMING);
      assert.equal(normalizeConformity('Não Conforme'), ConformityState.NON_CONFORMING);
      assert.equal(normalizeConformity('nao_conforme'), ConformityState.NON_CONFORMING);
      assert.equal(normalizeConformity('N/A'), ConformityState.NOT_APPLICABLE);
      assert.equal(normalizeConformity('não aplicável'), ConformityState.NOT_APPLICABLE);
      assert.equal(normalizeConformity(''), null);
    });
  });

  describe('SINGLE_CHOICE', () => {
    const options = ['Opção A', 'Opção B', 'Opção C'];

    test('deve aceitar uma das opções válidas', () => {
      const schema = createSingleChoiceSchema(options, { required: true });
      assert.equal(schema.safeParse('Opção A').success, true);
      assert.equal(schema.safeParse('Opção C').success, true);
    });

    test('deve rejeitar opção fora da lista permitida', () => {
      const schema = createSingleChoiceSchema(options, { required: true });
      const result = schema.safeParse('Opção Inexistente');
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /inválida/i);
      }
    });

    test('deve rejeitar valor vazio quando obrigatório', () => {
      const schema = createSingleChoiceSchema(options, { required: true });
      assert.equal(schema.safeParse('').success, false);
    });
  });

  describe('DATE (ISO 8601)', () => {
    test('deve aceitar data válida no formato YYYY-MM-DD', () => {
      const schema = createDateSchema({ required: true });
      assert.equal(schema.safeParse('2026-10-23').success, true);
    });

    test('deve rejeitar formato inválido ou data inexistente (ex: 2026-02-31)', () => {
      const schema = createDateSchema({ required: true });
      assert.equal(schema.safeParse('23/10/2026').success, false);
      assert.equal(schema.safeParse('2026-02-31').success, false);
      assert.equal(schema.safeParse('texto-invalido').success, false);
    });

    test('deve validar limites de minDate e maxDate', () => {
      const schema = createDateSchema({
        required: true,
        minDate: '2026-01-01',
        maxDate: '2026-12-31',
      });
      assert.equal(schema.safeParse('2026-06-15').success, true);
      assert.equal(schema.safeParse('2025-12-31').success, false);
      assert.equal(schema.safeParse('2027-01-01').success, false);
    });
  });

  describe('createItemResponseSchema (Fábrica Dinâmica)', () => {
    test('deve criar e validar dinamicamente schema para item TEXT_SHORT', () => {
      const item: ChecklistItem = {
        id: 'item-1',
        section_id: 'sec-1',
        inspection_id: 'insp-1',
        title: 'Número de patrimônio',
        response_type: 'TEXT_SHORT',
        required: 1,
        order_index: 1,
      };

      const schema = createItemResponseSchema(item);
      assert.equal(schema.safeParse({ value: 'PAT-9988' }).success, true);
      assert.equal(schema.safeParse({ value: '' }).success, false);
    });

    test('deve criar e validar dinamicamente schema para item SINGLE_CHOICE com options_json', () => {
      const item: ChecklistItem = {
        id: 'item-2',
        section_id: 'sec-1',
        inspection_id: 'insp-1',
        title: 'Estado de conservação',
        response_type: 'SINGLE_CHOICE',
        options_json: JSON.stringify(['Novo', 'Bom', 'Regular', 'Crítico']),
        required: 1,
        order_index: 2,
      };

      const schema = createItemResponseSchema(item);
      assert.equal(schema.safeParse({ value: 'Bom' }).success, true);
      assert.equal(schema.safeParse({ value: 'Destruído' }).success, false);
    });

    test('deve criar fallback seguro para response_type desconhecido (CA-02)', () => {
      const item = {
        id: 'item-unknown',
        section_id: 'sec-1',
        inspection_id: 'insp-1',
        title: 'Tipo futuro não suportado',
        response_type: 'SIGNATURE_BIOMETRIC' as any,
        required: 1,
        order_index: 99,
      };

      const schema = createItemResponseSchema(item);
      assert.equal(schema.safeParse({ value: 'qualquer' }).success, true);
    });
  });
});
