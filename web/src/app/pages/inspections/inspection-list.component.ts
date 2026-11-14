import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ClientsApiService } from '../../core/master/clients-api.service';
import {
  ClientResponse,
  PageResponse,
  UserResponse,
} from '../../core/master/master-data.models';
import { UsersApiService } from '../../core/master/users-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { sortIndicatorFor, toggleSortExpression } from '../../shared/utils/form-error.utils';
import { getResponseTypeLabel } from '../templates/template.service';
import { CancelModalComponent } from './components/cancel-modal.component';
import { StatusBadgeComponent } from './components/status-badge.component';
import {
  AuditLogResponse,
  INSPECTION_PRIORITY_OPTIONS,
  INSPECTION_STATUS_OPTIONS,
  InspectionApiError,
  InspectionDetailsResponse,
  InspectionPriority,
  InspectionService,
  InspectionStatus,
  canCancelInspection,
  getInspectionPriorityLabel,
} from './inspection.service';

@Component({
  selector: 'app-inspection-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PaginationComponent,
    StatusBadgeComponent,
    CancelModalComponent,
  ],
  templateUrl: './inspection-list.component.html',
  styles: [
    `
      .filters-grid-inspections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
        gap: 0.85rem;
        align-items: end;
      }

      .filter-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 38px;
        padding: 0.45rem 0.7rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.55rem;
        background: #f8fafc;
        font-size: 0.84rem;
        font-weight: 600;
        color: #1e293b;
        cursor: pointer;

        input[type='checkbox'] {
          width: 1rem;
          height: 1rem;
          accent-color: #b91c1c;
          cursor: pointer;
        }
      }

      .row-overdue {
        background: #fffbeb;
      }

      .row-overdue td:first-child {
        box-shadow: inset 4px 0 0 #dc2626;
      }

      .overdue-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        margin-top: 0.25rem;
        padding: 0.14rem 0.48rem;
        border-radius: 999px;
        background: #fef2f2;
        border: 1px solid #fca5a5;
        color: #b91c1c;
        font-size: 0.71rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .priority-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.16rem 0.52rem;
        border-radius: 0.42rem;
        font-size: 0.74rem;
        font-weight: 700;
        white-space: nowrap;
        border: 1px solid transparent;

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

      .modal-card-wide {
        max-width: 820px;
      }

      .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.75rem;
        padding: 0.85rem;
        border-radius: 0.65rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }

      .details-item {
        display: grid;
        gap: 0.12rem;

        span {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }

        strong {
          font-size: 0.87rem;
          color: #0f172a;
        }
      }

      .snapshot-list {
        display: grid;
        gap: 0.5rem;
        max-height: 260px;
        overflow-y: auto;
      }

      .snapshot-item {
        padding: 0.6rem 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.55rem;
        background: #ffffff;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .audit-list {
        display: grid;
        gap: 0.45rem;
      }

      .audit-row {
        padding: 0.55rem 0.75rem;
        border-left: 3px solid #0f766e;
        background: #f8fafc;
        border-radius: 0 0.45rem 0.45rem 0;
        font-size: 0.82rem;
      }

      .target-pill {
        padding: 0.55rem 0.75rem;
        border-radius: 0.55rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        font-size: 0.86rem;
        color: #1e293b;
      }

      .summary-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        font-size: 0.83rem;
        color: #475569;
      }
    `,
  ],
})
export class InspectionListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly inspectionService = inject(InspectionService);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly notifications = inject(NotificationService);

  private readonly searchSubject = new Subject<string>();

  readonly statusOptions = INSPECTION_STATUS_OPTIONS.filter((opt) => opt.value !== 'RASCUNHO');
  readonly priorityOptions = INSPECTION_PRIORITY_OPTIONS;

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly clients = signal<ClientResponse[]>([]);
  readonly technicians = signal<UserResponse[]>([]);

  readonly pageData = signal<PageResponse<InspectionDetailsResponse>>({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });

  // Estado do modal de cancelamento (RF-07 / EX-02)
  readonly cancelTarget = signal<InspectionDetailsResponse | null>(null);
  readonly cancelSaving = signal(false);
  readonly cancelError = signal<string | null>(null);

  // Estado do modal de detalhes / snapshot / auditoria
  readonly detailsTarget = signal<InspectionDetailsResponse | null>(null);
  readonly detailsLoading = signal(false);
  readonly detailsAuditLogs = signal<AuditLogResponse[]>([]);

  searchFilter = '';
  statusFilter: InspectionStatus | '' = '';
  priorityFilter: InspectionPriority | '' = '';
  clientFilter = '';
  technicianFilter = '';
  scheduledFromFilter = '';
  scheduledToFilter = '';
  overdueOnly = false;

  page = 0;
  size = 20;
  sort = 'scheduledFor,asc';

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const statusParam = qp.get('status') as InspectionStatus | null;
    const overdueParam = qp.get('overdue');
    if (statusParam) {
      this.statusFilter = statusParam;
    }
    if (overdueParam === 'true') {
      this.overdueOnly = true;
    }

    this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.searchFilter = term;
        this.page = 0;
        this.loadInspections();
      });

    this.loadFilterOptions();
    this.loadInspections();
  }

  loadFilterOptions(): void {
    forkJoin({
      clients: this.clientsApi
        .list({ page: 0, size: 200, sort: 'name,asc' })
        .pipe(catchError(() => of(null))),
      technicians: this.usersApi
        .list({ role: 'TECHNICIAN', page: 0, size: 200, sort: 'name,asc' })
        .pipe(catchError(() => of(null))),
    }).subscribe(({ clients, technicians }) => {
      if (clients) {
        this.clients.set(clients.content);
      }
      if (technicians) {
        this.technicians.set(technicians.content);
      }
    });
  }

  onSearchInput(value: string): void {
    this.searchFilter = value;
    this.searchSubject.next(value);
  }

  loadInspections(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.inspectionService
      .list({
        search: this.searchFilter,
        status: this.statusFilter,
        priority: this.priorityFilter,
        clientId: this.clientFilter || undefined,
        technicianId: this.technicianFilter || undefined,
        scheduledFrom: toLocalRangeBoundaryIso(this.scheduledFromFilter, false),
        scheduledTo: toLocalRangeBoundaryIso(this.scheduledToFilter, true),
        overdue: this.overdueOnly ? true : undefined,
        page: this.page,
        size: this.size,
        sort: this.sort,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.pageData.set(response);
        },
        error: (err: unknown) => {
          const message =
            err instanceof InspectionApiError
              ? err.message
              : 'Não foi possível carregar as inspeções.';
          this.loadError.set(message);
        },
      });
  }

  applyFilters(): void {
    this.page = 0;
    this.loadInspections();
  }

  clearFilters(): void {
    this.searchFilter = '';
    this.statusFilter = '';
    this.priorityFilter = '';
    this.clientFilter = '';
    this.technicianFilter = '';
    this.scheduledFromFilter = '';
    this.scheduledToFilter = '';
    this.overdueOnly = false;
    this.page = 0;
    this.loadInspections();
  }

  onSort(field: string): void {
    this.sort = toggleSortExpression(this.sort, field);
    this.page = 0;
    this.loadInspections();
  }

  sortIcon(field: string): string {
    return sortIndicatorFor(this.sort, field);
  }

  onPageChange(nextPage: number): void {
    this.page = nextPage;
    this.loadInspections();
  }

  onSizeChange(nextSize: number): void {
    this.size = nextSize;
    this.page = 0;
    this.loadInspections();
  }

  priorityLabel(priority: InspectionPriority): string {
    return getInspectionPriorityLabel(priority);
  }

  responseTypeLabel(type: string): string {
    return getResponseTypeLabel(type as never);
  }

  canCancel(inspection: InspectionDetailsResponse): boolean {
    return canCancelInspection(inspection.status);
  }

  cancelButtonTitle(inspection: InspectionDetailsResponse): string {
    if (inspection.status === 'APROVADA') {
      return 'Inspeções já aprovadas não podem ser canceladas (RN-030).';
    }
    if (inspection.status === 'CANCELADA') {
      return 'Esta inspeção já está cancelada.';
    }
    return 'Cancelar inspeção com justificativa obrigatória';
  }

  openCancelModal(inspection: InspectionDetailsResponse): void {
    if (!this.canCancel(inspection)) {
      return;
    }
    this.cancelTarget.set(inspection);
    this.cancelError.set(null);
  }

  closeCancelModal(): void {
    if (this.cancelSaving()) {
      return;
    }
    this.cancelTarget.set(null);
    this.cancelError.set(null);
  }

  confirmCancel(reason: string): void {
    const target = this.cancelTarget();
    const trimmedReason = reason.trim();
    if (!target || this.cancelSaving() || !this.canCancel(target)) {
      return;
    }
    if (!trimmedReason) {
      this.cancelError.set('Informe a justificativa do cancelamento.');
      return;
    }

    this.cancelSaving.set(true);
    this.cancelError.set(null);

    this.inspectionService
      .cancel(target.id, { reason: trimmedReason })
      .pipe(finalize(() => this.cancelSaving.set(false)))
      .subscribe({
        next: (updated) => {
          this.cancelTarget.set(null);
          this.notifications.showSuccess(
            `Inspeção "${updated.title}" cancelada com registro de auditoria.`
          );
          this.loadInspections();
        },
        error: (err: unknown) => {
          const message =
            err instanceof InspectionApiError
              ? err.message
              : 'Não foi possível cancelar a inspeção.';
          this.cancelError.set(message);
        },
      });
  }

  openDetailsModal(inspection: InspectionDetailsResponse): void {
    this.detailsTarget.set(inspection);
    this.detailsAuditLogs.set([]);
    this.detailsLoading.set(true);

    forkJoin({
      detail: this.inspectionService.getById(inspection.id),
      audits: this.inspectionService
        .getAuditLogs(inspection.id)
        .pipe(catchError(() => of([] as AuditLogResponse[]))),
    })
      .pipe(finalize(() => this.detailsLoading.set(false)))
      .subscribe({
        next: ({ detail, audits }) => {
          this.detailsTarget.set(detail);
          this.detailsAuditLogs.set(audits);
        },
        error: (err: unknown) => {
          const message =
            err instanceof InspectionApiError
              ? err.message
              : 'Não foi possível carregar os detalhes completos da inspeção.';
          this.notifications.showError(message);
        },
      });
  }

  closeDetailsModal(): void {
    this.detailsTarget.set(null);
    this.detailsAuditLogs.set([]);
  }
}

function toLocalRangeBoundaryIso(dateStr: string, endOfDay: boolean): string | undefined {
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return undefined;
  }
  const timeSuffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const parsed = new Date(`${trimmed}${timeSuffix}`);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  return parsed.toISOString();
}
