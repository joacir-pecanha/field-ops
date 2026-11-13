import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientsApiService } from '../../core/master/clients-api.service';
import { uniqueClientCodeValidator } from '../../core/master/master-async.validators';
import {
  ClientResponse,
  MasterDataApiError,
  MasterStatus,
  PageResponse,
  normalizeOptionalText,
} from '../../core/master/master-data.models';
import { NotificationService } from '../../core/services/notification.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import {
  applyServerFieldErrors,
  clearServerError,
  isControlInvalid,
  sortIndicatorFor,
  toggleSortExpression,
} from '../../shared/utils/form-error.utils';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, PaginationComponent],
  templateUrl: './clients-list.component.html',
})
export class ClientsListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly submitted = signal(false);
  readonly editingClient = signal<ClientResponse | null>(null);

  readonly pageData = signal<PageResponse<ClientResponse>>({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });

  searchFilter = '';
  statusFilter: MasterStatus | '' = '';
  page = 0;
  size = 20;
  sort = 'name,asc';

  readonly form = this.fb.nonNullable.group({
    code: [
      '',
      {
        validators: [
          Validators.minLength(2),
          Validators.maxLength(50),
          Validators.pattern(/^[A-Za-z0-9._-]+$/),
        ],
        asyncValidators: [
          uniqueClientCodeValidator(this.clientsApi, () => this.editingClient()?.id ?? null),
        ],
      },
    ],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    legalName: ['', [Validators.maxLength(200)]],
    document: ['', [Validators.maxLength(32), Validators.pattern(/^[0-9./-]{11,20}$/)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    phone: ['', [Validators.maxLength(32), Validators.pattern(/^\+?[0-9()\s-]{8,20}$/)]],
    status: ['ACTIVE' as MasterStatus, [Validators.required]],
  });

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.clientsApi
      .list({
        search: this.searchFilter,
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
            err instanceof MasterDataApiError
              ? err.message
              : 'Não foi possível carregar os clientes.';
          this.loadError.set(message);
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.page = 0;
    this.loadClients();
  }

  clearFilters(): void {
    this.searchFilter = '';
    this.statusFilter = '';
    this.page = 0;
    this.loadClients();
  }

  onSort(field: string): void {
    this.sort = toggleSortExpression(this.sort, field);
    this.page = 0;
    this.loadClients();
  }

  sortIcon(field: string): string {
    return sortIndicatorFor(this.sort, field);
  }

  onPageChange(nextPage: number): void {
    this.page = nextPage;
    this.loadClients();
  }

  onSizeChange(nextSize: number): void {
    this.size = nextSize;
    this.page = 0;
    this.loadClients();
  }

  openCreateForm(): void {
    this.editingClient.set(null);
    this.submitted.set(false);
    this.formError.set(null);
    this.form.reset({
      code: '',
      name: '',
      legalName: '',
      document: '',
      email: '',
      phone: '',
      status: 'ACTIVE',
    });
    this.formOpen.set(true);
  }

  openEditForm(client: ClientResponse): void {
    this.editingClient.set(client);
    this.submitted.set(false);
    this.formError.set(null);
    this.form.reset({
      code: client.code ?? '',
      name: client.name,
      legalName: client.legalName ?? '',
      document: client.document ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      status: client.status,
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingClient.set(null);
    this.formError.set(null);
  }

  onFieldInput(controlName: string): void {
    clearServerError(this.form, controlName);
  }

  invalid(controlName: string): boolean {
    return isControlInvalid(this.form, controlName, this.submitted());
  }

  submitForm(): void {
    this.submitted.set(true);
    this.formError.set(null);

    if (this.form.pending) {
      this.formError.set('Aguarde a verificação de unicidade do código do cliente.');
      return;
    }

    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const editing = this.editingClient();
    const payload = {
      code: normalizeOptionalText(raw.code),
      name: raw.name.trim(),
      legalName: normalizeOptionalText(raw.legalName),
      document: normalizeOptionalText(raw.document),
      email: normalizeOptionalText(raw.email),
      phone: normalizeOptionalText(raw.phone),
      status: raw.status,
    };

    this.saving.set(true);
    const request$ = editing
      ? this.clientsApi.update(editing.id, payload)
      : this.clientsApi.create(payload);

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingClient.set(null);
        this.notifications.showSuccess(
          editing
            ? `Cliente "${saved.name}" atualizado com sucesso.`
            : `Cliente "${saved.name}" cadastrado com sucesso.`
        );
        this.loadClients();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof MasterDataApiError) {
          this.formError.set(err.message);
          applyServerFieldErrors(this.form, err, { DUPLICATE_CLIENT_CODE: 'code' });
          return;
        }
        this.formError.set('Não foi possível salvar o cliente.');
      },
    });
  }
}
