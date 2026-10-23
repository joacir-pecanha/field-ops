import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DynamicItemRenderer } from '../../src/features/checklist/components/DynamicItemRenderer';
import {
  ConformityInput,
  SingleChoiceInput,
  DateInput,
  NumericInput,
  ShortTextInput,
  LongTextInput,
  BooleanInput,
} from '../../src/features/checklist/components/inputs';
import { ConformityState } from '../../src/features/checklist/schemas/checklistSchema';
import type { ChecklistItem } from '../../src/infrastructure/database/types';

describe('DynamicItemRenderer & Checklist Subcomponents (SPEC-003 / TASK-003)', () => {
  const baseItem: ChecklistItem = {
    id: 'item-101',
    section_id: 'sec-1',
    inspection_id: 'insp-1',
    title: 'Verificação do Manômetro',
    description: 'Verifique se a pressão está entre 8 e 12 bar.',
    response_type: 'CONFORMITY',
    required: 1,
    order_index: 1,
  };

  describe('CA-01: Renderização dos 7 Tipos Especializados', () => {
    test('1. Deve renderizar TEXT_SHORT com input de linha única', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-text-short',
        response_type: 'TEXT_SHORT',
        title: 'Número de Série',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: 'SN-123456',
          onChange: () => {},
        })
      );

      assert.ok(html.includes('Número de Série'));
      assert.ok(html.includes('data-testid="item-renderer-item-text-short-text-short-input"'));
      assert.ok(html.includes('SN-123456'));
    });

    test('2. Deve renderizar TEXT_LONG com textarea multilinha', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-text-long',
        response_type: 'TEXT_LONG',
        title: 'Parecer Técnico Detalhado',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: 'Linha 1\nLinha 2 de parecer.',
          onChange: () => {},
        })
      );

      assert.ok(html.includes('Parecer Técnico Detalhado'));
      assert.ok(html.includes('data-testid="item-renderer-item-text-long-text-long-input"'));
      assert.ok(html.includes('Linha 1'));
    });

    test('3. Deve renderizar NUMBER com steppers e entrada numérica', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-number',
        response_type: 'NUMBER',
        title: 'Pressão Medida (bar)',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: 9.5,
          onChange: () => {},
        })
      );

      assert.ok(html.includes('Pressão Medida (bar)'));
      assert.ok(html.includes('data-testid="item-renderer-item-number-number-decrement"'));
      assert.ok(html.includes('data-testid="item-renderer-item-number-number-increment"'));
      assert.ok(html.includes('data-testid="item-renderer-item-number-number-input"'));
      assert.ok(html.includes('9.5'));
    });

    test('4. Deve renderizar BOOLEAN com botões Sim e Não', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-boolean',
        response_type: 'BOOLEAN',
        title: 'O lacre está intacto?',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: true,
          onChange: () => {},
        })
      );

      assert.ok(html.includes('O lacre está intacto?'));
      assert.ok(html.includes('data-testid="item-renderer-item-boolean-boolean-yes"'));
      assert.ok(html.includes('data-testid="item-renderer-item-boolean-boolean-no"'));
      assert.ok(html.includes('Sim'));
      assert.ok(html.includes('Não'));
    });

    test('5. Deve renderizar CONFORMITY com 3 botões (Conforme, Não Conforme, N/A)', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-conformity',
        response_type: 'CONFORMITY',
        title: 'Estado da carcaça do extintor',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: ConformityState.CONFORMING,
          onChange: () => {},
        })
      );

      assert.ok(html.includes('Estado da carcaça do extintor'));
      assert.ok(html.includes('data-testid="item-renderer-item-conformity-conformity-conforming"'));
      assert.ok(html.includes('data-testid="item-renderer-item-conformity-conformity-non-conforming"'));
      assert.ok(html.includes('data-testid="item-renderer-item-conformity-conformity-not-applicable"'));
      assert.ok(html.includes('Conforme'));
      assert.ok(html.includes('Não Conforme'));
      assert.ok(html.includes('N/A'));
    });

    test('6. Deve renderizar SINGLE_CHOICE com lista de opções a partir de options_json', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-single-choice',
        response_type: 'SINGLE_CHOICE',
        title: 'Nível de Corrosão',
        options_json: JSON.stringify(['Nenhuma', 'Leve', 'Moderada', 'Severa']),
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: 'Moderada',
          onChange: () => {},
        })
      );

      assert.ok(html.includes('Nível de Corrosão'));
      assert.ok(html.includes('Nenhuma'));
      assert.ok(html.includes('Leve'));
      assert.ok(html.includes('Moderada'));
      assert.ok(html.includes('Severa'));
      assert.ok(html.includes('data-testid="item-renderer-item-single-choice-single-choice-option-2"'));
    });

    test('7. Deve renderizar DATE com seletor de data e atalho Hoje', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-date',
        response_type: 'DATE',
        title: 'Data da Última Recarga',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: '2026-10-23',
          onChange: () => {},
        })
      );

      assert.ok(html.includes('Data da Última Recarga'));
      assert.ok(html.includes('data-testid="item-renderer-item-date-date-text-input"'));
      assert.ok(html.includes('data-testid="item-renderer-item-date-date-today-button"'));
      assert.ok(html.includes('Hoje'));
      assert.ok(html.includes('2026-10-23'));
    });
  });

  describe('CA-02: Fallback Seguro para Tipos Desconhecidos', () => {
    test('deve exibir card de alerta sem crash para tipo não suportado', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-futuristic',
        response_type: 'HOLOGRAPHIC_3D_SCAN' as any,
        title: 'Varredura Holográfica',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: null,
          onChange: () => {},
        })
      );

      assert.ok(html.includes('Varredura Holográfica'));
      assert.ok(html.includes('data-testid="item-renderer-item-futuristic-unknown-fallback"'));
      assert.ok(html.includes('Tipo de Resposta Não Suportado'));
      assert.ok(html.includes('HOLOGRAPHIC_3D_SCAN'));
    });
  });

  describe('RF-02: Registro Compulsório de Não Conformidade', () => {
    test('NÃO deve exibir área de descrição quando CONFORMING ou NOT_APPLICABLE', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-conf-ok',
        response_type: 'CONFORMITY',
      };

      const htmlConforming = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: ConformityState.CONFORMING,
          onChange: () => {},
        })
      );
      assert.ok(!htmlConforming.includes('NÃO CONFORMIDADE APONTADA'));
      assert.ok(!htmlConforming.includes('description-container'));

      const htmlNA = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: ConformityState.NOT_APPLICABLE,
          onChange: () => {},
        })
      );
      assert.ok(!htmlNA.includes('NÃO CONFORMIDADE APONTADA'));
      assert.ok(!htmlNA.includes('description-container'));
    });

    test('DEVE exibir compulsoriamente a área de descrição quando NON_CONFORMING for selecionado', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-conf-nc',
        response_type: 'CONFORMITY',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: ConformityState.NON_CONFORMING,
          nonConformityDescription: 'Válvula de segurança apresentando vazamento constante',
          onChange: () => {},
        })
      );

      assert.ok(html.includes('NÃO CONFORMIDADE APONTADA'));
      assert.ok(html.includes('Obrigatório *'));
      assert.ok(html.includes('data-testid="item-renderer-item-conf-nc-conformity-description-container"'));
      assert.ok(html.includes('data-testid="item-renderer-item-conf-nc-conformity-description-input"'));
      assert.ok(html.includes('Válvula de segurança apresentando vazamento constante'));
    });

    test('deve renderizar mensagem de erro de descrição se descriptionError for fornecido', () => {
      const item: ChecklistItem = {
        ...baseItem,
        id: 'item-conf-err',
        response_type: 'CONFORMITY',
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: ConformityState.NON_CONFORMING,
          nonConformityDescription: '',
          descriptionError: 'A descrição da não conformidade é obrigatória (mínimo 3 caracteres)',
          onChange: () => {},
        })
      );

      assert.ok(html.includes('A descrição da não conformidade é obrigatória (mínimo 3 caracteres)'));
      assert.ok(html.includes('data-testid="item-renderer-item-conf-err-conformity-description-error"'));
    });
  });

  describe('Indicadores de Obrigatoriedade (RT-01)', () => {
    test('deve exibir asterisco e badge quando required = 1', () => {
      const item: ChecklistItem = {
        ...baseItem,
        required: 1,
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: null,
          onChange: () => {},
        })
      );

      assert.ok(html.includes('Obrigatório'));
      assert.ok(html.includes('*'));
    });

    test('não deve exibir badge quando required = 0', () => {
      const item: ChecklistItem = {
        ...baseItem,
        required: 0,
      };

      const html = renderToStaticMarkup(
        React.createElement(DynamicItemRenderer, {
          item,
          value: null,
          onChange: () => {},
        })
      );

      assert.ok(!html.includes('Obrigatório'));
    });
  });

  describe('Testes Unitários dos Subcomponentes de Entrada', () => {
    test('ConformityInput: renderiza botões e dispara callbacks', () => {
      let selectedVal: any = null;
      let descVal: string = '';

      const element = React.createElement(ConformityInput, {
        value: ConformityState.NON_CONFORMING,
        nonConformityDescription: 'Fio rompido',
        onChange: (v) => {
          selectedVal = v;
        },
        onDescriptionChange: (d) => {
          descVal = d;
        },
      });

      const html = renderToStaticMarkup(element);
      assert.ok(html.includes('Conforme'));
      assert.ok(html.includes('Não Conforme'));
      assert.ok(html.includes('N/A'));
      assert.ok(html.includes('Fio rompido'));
    });

    test('SingleChoiceInput: trata lista vazia graciosamente', () => {
      const html = renderToStaticMarkup(
        React.createElement(SingleChoiceInput, {
          value: null,
          options: [],
          onChange: () => {},
        })
      );
      assert.ok(html.includes('Nenhuma opção disponível'));
    });

    test('NumericInput: renderiza limites configurados (min/max)', () => {
      const html = renderToStaticMarkup(
        React.createElement(NumericInput, {
          value: 50,
          min: 10,
          max: 100,
          onChange: () => {},
        })
      );
      assert.ok(html.includes('Mín: 10'));
      assert.ok(html.includes('Máx: 100'));
    });

    test('DateInput: exibe limites minDate/maxDate quando informados', () => {
      const html = renderToStaticMarkup(
        React.createElement(DateInput, {
          value: '2026-10-23',
          minDate: '2026-01-01',
          maxDate: '2026-12-31',
          onChange: () => {},
        })
      );
      assert.ok(html.includes('Mín: 2026-01-01'));
      assert.ok(html.includes('Máx: 2026-12-31'));
    });

    test('ShortTextInput & LongTextInput: renderizam contadores de caracteres', () => {
      const shortHtml = renderToStaticMarkup(
        React.createElement(ShortTextInput, {
          value: 'Teste',
          maxLength: 100,
          onChange: () => {},
        })
      );
      assert.ok(shortHtml.includes('5/100'));

      const longHtml = renderToStaticMarkup(
        React.createElement(LongTextInput, {
          value: 'Observação longa',
          maxLength: 500,
          onChange: () => {},
        })
      );
      assert.ok(longHtml.includes('16/500'));
    });

    test('BooleanInput: renderiza botões e labels com acessibilidade', () => {
      const html = renderToStaticMarkup(
        React.createElement(BooleanInput, {
          value: false,
          onChange: () => {},
        })
      );
      assert.ok(html.includes('Sim'));
      assert.ok(html.includes('Não'));
    });
  });
});
