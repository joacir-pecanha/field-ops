import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PageResponse } from '../../core/master/master-data.models';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { sortIndicatorFor, toggleSortExpression } from '../../shared/utils/form-error.utils';
import {
  TEMPLATE_CATEGORY_OPTIONS,
  TemplateApiError,
  TemplateResponse,
  TemplateService,
  TemplateStatus,
  getCategoryLabel,
  getTemplateStatusLabel,
} from './template.service';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PaginationComponent, ConfirmModalComponent],
  templateUrl: './template-list.component.html',
  styles: [
    `
      .badge-draft {
        background: #fffbeb;
        color: #b45309;
        border: 1px solid #fde68a;
      }

      .badge-published {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }

      .version-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.55rem;
        border-radius: 0.45rem;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        font-size: 0.78rem;
        font-weight: 700;
        color: #1e293b;
        white-space: nowrap;
      }

      .version-sub {
        display: block;
        margin-top: 0.2rem;
        font-size: 0.75rem;
        color: #64748b;
      }

      .structure-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        align-items: center;
        font-size: 0.81rem;
        color: #334155;
      }

      .structure-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.14rem 0.45rem;
        border-radius: 0.4rem;
        background: #f1f5f9;
        color: #334155;
        font-weight: 600;
        font-size: 0.76rem;
      }

      .category-tag {
        display: inline-flex;
        align-items: center;
        padding: 0.2rem 0.55rem;
        border-radius: 0.4rem;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1d4ed8;
        font-size: 0.75rem;
        font-weight: 700;
      }

      .btn-teal-outline {
        background: #ffffff;
        color: #0f766e;
        border-color: #99f6e4;

        &:hover:not(:disabled) {
          background: #f0fdfa;
          border-color: #0f766e;
        }
      }
    `,
  ],
})
export class TemplateListComponent implements OnInit {
  private readonly templateService = inject(TemplateService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly categoryOptions = TEMPLATE_CATEGORY_OPTIONS;

  readonly loading = signal(false);
  readonly actionBusy = signal(false);
  readonly creatingVersionId = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly confirmDeactivateTarget = signal<TemplateResponse | null>(null);

  readonly pageData = signal<PageResponse<TemplateResponse>>({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });

  searchFilter = '';
  categoryFilter = '';
  statusFilter: TemplateStatus | '' = '';
  page = 0;
  size = 20;
  sort = 'title,asc';

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.templateService
      .list({
        search: this.searchFilter,
        category: this.categoryFilter,
        status: this.statusFilter,
        page: this.page,
        size: this.size,
        sort: this.sort,
      })
      .subscribe({
        next: (response) => {
          this.pageData.set(response);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          const message =
            err instanceof TemplateApiError
              ? err.message
              : 'Não foi possível carregar os modelos de inspeção.';
          this.loadError.set(message);
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.page = 0;
    this.loadTemplates();
  }

  clearFilters(): void {
    this.searchFilter = '';
    this.categoryFilter = '';
    this.statusFilter = '';
    this.page = 0;
    this.loadTemplates();
  }

  onSort(field: string): void {
    this.sort = toggleSortExpression(this.sort, field);
    this.page = 0;
    this.loadTemplates();
  }

  sortIcon(field: string): string {
    return sortIndicatorFor(this.sort, field);
  }

  onPageChange(nextPage: number): void {
    this.page = nextPage;
    this.loadTemplates();
  }

  onSizeChange(nextSize: number): void {
    this.size = nextSize;
    this.page = 0;
    this.loadTemplates();
  }

  categoryLabel(category: string): string {
    return getCategoryLabel(category);
  }

  statusLabel(status: TemplateStatus): string {
    return getTemplateStatusLabel(status);
  }

  startNewVersion(template: TemplateResponse): void {
    if (this.creatingVersionId() || this.actionBusy()) {
      return;
    }

    this.creatingVersionId.set(template.id);
    this.templateService.createNewVersion(template.id).subscribe({
      next: (createdVersion) => {
        this.creatingVersionId.set(null);
        this.notifications.showSuccess(
          `Nova versão v${createdVersion.versionNumber} iniciada em rascunho para "${template.title}".`
        );
        void this.router.navigate(['/app/inspection-templates', template.id, 'edit']);
      },
      error: (err: unknown) => {
        this.creatingVersionId.set(null);
        const message =
          err instanceof TemplateApiError
            ? err.message
            : 'Não foi possível iniciar uma nova versão do modelo.';
        this.notifications.showError(message);
      },
    });
  }

  requestDeactivate(template: TemplateResponse): void {
    this.confirmDeactivateTarget.set(template);
  }

  cancelDeactivate(): void {
    if (this.actionBusy()) {
      return;
    }
    this.confirmDeactivateTarget.set(null);
  }

  confirmDeactivate(): void {
    const target = this.confirmDeactivateTarget();
    if (!target || this.actionBusy()) {
      return;
    }

    this.actionBusy.set(true);
    this.templateService.deactivate(target.id).subscribe({
      next: (saved) => {
        this.actionBusy.set(false);
        this.confirmDeactivateTarget.set(null);
        this.notifications.showSuccess(`Modelo "${saved.title}" inativado com sucesso.`);
        this.loadTemplates();
      },
      error: (err: unknown) => {
        this.actionBusy.set(false);
        const message =
          err instanceof TemplateApiError ? err.message : 'Não foi possível inativar o modelo.';
        this.notifications.showError(message);
      },
    });
  }

  reactivateTemplate(template: TemplateResponse): void {
    if (this.actionBusy()) {
      return;
    }

    this.actionBusy.set(true);
    this.templateService.activate(template.id).subscribe({
      next: (saved) => {
        this.actionBusy.set(false);
        this.notifications.showSuccess(`Modelo "${saved.title}" reativado com sucesso.`);
        this.loadTemplates();
      },
      error: (err: unknown) => {
        this.actionBusy.set(false);
        const message =
          err instanceof TemplateApiError ? err.message : 'Não foi possível reativar o modelo.';
        this.notifications.showError(message);
      },
    });
  }
}
