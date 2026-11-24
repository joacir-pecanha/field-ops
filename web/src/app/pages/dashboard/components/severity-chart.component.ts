import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  NonConformitySeverity,
  getNonConformitySeverityLabel,
  getNonConformitySeverityTone,
} from '../../inspections/inspection.service';
import { NonConformitySeverityCounts } from '../dashboard.service';

interface SeverityRowMeta {
  severity: NonConformitySeverity;
  label: string;
  tone: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  percentage: number;
}

const ORDERED_SEVERITIES: readonly NonConformitySeverity[] = ['CRITICA', 'ALTA', 'MEDIA', 'BAIXA'];

/**
 * Indicador visual de distribuição de Não Conformidades por severidade (TASK-021 RF-02 / CA-03).
 */
@Component({
  selector: 'app-severity-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="panel-card" data-testid="severity-chart">
      <header class="panel-header">
        <div>
          <h2>Não Conformidades por Severidade</h2>
          <p>Distribuição de ocorrências ativas classificadas por criticidade</p>
        </div>
        <span class="total-pill" data-testid="severity-total-count">
          {{ totalCount() }} {{ totalCount() === 1 ? 'ocorrência' : 'ocorrências' }}
        </span>
      </header>

      @if (loading) {
        <div
          class="skeleton-list"
          style="padding: 0"
          data-testid="severity-chart-skeleton"
          aria-busy="true"
        >
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      } @else {
        @if (totalCount() === 0) {
          <div class="encouraging-box" data-testid="severity-empty-message">
            <strong>Nenhuma não conformidade registrada no momento!</strong>
            <span>Todos os itens avaliados estão dentro dos parâmetros operacionais.</span>
          </div>
        } @else {
          <div class="stacked-bar" aria-label="Proporção geral de severidades">
            @for (row of rows(); track row.severity) {
              @if (row.count > 0) {
                <div
                  class="stacked-segment"
                  [ngClass]="'seg-' + row.tone"
                  [style.width.%]="row.percentage"
                  [title]="row.label + ': ' + row.count + ' (' + row.percentage + '%)'"
                ></div>
              }
            }
          </div>
        }

        <div class="severity-rows">
          @for (row of rows(); track row.severity) {
            <button
              type="button"
              class="severity-row"
              (click)="severitySelected.emit(row.severity)"
              [attr.data-testid]="'severity-row-' + row.severity"
            >
              <div class="severity-meta">
                <span class="sev-badge" [ngClass]="'sev-' + row.tone">{{ row.label }}</span>
                <div class="severity-numbers">
                  <strong [attr.data-testid]="'severity-count-' + row.severity">
                    {{ row.count }}
                  </strong>
                  <span>{{ row.percentage }}%</span>
                </div>
              </div>
              <div class="bar-track" aria-hidden="true">
                <div
                  class="bar-fill"
                  [ngClass]="'seg-' + row.tone"
                  [style.width.%]="row.percentage"
                ></div>
              </div>
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .panel-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.95rem;
        padding: 1.15rem 1.2rem;
        display: grid;
        gap: 0.95rem;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
      }

      .panel-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;

        h2 {
          margin: 0 0 0.2rem;
          font-size: 1.05rem;
          color: #0f172a;
        }

        p {
          margin: 0;
          font-size: 0.82rem;
          color: #64748b;
        }
      }

      .total-pill {
        padding: 0.24rem 0.65rem;
        border-radius: 999px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        font-size: 0.76rem;
        font-weight: 700;
        color: #1e293b;
        white-space: nowrap;
      }

      .encouraging-box {
        padding: 0.85rem 0.95rem;
        border-radius: 0.7rem;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;
        display: grid;
        gap: 0.18rem;
        font-size: 0.84rem;
      }

      .stacked-bar {
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: #f1f5f9;
        display: flex;
      }

      .stacked-segment,
      .bar-fill {
        height: 100%;
        transition: width 0.25s ease;
      }

      .seg-critical {
        background: linear-gradient(90deg, #dc2626, #ef4444);
      }
      .seg-high {
        background: linear-gradient(90deg, #ea580c, #f97316);
      }
      .seg-medium {
        background: linear-gradient(90deg, #d97706, #eab308);
      }
      .seg-low {
        background: linear-gradient(90deg, #64748b, #94a3b8);
      }

      .severity-rows {
        display: grid;
        gap: 0.65rem;
      }

      .severity-row {
        width: 100%;
        text-align: left;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.7rem;
        padding: 0.65rem 0.8rem;
        display: grid;
        gap: 0.45rem;
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;

        &:hover {
          background: #ffffff;
          border-color: #94a3b8;
        }
      }

      .severity-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .severity-numbers {
        display: inline-flex;
        align-items: baseline;
        gap: 0.4rem;
        font-variant-numeric: tabular-nums;

        strong {
          font-size: 0.98rem;
          color: #0f172a;
        }

        span {
          font-size: 0.76rem;
          font-weight: 600;
          color: #64748b;
        }
      }

      .bar-track {
        height: 7px;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
      }
    `,
  ],
})
export class SeverityChartComponent {
  @Input() counts: NonConformitySeverityCounts = {
    BAIXA: 0,
    MEDIA: 0,
    ALTA: 0,
    CRITICA: 0,
  };
  @Input() loading = false;

  @Output() severitySelected = new EventEmitter<NonConformitySeverity>();

  totalCount(): number {
    return (
      (this.counts?.CRITICA ?? 0) +
      (this.counts?.ALTA ?? 0) +
      (this.counts?.MEDIA ?? 0) +
      (this.counts?.BAIXA ?? 0)
    );
  }

  rows(): SeverityRowMeta[] {
    const total = this.totalCount();
    return ORDERED_SEVERITIES.map((severity) => {
      const count = Math.max(0, Number(this.counts?.[severity] ?? 0));
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        severity,
        label: getNonConformitySeverityLabel(severity),
        tone: getNonConformitySeverityTone(severity),
        count,
        percentage,
      };
    });
  }
}
