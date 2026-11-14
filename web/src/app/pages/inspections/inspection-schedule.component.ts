import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of, switchMap, tap } from 'rxjs';
import { ClientsApiService } from '../../core/master/clients-api.service';
import { EquipmentApiService } from '../../core/master/equipment-api.service';
import {
  ClientResponse,
  EquipmentResponse,
  MasterDataApiError,
  SiteResponse,
  UserResponse,
  normalizeOptionalText,
} from '../../core/master/master-data.models';
import { SitesApiService } from '../../core/master/sites-api.service';
import { UsersApiService } from '../../core/master/users-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { applyServerFieldErrors, clearServerError, isControlInvalid } from '../../shared/utils/form-error.utils';
import {
  TemplateResponse,
  TemplateService,
  TemplateVersionResponse,
  getCategoryLabel,
} from '../templates/template.service';
import {
  INSPECTION_PRIORITY_OPTIONS,
  InspectionApiError,
  InspectionPriority,
  InspectionService,
  ScheduleInspectionRequest,
  getInspectionPriorityLabel,
} from './inspection.service';

@Component({
  selector: 'app-inspection-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './inspection-schedule.component.html',
  styles: [
    `
      .schedule-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.85fr) minmax(290px, 1fr);
        gap: 1.25rem;
        align-items: start;
      }

      .schedule-main {
        display: grid;
        gap: 1.15rem;
      }

      .section-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.85rem;
        padding: 1.2rem 1.3rem;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        display: grid;
        gap: 1rem;
      }

      .section-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #f1f5f9;

        h2 {
          margin: 0 0 0.2rem;
          font-size: 1.02rem;
          font-weight: 700;
          color: #0f172a;
        }

        p {
          margin: 0;
          font-size: 0.83rem;
          color: #64748b;
        }
      }

      .step-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        background: #f0fdfa;
        border: 1px solid #99f6e4;
        color: #0f766e;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }

      .qr-lookup-box {
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 0.7rem;
        padding: 0.9rem 1rem;
        display: grid;
        gap: 0.55rem;

        label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
      }

      .qr-lookup-row {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;

        input {
          flex: 1 1 240px;
          padding: 0.56rem 0.78rem;
          border-radius: 0.55rem;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.88rem;

          &:focus {
            outline: none;
            border-color: #0f766e;
            box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
          }
        }
      }

      .qr-feedback {
        font-size: 0.81rem;
        font-weight: 600;
        padding: 0.45rem 0.65rem;
        border-radius: 0.45rem;

        &.qr-feedback-success {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        &.qr-feedback-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
      }

      .summary-card {
        position: sticky;
        top: 1rem;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-top: 4px solid #0f766e;
        border-radius: 0.85rem;
        padding: 1.2rem;
        box-shadow: 0 8px 20px -12px rgba(15, 23, 42, 0.16);
        display: grid;
        gap: 0.95rem;

        h2 {
          margin: 0;
          font-size: 1.05rem;
          color: #0f172a;
        }
      }

      .summary-list {
        display: grid;
        gap: 0.7rem;
        margin: 0;
      }

      .summary-item {
        display: grid;
        gap: 0.15rem;
        padding-bottom: 0.6rem;
        border-bottom: 1px solid #f1f5f9;

        dt {
          font-size: 0.73rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }

        dd {
          margin: 0;
          font-size: 0.88rem;
          font-weight: 600;
          color: #0f172a;
          word-break: break-word;
        }
      }

      .summary-sub {
        display: block;
        font-size: 0.77rem;
        font-weight: 500;
        color: #64748b;
        margin-top: 0.1rem;
      }

      .snapshot-note {
        padding: 0.7rem 0.85rem;
        border-radius: 0.6rem;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e40af;
        font-size: 0.8rem;
        line-height: 1.45;
      }

      .validation-callout {
        padding: 0.7rem 0.85rem;
        border-radius: 0.6rem;
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
        font-size: 0.8rem;
        line-height: 1.45;
      }

      .submit-bar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        flex-wrap: wrap;
        padding-top: 0.35rem;
      }

      @media (max-width: 1024px) {
        .schedule-layout {
          grid-template-columns: 1fr;
        }

        .summary-card {
          position: static;
        }
      }
    `,
  ],
})
export class InspectionScheduleComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly inspectionService = inject(InspectionService);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly sitesApi = inject(SitesApiService);
  private readonly equipmentApi = inject(EquipmentApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly templateService = inject(TemplateService);
  private readonly notifications = inject(NotificationService);

  readonly priorityOptions = INSPECTION_PRIORITY_OPTIONS;

  readonly loadingInitial = signal(true);
  readonly loadingSites = signal(false);
  readonly loadingEquipments = signal(false);
  readonly loadingVersions = signal(false);
  readonly lookingUpQr = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);

  readonly loadError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly qrLookupMessage = signal<string | null>(null);
  readonly qrLookupError = signal<string | null>(null);

  readonly clients = signal<ClientResponse[]>([]);
  readonly sites = signal<SiteResponse[]>([]);
  readonly equipments = signal<EquipmentResponse[]>([]);
  readonly templates = signal<TemplateResponse[]>([]);
  readonly publishedVersions = signal<TemplateVersionResponse[]>([]);
  readonly technicians = signal<UserResponse[]>([]);

  qrLookupTerm = '';

  private pendingPrefillSiteId: string | null = null;
  private pendingPrefillEquipmentId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    clientId: ['', [Validators.required]],
    siteId: ['', [Validators.required]],
    equipmentId: [''],
    templateId: ['', [Validators.required]],
    templateVersionId: ['', [Validators.required]],
    technicianId: ['', [Validators.required]],
    scheduledDate: [defaultScheduleDate(), [Validators.required]],
    scheduledTime: ['09:00', [Validators.required]],
    priority: ['MEDIA' as InspectionPriority, [Validators.required]],
    title: ['', [Validators.maxLength(250)]],
    instructions: ['', [Validators.maxLength(2000)]],
  });

  readonly formVersionSnapshot = signal(0);

  readonly selectedClient = computed(() => {
    this.formVersionSnapshot();
    const id = this.form.controls.clientId.value;
    return this.clients().find((c) => c.id === id) ?? null;
  });

  readonly selectedSite = computed(() => {
    this.formVersionSnapshot();
    const id = this.form.controls.siteId.value;
    return this.sites().find((s) => s.id === id) ?? null;
  });

  readonly selectedEquipment = computed(() => {
    this.formVersionSnapshot();
    const id = this.form.controls.equipmentId.value;
    return this.equipments().find((eq) => eq.id === id) ?? null;
  });

  readonly selectedTemplate = computed(() => {
    this.formVersionSnapshot();
    const id = this.form.controls.templateId.value;
    return this.templates().find((t) => t.id === id) ?? null;
  });

  readonly selectedTemplateVersion = computed(() => {
    this.formVersionSnapshot();
    const id = this.form.controls.templateVersionId.value;
    return this.publishedVersions().find((v) => v.id === id) ?? null;
  });

  readonly selectedTechnician = computed(() => {
    this.formVersionSnapshot();
    const id = this.form.controls.technicianId.value;
    return this.technicians().find((u) => u.id === id) ?? null;
  });

  readonly resolvedPreviewTitle = computed(() => {
    this.formVersionSnapshot();
    const customTitle = this.form.controls.title.value.trim();
    if (customTitle) {
      return customTitle;
    }
    const tplTitle =
      this.selectedTemplateVersion()?.titleSnapshot ||
      this.selectedTemplate()?.title ||
      'Modelo de Inspeção';
    const target = this.selectedEquipment()?.name || this.selectedSite()?.name || 'Local / Equipamento';
    return `${tplTitle} - ${target}`;
  });

  readonly missingRequiredSummary = computed(() => {
    this.formVersionSnapshot();
    const missing: string[] = [];
    const controls = this.form.controls;
    if (controls.clientId.invalid) missing.push('Cliente');
    if (controls.siteId.invalid) missing.push('Local');
    if (controls.templateId.invalid) missing.push('Modelo publicado');
    if (controls.templateVersionId.invalid) missing.push('Versão publicada');
    if (controls.technicianId.invalid) missing.push('Técnico responsável');
    if (controls.scheduledDate.invalid) missing.push('Data prevista');
    if (controls.scheduledTime.invalid) missing.push('Horário previsto');
    if (controls.priority.invalid) missing.push('Prioridade');
    return missing;
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formVersionSnapshot.update((v) => v + 1);
    });

    this.setupCascadingValueChanges();
    this.loadInitialOptions();
  }

  loadInitialOptions(): void {
    this.loadingInitial.set(true);
    this.loadError.set(null);

    forkJoin({
      clients: this.clientsApi.listActive(undefined, 200),
      templates: this.templateService.list({ active: true, page: 0, size: 200, sort: 'title,asc' }),
      technicians: this.usersApi.list({
        role: 'TECHNICIAN',
        status: 'ACTIVE',
        active: true,
        page: 0,
        size: 200,
        sort: 'name,asc',
      }),
    })
      .pipe(finalize(() => this.loadingInitial.set(false)))
      .subscribe({
        next: ({ clients, templates, technicians }) => {
          this.clients.set(clients.filter((c) => c.active));
          this.templates.set(
            templates.content.filter(
              (tpl) => tpl.active && (tpl.status === 'PUBLISHED' || tpl.currentVersion > 0)
            )
          );
          this.technicians.set(
            technicians.content.filter((u) => u.active && u.role === 'TECHNICIAN')
          );
        },
        error: (err: unknown) => {
          const message =
            err instanceof MasterDataApiError
              ? err.message
              : 'Não foi possível carregar clientes, modelos publicados e técnicos ativos.';
          this.loadError.set(message);
        },
      });
  }

  onClientManualChange(): void {
    this.pendingPrefillSiteId = null;
    this.pendingPrefillEquipmentId = null;
    this.qrLookupMessage.set(null);
    this.qrLookupError.set(null);
  }

  onSiteManualChange(): void {
    this.pendingPrefillEquipmentId = null;
    this.qrLookupMessage.set(null);
    this.qrLookupError.set(null);
  }

  lookupEquipmentByCodeOrQr(): void {
    const term = this.qrLookupTerm.trim();
    this.qrLookupMessage.set(null);
    this.qrLookupError.set(null);

    if (!term) {
      this.qrLookupError.set('Informe o QR Code ou código do equipamento para localizar.');
      return;
    }

    this.lookingUpQr.set(true);
    this.equipmentApi
      .getByQrCode(term)
      .pipe(
        catchError(() =>
          this.equipmentApi.list({ search: term, page: 0, size: 10, sort: 'name,asc' }).pipe(
            switchMap((page) => {
              const normalized = term.toLowerCase();
              const exact = page.content.find(
                (item) =>
                  item.qrCode.toLowerCase() === normalized ||
                  (item.code && item.code.toLowerCase() === normalized)
              );
              const candidate = exact ?? (page.content.length === 1 ? page.content[0] : null);
              return of(candidate);
            }),
            catchError(() => of(null))
          )
        ),
        finalize(() => this.lookingUpQr.set(false))
      )
      .subscribe((equipment) => {
        if (!equipment) {
          this.qrLookupError.set(
            `Nenhum equipamento encontrado para "${term}". Verifique o QR Code ou código informado.`
          );
          return;
        }
        if (!equipment.active) {
          this.qrLookupError.set(
            `Equipamento "${equipment.name}" (${equipment.qrCode}) está inativo/descomissionado e não pode ser agendado.`
          );
          return;
        }
        this.applyEquipmentHierarchy(equipment);
      });
  }

  onFieldInput(controlName: string): void {
    clearServerError(this.form, controlName);
    this.formError.set(null);
  }

  invalid(controlName: string): boolean {
    return isControlInvalid(this.form, controlName, this.submitted());
  }

  categoryLabel(category: string | null | undefined): string {
    return getCategoryLabel(category);
  }

  priorityLabel(priority: InspectionPriority): string {
    return getInspectionPriorityLabel(priority);
  }

  submit(): void {
    this.submitted.set(true);
    this.formError.set(null);

    if (this.form.invalid || this.saving() || this.loadingInitial()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const scheduledIso = combineDateAndTimeToIso(raw.scheduledDate, raw.scheduledTime);
    if (!scheduledIso) {
      this.form.controls.scheduledDate.setErrors({ invalidDate: true });
      this.form.markAllAsTouched();
      return;
    }

    const payload: ScheduleInspectionRequest = {
      clientId: raw.clientId,
      siteId: raw.siteId,
      equipmentId: normalizeOptionalText(raw.equipmentId),
      templateId: raw.templateId,
      templateVersionId: normalizeOptionalText(raw.templateVersionId),
      technicianId: raw.technicianId,
      scheduledFor: scheduledIso,
      priority: raw.priority,
      title: normalizeOptionalText(raw.title),
      instructions: normalizeOptionalText(raw.instructions),
    };

    this.saving.set(true);
    this.inspectionService
      .schedule(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (created) => {
          this.notifications.showSuccess(
            `Inspeção "${created.title}" agendada e atribuída a ${created.technicianName} (${created.totalItems} itens em snapshot).`
          );
          void this.router.navigate(['/app/inspections']);
        },
        error: (err: unknown) => {
          if (err instanceof InspectionApiError) {
            this.formError.set(err.message);
            applyServerFieldErrors(this.form, err, {
              INACTIVE_CLIENT: 'clientId',
              INACTIVE_SITE: 'siteId',
              INCOMPATIBLE_SITE_CLIENT: 'siteId',
              INACTIVE_EQUIPMENT: 'equipmentId',
              INCOMPATIBLE_EQUIPMENT_SITE: 'equipmentId',
              INVALID_TECHNICIAN_ROLE: 'technicianId',
              INACTIVE_TECHNICIAN: 'technicianId',
              TEMPLATE_REQUIRED: 'templateId',
              TEMPLATE_VERSION_NOT_PUBLISHED: 'templateVersionId',
              INACTIVE_TEMPLATE: 'templateId',
              SCHEDULED_FOR_REQUIRED: 'scheduledDate',
              INVALID_DATE_FORMAT: 'scheduledDate',
            });
            return;
          }
          this.formError.set('Não foi possível agendar a inspeção. Tente novamente.');
        },
      });
  }

  private setupCascadingValueChanges(): void {
    this.form.controls.clientId.valueChanges
      .pipe(
        tap(() => {
          clearServerError(this.form, 'clientId');
          clearServerError(this.form, 'siteId');
          clearServerError(this.form, 'equipmentId');
          this.formError.set(null);
          this.form.controls.siteId.setValue('', { emitEvent: false });
          this.form.controls.equipmentId.setValue('', { emitEvent: false });
          this.sites.set([]);
          this.equipments.set([]);
          this.formVersionSnapshot.update((v) => v + 1);
        }),
        switchMap((clientId) => {
          if (!clientId) {
            this.loadingSites.set(false);
            return of([] as SiteResponse[]);
          }
          this.loadingSites.set(true);
          return this.sitesApi.listByClient(clientId, true, 200).pipe(
            catchError(() => {
              this.formError.set('Não foi possível carregar os locais do cliente selecionado.');
              return of([] as SiteResponse[]);
            }),
            finalize(() => this.loadingSites.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((sites) => {
        const activeSites = sites.filter((s) => s.active);
        this.sites.set(activeSites);

        const targetSiteId = this.pendingPrefillSiteId;
        this.pendingPrefillSiteId = null;
        if (targetSiteId && activeSites.some((s) => s.id === targetSiteId)) {
          this.form.controls.siteId.setValue(targetSiteId);
        }
      });

    this.form.controls.siteId.valueChanges
      .pipe(
        tap(() => {
          clearServerError(this.form, 'siteId');
          clearServerError(this.form, 'equipmentId');
          this.formError.set(null);
          this.form.controls.equipmentId.setValue('', { emitEvent: false });
          this.equipments.set([]);
          this.formVersionSnapshot.update((v) => v + 1);
        }),
        switchMap((siteId) => {
          if (!siteId) {
            this.loadingEquipments.set(false);
            return of([] as EquipmentResponse[]);
          }
          this.loadingEquipments.set(true);
          return this.equipmentApi
            .list({ siteId, active: true, page: 0, size: 200, sort: 'name,asc' })
            .pipe(
              switchMap((page) => of(page.content.filter((eq) => eq.active))),
              catchError(() => {
                this.formError.set('Não foi possível carregar os equipamentos do local selecionado.');
                return of([] as EquipmentResponse[]);
              }),
              finalize(() => this.loadingEquipments.set(false))
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((equipments) => {
        this.equipments.set(equipments);

        const targetEquipmentId = this.pendingPrefillEquipmentId;
        this.pendingPrefillEquipmentId = null;
        if (targetEquipmentId && equipments.some((eq) => eq.id === targetEquipmentId)) {
          this.form.controls.equipmentId.setValue(targetEquipmentId);
        }
      });

    this.form.controls.templateId.valueChanges
      .pipe(
        tap(() => {
          clearServerError(this.form, 'templateId');
          clearServerError(this.form, 'templateVersionId');
          this.formError.set(null);
          this.form.controls.templateVersionId.setValue('', { emitEvent: false });
          this.publishedVersions.set([]);
          this.formVersionSnapshot.update((v) => v + 1);
        }),
        switchMap((templateId) => {
          if (!templateId) {
            this.loadingVersions.set(false);
            return of([] as TemplateVersionResponse[]);
          }
          this.loadingVersions.set(true);
          return this.templateService.listVersions(templateId).pipe(
            catchError(() => {
              this.formError.set('Não foi possível carregar as versões publicadas do modelo.');
              return of([] as TemplateVersionResponse[]);
            }),
            finalize(() => this.loadingVersions.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((versions) => {
        const published = versions
          .filter((v) => v.status === 'PUBLISHED')
          .sort((a, b) => b.versionNumber - a.versionNumber);
        this.publishedVersions.set(published);

        const preferred =
          published.find((v) => v.activeForNewInspections) ?? published[0] ?? null;
        if (preferred) {
          this.form.controls.templateVersionId.setValue(preferred.id);
        }
      });
  }

  private applyEquipmentHierarchy(equipment: EquipmentResponse): void {
    const clientExists = this.clients().some((c) => c.id === equipment.clientId);
    if (!clientExists) {
      this.qrLookupError.set(
        `O cliente "${equipment.clientName}" deste equipamento está inativo e não pode ser selecionado.`
      );
      return;
    }

    const currentClientId = this.form.controls.clientId.value;
    const currentSiteId = this.form.controls.siteId.value;

    if (currentClientId !== equipment.clientId) {
      this.pendingPrefillSiteId = equipment.siteId;
      this.pendingPrefillEquipmentId = equipment.id;
      this.form.controls.clientId.setValue(equipment.clientId);
    } else if (currentSiteId !== equipment.siteId) {
      this.pendingPrefillEquipmentId = equipment.id;
      this.form.controls.siteId.setValue(equipment.siteId);
    } else {
      this.form.controls.equipmentId.setValue(equipment.id);
    }

    this.qrLookupMessage.set(
      `Equipamento localizado: ${equipment.name} (${equipment.qrCode}) — ${equipment.clientName} / ${equipment.siteName}.`
    );
  }
}

function defaultScheduleDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function combineDateAndTimeToIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) {
    return null;
  }
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const parsed = new Date(`${dateStr}T${normalizedTime}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}
