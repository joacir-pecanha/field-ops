import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClientsApiService } from '../../core/master/clients-api.service';
import { EquipmentApiService } from '../../core/master/equipment-api.service';
import { uniqueSiteCodeValidator } from '../../core/master/master-async.validators';
import {
  ClientResponse,
  MasterDataApiError,
  MasterStatus,
  PageResponse,
  SiteRequest,
  SiteResponse,
  normalizeOptionalText,
} from '../../core/master/master-data.models';
import { SitesApiService } from '../../core/master/sites-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import {
  applyServerFieldErrors,
  clearServerError,
  isControlInvalid,
  sortIndicatorFor,
  toggleSortExpression,
} from '../../shared/utils/form-error.utils';

@Component({
  selector: 'app-sites-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    PaginationComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './sites-list.component.html',
})
export class SitesListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly sitesApi = inject(SitesApiService);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly equipmentApi = inject(EquipmentApiService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deactivating = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly submitted = signal(false);
  readonly editingSite = signal<SiteResponse | null>(null);
  readonly confirmTarget = signal<SiteResponse | null>(null);
  readonly pendingFormPayload = signal<SiteRequest | null>(null);
  readonly confirmAlertBanner = signal<string | null>(null);

  readonly allClients = signal<ClientResponse[]>([]);
  readonly activeClients = signal<ClientResponse[]>([]);

  readonly pageData = signal<PageResponse<SiteResponse>>({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });

  clientFilter = '';
  searchFilter = '';
  statusFilter: MasterStatus | '' = '';
  page = 0;
  size = 20;
  sort = 'name,asc';

  readonly form = this.fb.nonNullable.group({
    clientId: ['', [Validators.required]],
    code: [
      '',
      [
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[A-Za-z0-9._-]+$/),
      ],
    ],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(500)]],
    addressLine: ['', [Validators.maxLength(255)]],
    city: ['', [Validators.maxLength(120)]],
    state: ['', [Validators.pattern(/^[A-Za-z]{2}$/)]],
    postalCode: ['', [Validators.pattern(/^\d{5}-?\d{3}$/)]],
    latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
    contactName: ['', [Validators.maxLength(150)]],
    contactPhone: ['', [Validators.maxLength(32), Validators.pattern(/^\+?[0-9()\s-]{8,20}$/)]],
    status: ['ACTIVE' as MasterStatus, [Validators.required]],
  });

  ngOnInit(): void {
    this.form.controls.code.addAsyncValidators(
      uniqueSiteCodeValidator(
        this.sitesApi,
        () => this.form.controls.clientId.value || null,
        () => this.editingSite()?.id ?? null
      )
    );

    const paramClientId = this.route.snapshot.paramMap.get('clientId');
    const queryClientId = this.route.snapshot.queryParamMap.get('clientId');
    this.clientFilter = paramClientId ?? queryClientId ?? '';

    this.loadClientOptions();
    this.loadSites();
  }

  loadClientOptions(): void {
    this.clientsApi.list({ page: 0, size: 200, sort: 'name,asc' }).subscribe({
      next: (res) => {
        this.allClients.set(res.content);
        this.activeClients.set(res.content.filter((client) => client.active));
      },
    });
  }

  loadSites(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.sitesApi
      .list({
        clientId: this.clientFilter || undefined,
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
            err instanceof MasterDataApiError ? err.message : 'Não foi possível carregar os locais.';
          this.loadError.set(message);
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.page = 0;
    this.loadSites();
  }

  clearFilters(): void {
    this.clientFilter = '';
    this.searchFilter = '';
    this.statusFilter = '';
    this.page = 0;
    this.loadSites();
  }

  onSort(field: string): void {
    this.sort = toggleSortExpression(this.sort, field);
    this.page = 0;
    this.loadSites();
  }

  sortIcon(field: string): string {
    return sortIndicatorFor(this.sort, field);
  }

  onPageChange(nextPage: number): void {
    this.page = nextPage;
    this.loadSites();
  }

  onSizeChange(nextSize: number): void {
    this.size = nextSize;
    this.page = 0;
    this.loadSites();
  }

  openCreateForm(): void {
    this.editingSite.set(null);
    this.submitted.set(false);
    this.formError.set(null);
    this.loadClientOptions();

    const preselectedClientId =
      this.activeClients().some((c) => c.id === this.clientFilter) ? this.clientFilter : '';

    this.form.reset({
      clientId: preselectedClientId,
      code: '',
      name: '',
      description: '',
      addressLine: '',
      city: '',
      state: '',
      postalCode: '',
      latitude: null,
      longitude: null,
      contactName: '',
      contactPhone: '',
      status: 'ACTIVE',
    });
    this.formOpen.set(true);
  }

  openEditForm(site: SiteResponse): void {
    this.editingSite.set(site);
    this.submitted.set(false);
    this.formError.set(null);
    this.loadClientOptions();

    this.form.reset({
      clientId: site.clientId,
      code: site.code ?? '',
      name: site.name,
      description: site.description ?? '',
      addressLine: site.addressLine ?? '',
      city: site.city ?? '',
      state: site.state ?? '',
      postalCode: site.postalCode ?? '',
      latitude: site.latitude,
      longitude: site.longitude,
      contactName: site.contactName ?? '',
      contactPhone: site.contactPhone ?? '',
      status: site.status,
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingSite.set(null);
    this.formError.set(null);
  }

  onClientSelectionChanged(): void {
    clearServerError(this.form, 'clientId');
    this.form.controls.code.updateValueAndValidity();
  }

  onFieldInput(controlName: string): void {
    clearServerError(this.form, controlName);
  }

  invalid(controlName: string): boolean {
    return isControlInvalid(this.form, controlName, this.submitted());
  }

  selectableClients(): ClientResponse[] {
    const actives = this.activeClients();
    const editing = this.editingSite();
    if (!editing) {
      return actives;
    }
    const alreadyPresent = actives.some((c) => c.id === editing.clientId);
    if (alreadyPresent) {
      return actives;
    }
    const current = this.allClients().find((c) => c.id === editing.clientId);
    return current ? [current, ...actives] : actives;
  }

  submitForm(): void {
    this.submitted.set(true);
    this.formError.set(null);

    if (this.form.pending) {
      this.formError.set('Aguarde a verificação de unicidade do código do local.');
      return;
    }

    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const editing = this.editingSite();
    const stateNormalized = normalizeOptionalText(raw.state);
    const payload: SiteRequest = {
      clientId: raw.clientId,
      code: normalizeOptionalText(raw.code),
      name: raw.name.trim(),
      description: normalizeOptionalText(raw.description),
      addressLine: normalizeOptionalText(raw.addressLine),
      city: normalizeOptionalText(raw.city),
      state: stateNormalized ? stateNormalized.toUpperCase() : null,
      postalCode: normalizeOptionalText(raw.postalCode),
      latitude: raw.latitude,
      longitude: raw.longitude,
      contactName: normalizeOptionalText(raw.contactName),
      contactPhone: normalizeOptionalText(raw.contactPhone),
      status: raw.status,
    };

    if (editing && editing.active && payload.status === 'INACTIVE') {
      this.openDeactivateConfirm(editing, payload);
      return;
    }

    this.executeSave(editing, payload);
  }

  requestDeactivate(site: SiteResponse): void {
    this.openDeactivateConfirm(site, null);
  }

  reactivateSite(site: SiteResponse): void {
    if (this.deactivating()) {
      return;
    }
    this.deactivating.set(true);
    this.sitesApi.activate(site.id).subscribe({
      next: (saved) => {
        this.deactivating.set(false);
        this.notifications.showSuccess(`Local "${saved.name}" reativado com sucesso.`);
        this.loadSites();
      },
      error: (err: unknown) => {
        this.deactivating.set(false);
        const message =
          err instanceof MasterDataApiError
            ? err.message
            : 'Não foi possível reativar o local.';
        this.notifications.showError(message);
      },
    });
  }

  cancelDeactivate(): void {
    if (this.deactivating() || this.saving()) {
      return;
    }
    this.confirmTarget.set(null);
    this.pendingFormPayload.set(null);
    this.confirmAlertBanner.set(null);
  }

  confirmDeactivate(): void {
    const target = this.confirmTarget();
    const formPayload = this.pendingFormPayload();
    if (!target || this.deactivating() || this.saving()) {
      return;
    }

    if (formPayload) {
      this.confirmTarget.set(null);
      this.pendingFormPayload.set(null);
      this.confirmAlertBanner.set(null);
      this.executeSave(target, formPayload);
      return;
    }

    this.deactivating.set(true);
    this.sitesApi.deactivate(target.id).subscribe({
      next: (saved) => {
        this.deactivating.set(false);
        this.confirmTarget.set(null);
        this.confirmAlertBanner.set(null);
        this.notifications.showSuccess(`Local "${saved.name}" inativado com sucesso.`);
        this.loadSites();
      },
      error: (err: unknown) => {
        this.deactivating.set(false);
        const message =
          err instanceof MasterDataApiError
            ? err.message
            : 'Não foi possível inativar o local.';
        this.notifications.showError(message);
      },
    });
  }

  private openDeactivateConfirm(site: SiteResponse, formPayload: SiteRequest | null): void {
    this.confirmTarget.set(site);
    this.pendingFormPayload.set(formPayload);
    this.confirmAlertBanner.set(null);

    this.equipmentApi
      .list({ siteId: site.id, active: true, page: 0, size: 1 })
      .subscribe({
        next: (res) => {
          if (this.confirmTarget()?.id !== site.id) {
            return;
          }
          if (res.totalElements > 0) {
            this.confirmAlertBanner.set(
              `Este local possui ${res.totalElements} equipamento(s) ativo(s) vinculado(s). Após a inativação, nem o local nem seus equipamentos poderão receber novas inspeções.`
            );
          }
        },
      });
  }

  private executeSave(editing: SiteResponse | null, payload: SiteRequest): void {
    this.saving.set(true);
    const request$ = editing
      ? this.sitesApi.update(editing.id, payload)
      : this.sitesApi.create(payload);

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingSite.set(null);
        this.notifications.showSuccess(
          editing
            ? `Local "${saved.name}" atualizado com sucesso.`
            : `Local "${saved.name}" cadastrado com sucesso.`
        );
        this.loadSites();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof MasterDataApiError) {
          this.formError.set(err.message);
          applyServerFieldErrors(this.form, err, {
            DUPLICATE_SITE_CODE: 'code',
            INACTIVE_CLIENT: 'clientId',
          });
          return;
        }
        this.formError.set('Não foi possível salvar o local.');
      },
    });
  }
}
