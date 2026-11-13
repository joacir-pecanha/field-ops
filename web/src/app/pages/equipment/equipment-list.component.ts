import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ClientsApiService } from '../../core/master/clients-api.service';
import { EquipmentApiService } from '../../core/master/equipment-api.service';
import { uniqueEquipmentQrCodeValidator } from '../../core/master/master-async.validators';
import {
  ClientResponse,
  EquipmentResponse,
  EquipmentStatus,
  MasterDataApiError,
  PageResponse,
  SiteResponse,
  normalizeOptionalText,
} from '../../core/master/master-data.models';
import { SitesApiService } from '../../core/master/sites-api.service';
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
  selector: 'app-equipment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent],
  templateUrl: './equipment-list.component.html',
})
export class EquipmentListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly equipmentApi = inject(EquipmentApiService);
  private readonly sitesApi = inject(SitesApiService);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly notifications = inject(NotificationService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadingFormSites = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly submitted = signal(false);
  readonly editingEquipment = signal<EquipmentResponse | null>(null);
  readonly qrServerCollision = signal<string | null>(null);

  readonly allClients = signal<ClientResponse[]>([]);
  readonly activeClients = signal<ClientResponse[]>([]);
  readonly filterSites = signal<SiteResponse[]>([]);
  readonly formSites = signal<SiteResponse[]>([]);

  readonly pageData = signal<PageResponse<EquipmentResponse>>({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });

  clientFilter = '';
  siteFilter = '';
  searchFilter = '';
  statusFilter: EquipmentStatus | '' = '';
  page = 0;
  size = 20;
  sort = 'name,asc';

  readonly form = this.fb.nonNullable.group({
    clientId: ['', [Validators.required]],
    siteId: ['', [Validators.required]],
    code: [
      '',
      [
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[A-Za-z0-9._-]+$/),
      ],
    ],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    qrCode: [
      '',
      {
        validators: [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(120),
          Validators.pattern(/^[A-Za-z0-9._:-]+$/),
        ],
        asyncValidators: [
          uniqueEquipmentQrCodeValidator(
            this.equipmentApi,
            () => this.editingEquipment()?.id ?? null
          ),
        ],
      },
    ],
    assetNumber: [
      '',
      [Validators.maxLength(80), Validators.pattern(/^[A-Za-z0-9._-]+$/)],
    ],
    serialNumber: [
      '',
      [Validators.maxLength(100), Validators.pattern(/^[A-Za-z0-9._-]+$/)],
    ],
    manufacturer: ['', [Validators.maxLength(120)]],
    model: ['', [Validators.maxLength(120)]],
    installedAt: [''],
    status: ['ACTIVE' as EquipmentStatus, [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    const paramSiteId = this.route.snapshot.paramMap.get('siteId');
    const queryClientId = this.route.snapshot.queryParamMap.get('clientId');
    const querySiteId = this.route.snapshot.queryParamMap.get('siteId');

    this.clientFilter = queryClientId ?? '';
    this.siteFilter = paramSiteId ?? querySiteId ?? '';

    this.loadClientOptions();

    if (this.siteFilter && !this.clientFilter) {
      this.sitesApi.getById(this.siteFilter).subscribe({
        next: (site) => {
          this.clientFilter = site.clientId;
          this.loadFilterSites(site.clientId);
          this.loadEquipment();
        },
        error: () => this.loadEquipment(),
      });
      return;
    }

    if (this.clientFilter) {
      this.loadFilterSites(this.clientFilter);
    }
    this.loadEquipment();
  }

  loadClientOptions(): void {
    this.clientsApi.list({ page: 0, size: 200, sort: 'name,asc' }).subscribe({
      next: (res) => {
        this.allClients.set(res.content);
        this.activeClients.set(res.content.filter((c) => c.active));
      },
    });
  }

  onFilterClientChange(): void {
    this.siteFilter = '';
    if (this.clientFilter) {
      this.loadFilterSites(this.clientFilter);
    } else {
      this.filterSites.set([]);
    }
    this.applyFilters();
  }

  loadFilterSites(clientId: string): void {
    this.sitesApi.listByClient(clientId, false, 200).subscribe({
      next: (sites) => this.filterSites.set(sites),
      error: () => this.filterSites.set([]),
    });
  }

  loadEquipment(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.equipmentApi
      .list({
        clientId: this.clientFilter || undefined,
        siteId: this.siteFilter || undefined,
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
              : 'Não foi possível carregar os equipamentos.';
          this.loadError.set(message);
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.page = 0;
    this.loadEquipment();
  }

  clearFilters(): void {
    this.clientFilter = '';
    this.siteFilter = '';
    this.searchFilter = '';
    this.statusFilter = '';
    this.filterSites.set([]);
    this.page = 0;
    this.loadEquipment();
  }

  onSort(field: string): void {
    this.sort = toggleSortExpression(this.sort, field);
    this.page = 0;
    this.loadEquipment();
  }

  sortIcon(field: string): string {
    return sortIndicatorFor(this.sort, field);
  }

  onPageChange(nextPage: number): void {
    this.page = nextPage;
    this.loadEquipment();
  }

  onSizeChange(nextSize: number): void {
    this.size = nextSize;
    this.page = 0;
    this.loadEquipment();
  }

  openCreateForm(): void {
    this.editingEquipment.set(null);
    this.submitted.set(false);
    this.formError.set(null);
    this.qrServerCollision.set(null);
    this.loadClientOptions();

    const preClientId =
      this.activeClients().some((c) => c.id === this.clientFilter) ? this.clientFilter : '';

    this.form.reset({
      clientId: preClientId,
      siteId: '',
      code: '',
      name: '',
      qrCode: '',
      assetNumber: '',
      serialNumber: '',
      manufacturer: '',
      model: '',
      installedAt: '',
      status: 'ACTIVE',
      description: '',
    });

    if (preClientId) {
      this.loadFormSitesForClient(preClientId, this.siteFilter || undefined);
    } else {
      this.formSites.set([]);
    }

    this.formOpen.set(true);
  }

  openEditForm(item: EquipmentResponse): void {
    this.editingEquipment.set(item);
    this.submitted.set(false);
    this.formError.set(null);
    this.qrServerCollision.set(null);
    this.loadClientOptions();

    this.form.reset({
      clientId: item.clientId,
      siteId: item.siteId,
      code: item.code ?? '',
      name: item.name,
      qrCode: item.qrCode,
      assetNumber: item.assetNumber ?? '',
      serialNumber: item.serialNumber ?? '',
      manufacturer: item.manufacturer ?? '',
      model: item.model ?? '',
      installedAt: item.installedAt ?? '',
      status: item.status,
      description: item.description ?? '',
    });

    this.loadFormSitesForClient(item.clientId, item.siteId);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingEquipment.set(null);
    this.formError.set(null);
    this.qrServerCollision.set(null);
  }

  onFormClientChange(): void {
    const clientId = this.form.controls.clientId.value;
    clearServerError(this.form, 'clientId');
    clearServerError(this.form, 'siteId');
    this.form.controls.siteId.setValue('');

    if (clientId) {
      this.loadFormSitesForClient(clientId);
    } else {
      this.formSites.set([]);
    }
  }

  onQrInput(): void {
    this.qrServerCollision.set(null);
    clearServerError(this.form, 'qrCode');
  }

  onFieldInput(controlName: string): void {
    clearServerError(this.form, controlName);
  }

  suggestUniqueQrCode(): void {
    const codePart = this.form.controls.code.value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9._-]/g, '');
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const suggested = codePart ? `QR-${codePart}-${suffix}` : `QR-FIELDOPS-${suffix}`;
    this.qrServerCollision.set(null);
    this.form.controls.qrCode.setValue(suggested);
    this.form.controls.qrCode.markAsDirty();
    this.form.controls.qrCode.markAsTouched();
  }

  hasQrCollision(): boolean {
    return Boolean(
      this.qrServerCollision() ||
        this.form.controls.qrCode.hasError('qrCodeTaken')
    );
  }

  invalid(controlName: string): boolean {
    return isControlInvalid(this.form, controlName, this.submitted());
  }

  selectableClients(): ClientResponse[] {
    const actives = this.activeClients();
    const editing = this.editingEquipment();
    if (!editing || actives.some((c) => c.id === editing.clientId)) {
      return actives;
    }
    const current = this.allClients().find((c) => c.id === editing.clientId);
    return current ? [current, ...actives] : actives;
  }

  submitForm(): void {
    this.submitted.set(true);
    this.formError.set(null);

    if (this.form.pending) {
      this.formError.set('Aguarde a verificação de unicidade do QR Code finalizar.');
      return;
    }

    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const editing = this.editingEquipment();
    const payload = {
      siteId: raw.siteId,
      code: normalizeOptionalText(raw.code),
      name: raw.name.trim(),
      assetNumber: normalizeOptionalText(raw.assetNumber),
      serialNumber: normalizeOptionalText(raw.serialNumber),
      manufacturer: normalizeOptionalText(raw.manufacturer),
      model: normalizeOptionalText(raw.model),
      description: normalizeOptionalText(raw.description),
      qrCode: raw.qrCode.trim(),
      status: raw.status,
      installedAt: normalizeOptionalText(raw.installedAt),
    };

    this.saving.set(true);
    const request$ = editing
      ? this.equipmentApi.update(editing.id, payload)
      : this.equipmentApi.create(payload);

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingEquipment.set(null);
        this.qrServerCollision.set(null);
        this.notifications.showSuccess(
          editing
            ? `Equipamento "${saved.name}" atualizado com sucesso.`
            : `Equipamento "${saved.name}" cadastrado com sucesso.`
        );
        this.loadEquipment();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof MasterDataApiError) {
          this.formError.set(err.message);
          if (err.code === 'DUPLICATE_QR_CODE' || err.status === 409) {
            this.qrServerCollision.set(err.message);
          }
          applyServerFieldErrors(this.form, err, {
            DUPLICATE_QR_CODE: 'qrCode',
            INACTIVE_SITE: 'siteId',
            INACTIVE_CLIENT: 'clientId',
          });
          return;
        }
        this.formError.set('Não foi possível salvar o equipamento.');
      },
    });
  }

  statusLabel(status: EquipmentStatus): string {
    switch (status) {
      case 'ACTIVE':
        return 'Ativo';
      case 'INACTIVE':
        return 'Inativo';
      case 'DECOMMISSIONED':
        return 'Descomissionado';
    }
  }

  private loadFormSitesForClient(clientId: string, preferredSiteId?: string): void {
    this.loadingFormSites.set(true);
    this.sitesApi.listByClient(clientId, true, 200).subscribe({
      next: (sites) => {
        const editing = this.editingEquipment();
        let available = sites;

        if (
          editing &&
          editing.clientId === clientId &&
          !sites.some((s) => s.id === editing.siteId)
        ) {
          available = [
            {
              id: editing.siteId,
              clientId: editing.clientId,
              clientName: editing.clientName,
              code: null,
              name: `${editing.siteName} (Inativo)`,
              description: null,
              addressLine: null,
              city: null,
              state: null,
              postalCode: null,
              latitude: null,
              longitude: null,
              contactName: null,
              contactPhone: null,
              status: 'INACTIVE',
              active: false,
              createdAt: editing.createdAt,
              updatedAt: editing.updatedAt,
              version: 0,
            },
            ...sites,
          ];
        }

        this.formSites.set(available);
        if (preferredSiteId && available.some((s) => s.id === preferredSiteId)) {
          this.form.controls.siteId.setValue(preferredSiteId);
        }
        this.loadingFormSites.set(false);
      },
      error: () => {
        this.formSites.set([]);
        this.loadingFormSites.set(false);
      },
    });
  }
}
