import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusBadgeComponent } from '../../inspections/components/status-badge.component';
import {
  InspectionDetailsResponse,
  InspectionPriority,
  InspectionStatus,
  getInspectionPriorityLabel,
} from '../../inspections/inspection.service';

/**
 * Tabela rápida de inspeções recentes com badges de status clicáveis e navegação direta para revisão (TASK-021 RF-04).
 */
@Component({
  selector: 'app-recent-inspections',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="table-card" data-testid="recent-inspections-panel">
      <header class="panel-header-bar">
        <div>
          <h2>Atividades Recentes</h2>
          <p>Clique em uma linha para abrir a revisão/detalhes ou no status para filtrar a lista</p>
        </div>
        <a routerLink="/app/inspections" class="btn btn-secondary btn-sm">Ver todas</a>
      </header>

      @if (loading) {
        <div class="skeleton-list" data-testid="recent-inspections-skeleton" aria-busy="true">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      } @else if (inspections.length === 0) {
        <div class="empty-state" data-testid="recent-inspections-empty">
          <h3>Nenhuma inspeção registrada até o momento</h3>
          <p>
            Assim que novas inspeções forem agendadas ou sincronizadas, elas aparecerão aqui com
            acesso rápido para acompanhamento e revisão.
          </p>
          <a routerLink="/app/inspections/new" class="btn btn-primary btn-sm">
            + Agendar Nova Inspeção
          </a>
        </div>
      } @else {
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Inspeção / Modelo</th>
                <th>Cliente / Local</th>
                <th>Técnico</th>
                <th>Prioridade</th>
                <th>Previsão</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              @for (inspection of inspections; track inspection.id) {
                <tr
                  class="recent-row"
                  [class.row-overdue]="inspection.overdue"
                  tabindex="0"
                  data-testid="recent-inspection-row"
                  (click)="inspectionClick.emit(inspection)"
                  (keydown.enter)="inspectionClick.emit(inspection)"
                >
                  <td>
                    <div class="cell-primary">{{ inspection.title }}</div>
                    <div class="cell-secondary">
                      @if (inspection.templateCode) {
                        <span class="code-chip">{{ inspection.templateCode }}</span>
                      }
                      <span>
                        v{{ inspection.templateVersionNumber ?? inspection.templateVersion ?? 1 }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class="cell-primary">{{ inspection.clientName || '—' }}</div>
                    <div class="cell-secondary">
                      {{ inspection.siteName || '—' }}
                      @if (inspection.equipmentName) {
                        • {{ inspection.equipmentName }}
                      }
                    </div>
                  </td>
                  <td>
                    <div class="cell-primary">{{ inspection.technicianName || '—' }}</div>
                  </td>
                  <td>
                    <span class="priority-pill" [ngClass]="'prio-' + priorityTone(inspection.priority)">
                      {{ priorityLabel(inspection.priority) }}
                    </span>
                  </td>
                  <td>
                    <div class="cell-primary">
                      {{ inspection.scheduledFor | date: 'dd/MM/yyyy HH:mm' }}
                    </div>
                  </td>
                  <td>
                    <div class="status-cell">
                      <button
                        type="button"
                        class="status-trigger"
                        title="Filtrar inspeções por este status"
                        data-testid="recent-status-badge-trigger"
                        (click)="onStatusBadgeClick($event, inspection.status)"
                      >
                        <app-status-badge [status]="inspection.status" />
                      </button>

                      @if (inspection.overdue) {
                        <button
                          type="button"
                          class="overdue-trigger"
                          title="Ver todas as inspeções em atraso"
                          data-testid="recent-overdue-badge-trigger"
                          (click)="onOverdueBadgeClick($event)"
                        >
                          ⚠ Atrasada
                        </button>
                      }
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-sm"
                      [ngClass]="isReviewReady(inspection.status) ? 'btn-primary' : 'btn-secondary'"
                      data-testid="recent-inspection-action-btn"
                      (click)="onActionButtonClick($event, inspection)"
                    >
                      {{ isReviewReady(inspection.status) ? 'Revisar' : 'Detalhes' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .panel-header-bar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        padding: 1.05rem 1.2rem;
        border-bottom: 1px solid #e2e8f0;

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

      .recent-row {
        cursor: pointer;

        &:focus-visible {
          outline: 2px solid #0f766e;
          outline-offset: -2px;
        }
      }

      .row-overdue {
        background: #fffbeb;
      }

      .row-overdue td:first-child {
        box-shadow: inset 4px 0 0 #dc2626;
      }

      .status-cell {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .status-trigger,
      .overdue-trigger {
        border: none;
        background: transparent;
        padding: 0;
        cursor: pointer;
        border-radius: 999px;
        transition: transform 0.12s ease;

        &:hover {
          transform: translateY(-1px);
        }
      }

      .overdue-trigger {
        padding: 0.16rem 0.48rem;
        background: #fef2f2;
        border: 1px solid #fca5a5;
        color: #b91c1c;
        font-size: 0.71rem;
        font-weight: 800;
      }

      .priority-pill {
        display: inline-flex;
        padding: 0.15rem 0.5rem;
        border-radius: 0.4rem;
        font-size: 0.73rem;
        font-weight: 700;
        border: 1px solid transparent;
        white-space: nowrap;

        &.prio-low {
          background: #f8fafc;
          color: #475569;
          border-color: #cbd5e1;
        }
        &.prio-medium {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }
        &.prio-high {
          background: #fff7ed;
          color: #c2410c;
          border-color: #fed7aa;
        }
        &.prio-urgent {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fca5a5;
        }
      }
    `,
  ],
})
export class RecentInspectionsComponent {
  @Input() inspections: readonly InspectionDetailsResponse[] = [];
  @Input() loading = false;

  @Output() inspectionClick = new EventEmitter<InspectionDetailsResponse>();
  @Output() statusClick = new EventEmitter<InspectionStatus>();
  @Output() overdueClick = new EventEmitter<void>();

  isReviewReady(status: InspectionStatus): boolean {
    return status === 'ENVIADA' || status === 'EM_REVISÃO';
  }

  priorityLabel(priority: InspectionPriority): string {
    return getInspectionPriorityLabel(priority);
  }

  priorityTone(priority: InspectionPriority): 'low' | 'medium' | 'high' | 'urgent' {
    switch (priority) {
      case 'BAIXA':
        return 'low';
      case 'MEDIA':
        return 'medium';
      case 'ALTA':
        return 'high';
      default:
        return 'urgent';
    }
  }

  onStatusBadgeClick(event: Event, status: InspectionStatus): void {
    event.stopPropagation();
    this.statusClick.emit(status);
  }

  onOverdueBadgeClick(event: Event): void {
    event.stopPropagation();
    this.overdueClick.emit();
  }

  onActionButtonClick(event: Event, inspection: InspectionDetailsResponse): void {
    event.stopPropagation();
    this.inspectionClick.emit(inspection);
  }
}
