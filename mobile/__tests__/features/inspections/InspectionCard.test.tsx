import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  InspectionCard,
  PriorityBadge,
  SyncStatusBadge,
} from '../../../src/features/inspections/components/InspectionCard';
import type { Inspection } from '../../../src/infrastructure/database/types';

const REFERENCE_DATE = new Date('2026-11-14T12:00:00.000Z');

const baseInspection: Inspection = {
  id: 'insp-card-1',
  remote_id: 'remote-1',
  template_id: 'tmpl-1',
  template_version: 1,
  client_name: 'Energia Sul S.A.',
  site_name: 'Subestação Central',
  site_address: 'Av. Industrial, 500 - Porto Alegre/RS',
  equipment_name: 'Transformador TR-01',
  equipment_code: 'EQ-TR01',
  equipment_qr_code: 'QR-TR01',
  status: 'ATRIBUÍDA',
  priority: 'ALTA',
  due_date: '2026-11-16T10:00:00.000Z',
  sync_status: 'SINCRONIZADO',
};

describe('InspectionCard & Badges (TASK-013 Passo 3)', () => {
  test('RF-02: Deve exibir cliente, local, endereço, equipamento, código, prioridade, status e data prevista', () => {
    const html = renderToStaticMarkup(
      React.createElement(InspectionCard, {
        inspection: baseInspection,
        referenceDate: REFERENCE_DATE,
      })
    );

    assert.ok(html.includes('Energia Sul S.A.'));
    assert.ok(html.includes('Subestação Central'));
    assert.ok(html.includes('Av. Industrial, 500 - Porto Alegre/RS'));
    assert.ok(html.includes('Transformador TR-01 (EQ-TR01)'));
    assert.ok(html.includes('Alta'));
    assert.ok(html.includes('Atribuída'));
    assert.ok(html.includes('Prevista: 16/11/2026'));
    assert.ok(!html.includes('EM ATRASO'));
    assert.ok(!html.includes('EM EXECUÇÃO'));
  });

  test('RF-03: Deve destacar visualmente inspeção atrasada com badge EM ATRASO', () => {
    const overdueInspection: Inspection = {
      ...baseInspection,
      id: 'insp-overdue',
      status: 'ATRIBUÍDA',
      due_date: '2026-11-10T10:00:00.000Z',
    };

    const html = renderToStaticMarkup(
      React.createElement(InspectionCard, {
        inspection: overdueInspection,
        referenceDate: REFERENCE_DATE,
      })
    );

    assert.ok(html.includes('data-testid="inspection-card-insp-overdue-overdue-badge"'));
    assert.ok(html.includes('EM ATRASO'));
    assert.ok(html.includes('Atrasada • Prazo: 10/11/2026'));
  });

  test('RF-03: NÃO deve marcar como atrasada uma inspeção já concluída (ENVIADA / APROVADA)', () => {
    const completedPastDue: Inspection = {
      ...baseInspection,
      id: 'insp-done',
      status: 'ENVIADA',
      due_date: '2026-11-01T10:00:00.000Z',
    };

    const html = renderToStaticMarkup(
      React.createElement(InspectionCard, {
        inspection: completedPastDue,
        referenceDate: REFERENCE_DATE,
      })
    );

    assert.ok(!html.includes('EM ATRASO'));
    assert.ok(html.includes('Enviada'));
  });

  test('RF-03: Deve diferenciar visualmente inspeção EM_ANDAMENTO com indicador EM EXECUÇÃO', () => {
    const inProgressInspection: Inspection = {
      ...baseInspection,
      id: 'insp-progress',
      status: 'EM_ANDAMENTO',
    };

    const html = renderToStaticMarkup(
      React.createElement(InspectionCard, {
        inspection: inProgressInspection,
        referenceDate: REFERENCE_DATE,
      })
    );

    assert.ok(
      html.includes('data-testid="inspection-card-insp-progress-in-progress-indicator"')
    );
    assert.ok(html.includes('EM EXECUÇÃO'));
    assert.ok(html.includes('Em Andamento'));
  });

  test('RF-03: Deve exibir indicador de Pendente de envio e estados de erro/conflito na sincronização', () => {
    const pendingSyncInspection: Inspection = {
      ...baseInspection,
      id: 'insp-sync-pend',
      remote_id: null,
      status: 'EM_ANDAMENTO',
      sync_status: 'PENDENTE',
    };

    const pendingHtml = renderToStaticMarkup(
      React.createElement(InspectionCard, {
        inspection: pendingSyncInspection,
        referenceDate: REFERENCE_DATE,
      })
    );

    assert.ok(pendingHtml.includes('data-testid="inspection-card-insp-sync-pend-sync-badge"'));
    assert.ok(pendingHtml.includes('Pendente de envio'));
    assert.ok(pendingHtml.includes('LOCAL'));

    const errorHtml = renderToStaticMarkup(
      React.createElement(SyncStatusBadge, {
        syncStatus: 'ERRO',
        testID: 'sync-error-badge',
      })
    );
    assert.ok(errorHtml.includes('Falha no envio'));

    const conflictHtml = renderToStaticMarkup(
      React.createElement(SyncStatusBadge, {
        syncStatus: 'CONFLITO',
        testID: 'sync-conflict-badge',
      })
    );
    assert.ok(conflictHtml.includes('Conflito de envio'));
  });

  test('PriorityBadge deve renderizar todos os níveis de prioridade corretamente', () => {
    const baixa = renderToStaticMarkup(
      React.createElement(PriorityBadge, { priority: 'BAIXA' })
    );
    const media = renderToStaticMarkup(
      React.createElement(PriorityBadge, { priority: 'MEDIA' })
    );
    const alta = renderToStaticMarkup(
      React.createElement(PriorityBadge, { priority: 'ALTA' })
    );
    const critica = renderToStaticMarkup(
      React.createElement(PriorityBadge, { priority: 'CRITICA' })
    );
    const urgente = renderToStaticMarkup(
      React.createElement(PriorityBadge, { priority: 'URGENTE' })
    );

    assert.ok(baixa.includes('Baixa'));
    assert.ok(media.includes('Média'));
    assert.ok(alta.includes('Alta'));
    assert.ok(critica.includes('Crítica'));
    assert.ok(urgente.includes('Urgente'));
  });
});
