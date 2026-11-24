import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { NotificationService } from '../../core/services/notification.service';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  ChecklistEvidenceSelection,
  ChecklistReviewTreeComponent,
} from './components/checklist-review-tree.component';
import { EvidenceLightboxComponent } from './components/evidence-lightbox.component';
import { LocationMapComponent } from './components/location-map.component';
import {
  ApprovalModalComponent,
  ApprovalModalPayload,
  RejectionModalComponent,
  RejectionModalPayload,
} from './components/rejection-modal.component';
import { StatusBadgeComponent } from './components/status-badge.component';
import {
  AuditLogResponse,
  InspectionApiError,
  InspectionDetailsResponse,
  InspectionEvidenceDto,
  InspectionNonConformityDto,
  InspectionReviewDecision,
  InspectionService,
  canStartInspectionReview,
  canSubmitInspectionVerdict,
  getInspectionPriorityLabel,
  getNonConformitySeverityLabel,
  getNonConformitySeverityTone,
  isInspectionActionLocked,
  resolveEvidenceFileName,
  resolveEvidenceId,
  resolveEvidenceNonConformityId,
  getEvidenceImageUrl,
  sortNonConformitiesBySeverity,
} from './inspection.service';

/**
 * Tela principal de Revisão Técnica, Visualização de Evidências, Não Conformidades,
 * Localização Geográfica e Emissão de Veredito (Aprovação / Reprovação) (TASK-020).
 */
@Component({
  selector: 'app-inspection-review',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    StatusBadgeComponent,
    ChecklistReviewTreeComponent,
    EvidenceLightboxComponent,
    LocationMapComponent,
    RejectionModalComponent,
    ApprovalModalComponent,
  ],
  templateUrl: './inspection-review.component.html',
  styles: [
    `
      .review-layout {
        display: grid;
        gap: 1.1rem;
        align-items: start;
      }

      @media (min-width: 1024px) {
        .review-layout {
          grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
        }
      }

      .review-col {
        display: grid;
        gap: 1.1rem;
        min-width: 0;
      }

      .review-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.85rem;
        padding: 1.05rem 1.15rem;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
        display: grid;
        gap: 0.85rem;
      }

      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;

        h2 {
          margin: 0;
          font-size: 1.02rem;
          color: #0f172a;
        }
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(195px, 1fr));
        gap: 0.75rem;
        padding: 0.85rem;
        border-radius: 0.65rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }

      .meta-item {
        display: grid;
        gap: 0.14rem;

        span {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }

        strong {
          font-size: 0.88rem;
          color: #0f172a;
          word-break: break-word;
        }
      }

      .stats-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 0.65rem;
      }

      .stat-box {
        padding: 0.65rem 0.8rem;
        border-radius: 0.6rem;
        border: 1px solid #e2e8f0;
        background: #f8fafc;

        span {
          display: block;
          font-size: 0.74rem;
          color: #64748b;
          font-weight: 600;
        }

        strong {
          font-size: 1.08rem;
          color: #0f172a;
        }
      }

      .nc-card {
        border: 1px solid #fecaca;
        border-left: 4px solid #dc2626;
        border-radius: 0.7rem;
        padding: 0.85rem;
        background: #fffafa;
        display: grid;
        gap: 0.45rem;
      }

      .nc-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .nc-thumbs-row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .nc-thumb-btn {
        width: 82px;
        height: 62px;
        padding: 0;
        border-radius: 0.45rem;
        border: 1px solid #cbd5e1;
        overflow: hidden;
        background: #f8fafc;
        cursor: pointer;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      }

      .nc-thumb-fallback {
        width: 82px;
        height: 62px;
        border-radius: 0.45rem;
        border: 1px dashed #cbd5e1;
        background: #f8fafc;
        display: grid;
        place-items: center;
        font-size: 0.66rem;
        color: #64748b;
        text-align: center;
        padding: 0.25rem;
      }

      .timeline-list {
        display: grid;
        gap: 0.55rem;
      }

      .timeline-row {
        padding: 0.6rem 0.75rem;
        border-left: 3px solid #0f766e;
        background: #f8fafc;
        border-radius: 0 0.45rem 0.45rem 0;
        font-size: 0.83rem;
        display: grid;
        gap: 0.2rem;
      }
    `,
  ],
})
export class InspectionReviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly inspectionService = inject(InspectionService);
  private readonly dashboardService = inject(DashboardService, { optional: true });
  private readonly notifications = inject(NotificationService);

  private readonly objectUrls: string[] = [];
  private inspectionId = '';

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly inspection = signal<InspectionDetailsResponse | null>(null);
  readonly auditLogs = signal<AuditLogResponse[]>([]);

  readonly actionSaving = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly approveModalOpen = signal(false);
  readonly rejectModalOpen = signal(false);
  readonly modalError = signal<string | null>(null);

  readonly lightboxOpen = signal(false);
  readonly lightboxEvidences = signal<InspectionEvidenceDto[]>([]);
  readonly lightboxIndex = signal(0);

  readonly resolvedEvidenceUrls = signal<Record<string, string>>({});
  readonly loadingEvidenceIds = signal<Record<string, boolean>>({});
  readonly failedEvidenceIds = signal<Record<string, boolean>>({});
  private readonly inlineThumbErrors = signal<Record<string, boolean>>({});

  readonly sortedNonConformities = computed(() =>
    sortNonConformitiesBySeverity(this.inspection()?.nonConformities ?? [])
  );

  readonly actionsLocked = computed(() => isInspectionActionLocked(this.inspection()?.status));
  readonly canStartReview = computed(() => canStartInspectionReview(this.inspection()?.status));
  readonly canSubmitVerdict = computed(() =>
    canSubmitInspectionVerdict(this.inspection()?.status)
  );

  readonly answeredCount = computed(() => {
    const detail = this.inspection();
    if (!detail) {
      return 0;
    }
    return (detail.responses ?? []).filter(
      (resp) =>
        Boolean(resp.valueRaw?.trim()) ||
        Boolean(resp.valueText?.trim()) ||
        resp.valueNumber !== null ||
        resp.valueBoolean !== null ||
        Boolean(resp.valueDate) ||
        Boolean(resp.conformity)
    ).length;
  });

  readonly unlinkedEvidences = computed(() => {
    const detail = this.inspection();
    if (!detail) {
      return [];
    }
    const itemIds = new Set((detail.items ?? []).map((item) => item.id));
    const responseIds = new Set((detail.responses ?? []).map((resp) => resp.id));
    const ncIds = new Set((detail.nonConformities ?? []).map((nc) => nc.id));
    return (detail.evidences ?? []).filter((ev) => {
      const evItemId = ev.inspection_item_id ?? ev.inspectionItemId ?? null;
      const evRespId = ev.response_id ?? ev.responseId ?? null;
      const evNcId = resolveEvidenceNonConformityId(ev);
      const linkedToItem = evItemId ? itemIds.has(evItemId) : false;
      const linkedToResp = evRespId ? responseIds.has(evRespId) : false;
      const linkedToNc = evNcId ? ncIds.has(evNcId) : false;
      return !linkedToItem && !linkedToResp && !linkedToNc;
    });
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const url of this.objectUrls) {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(url);
        }
      }
      this.objectUrls.length = 0;
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('inspectionId') ?? '';
      if (!id) {
        this.loadError.set('Identificador da inspeção não informado na rota.');
        return;
      }
      this.inspectionId = id;
      this.loadReviewData();
    });
  }

  loadReviewData(): void {
    if (!this.inspectionId) {
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);

    const audit$ =
      typeof this.inspectionService.getAuditLogs === 'function'
        ? this.inspectionService
            .getAuditLogs(this.inspectionId)
            .pipe(catchError(() => of([] as AuditLogResponse[])))
        : of([] as AuditLogResponse[]);

    forkJoin({
      detail: this.inspectionService.getReviewDetails(this.inspectionId),
      audits: audit$,
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ detail, audits }) => {
          this.inspection.set(detail);
          this.auditLogs.set(audits);
          this.preloadEvidenceUrls(detail.evidences ?? []);
        },
        error: (err: unknown) => {
          const message =
            err instanceof InspectionApiError
              ? err.message
              : 'Não foi possível carregar os dados de revisão da inspeção.';
          this.loadError.set(message);
        },
      });
  }

  startReview(): void {
    const current = this.inspection();
    if (!current || !this.canStartReview() || this.actionSaving()) {
      return;
    }
    this.actionSaving.set(true);
    this.actionError.set(null);

    this.inspectionService
      .startReview(current.id)
      .pipe(finalize(() => this.actionSaving.set(false)))
      .subscribe({
        next: (updated) => {
          this.inspection.set(updated);
          this.dashboardService?.invalidateCache();
          this.notifications.showSuccess('Revisão técnica iniciada (EM_REVISÃO).');
          this.refreshAuditLogs();
        },
        error: (err: unknown) => {
          const message =
            err instanceof InspectionApiError
              ? err.message
              : 'Não foi possível iniciar a revisão da inspeção.';
          this.actionError.set(message);
          this.notifications.showError(message);
        },
      });
  }

  openApproveModal(): void {
    if (this.actionsLocked() || !this.canSubmitVerdict() || this.actionSaving()) {
      return;
    }
    this.modalError.set(null);
    this.approveModalOpen.set(true);
  }

  closeApproveModal(): void {
    if (this.actionSaving()) {
      return;
    }
    this.approveModalOpen.set(false);
    this.modalError.set(null);
  }

  confirmApprove(payload: ApprovalModalPayload): void {
    const current = this.inspection();
    if (!current || this.actionsLocked() || !this.canSubmitVerdict() || this.actionSaving()) {
      return;
    }
    this.actionSaving.set(true);
    this.modalError.set(null);

    this.inspectionService
      .approve(current.id, payload.comments ? { comments: payload.comments } : {})
      .pipe(finalize(() => this.actionSaving.set(false)))
      .subscribe({
        next: (updated) => {
          this.inspection.set(updated);
          this.approveModalOpen.set(false);
          this.dashboardService?.invalidateCache();
          this.notifications.showSuccess(
            `Inspeção "${updated.title}" aprovada e bloqueada para edições comuns.`
          );
          this.refreshAuditLogs();
        },
        error: (err: unknown) => {
          const message =
            err instanceof InspectionApiError
              ? err.message
              : 'Não foi possível aprovar a inspeção.';
          this.modalError.set(message);
        },
      });
  }

  openRejectModal(): void {
    if (this.actionsLocked() || !this.canSubmitVerdict() || this.actionSaving()) {
      return;
    }
    this.modalError.set(null);
    this.rejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    if (this.actionSaving()) {
      return;
    }
    this.rejectModalOpen.set(false);
    this.modalError.set(null);
  }

  confirmReject(payload: RejectionModalPayload): void {
    const current = this.inspection();
    if (!current || this.actionsLocked() || !this.canSubmitVerdict() || this.actionSaving()) {
      return;
    }
    const reason = payload.rejection_reason.trim();
    if (!reason) {
      this.modalError.set('O motivo da reprovação é obrigatório.');
      return;
    }

    this.actionSaving.set(true);
    this.modalError.set(null);

    this.inspectionService
      .reject(current.id, {
        rejection_reason: reason,
        comments: payload.comments ?? null,
      })
      .pipe(finalize(() => this.actionSaving.set(false)))
      .subscribe({
        next: (updated) => {
          this.inspection.set(updated);
          this.rejectModalOpen.set(false);
          this.dashboardService?.invalidateCache();
          this.notifications.showSuccess(
            `Inspeção "${updated.title}" reprovada e devolvida ao técnico.`
          );
          this.refreshAuditLogs();
        },
        error: (err: unknown) => {
          const message =
            err instanceof InspectionApiError
              ? err.message
              : 'Não foi possível reprovar a inspeção.';
          this.modalError.set(message);
        },
      });
  }

  openLightboxFromTree(selection: ChecklistEvidenceSelection): void {
    const all = this.inspection()?.evidences ?? [];
    const list = all.length > 0 ? all : selection.list;
    const targetId = resolveEvidenceId(selection.evidence);
    const idx = list.findIndex((ev) =>
      targetId ? resolveEvidenceId(ev) === targetId : ev === selection.evidence
    );
    this.lightboxEvidences.set(list);
    this.lightboxIndex.set(idx >= 0 ? idx : selection.index);
    this.lightboxOpen.set(true);
  }

  openEvidenceInLightbox(evidence: InspectionEvidenceDto): void {
    const all = this.inspection()?.evidences ?? [evidence];
    const list = all.length > 0 ? all : [evidence];
    const targetId = resolveEvidenceId(evidence);
    const idx = list.findIndex((ev) =>
      targetId ? resolveEvidenceId(ev) === targetId : ev === evidence
    );
    this.lightboxEvidences.set(list);
    this.lightboxIndex.set(idx >= 0 ? idx : 0);
    this.lightboxOpen.set(true);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }

  evidencesForNonConformity(nc: InspectionNonConformityDto): InspectionEvidenceDto[] {
    const evidences = this.inspection()?.evidences ?? [];
    return evidences.filter((ev) => {
      const evNcId = resolveEvidenceNonConformityId(ev);
      if (evNcId && evNcId === nc.id) {
        return true;
      }
      const evItemId = ev.inspection_item_id ?? ev.inspectionItemId ?? null;
      return Boolean(!evNcId && nc.inspectionItemId && evItemId === nc.inspectionItemId);
    });
  }

  evidenceSrc(ev: InspectionEvidenceDto): string {
    if (ev.url && ev.url.trim().length > 0) {
      return ev.url.trim();
    }
    const id = resolveEvidenceId(ev);
    if (id && this.resolvedEvidenceUrls()[id]) {
      return this.resolvedEvidenceUrls()[id];
    }
    if (id && this.loadingEvidenceIds()[id]) {
      return '';
    }
    return getEvidenceImageUrl(ev);
  }

  evidenceName(ev: InspectionEvidenceDto): string {
    return resolveEvidenceFileName(ev);
  }

  evidenceId(ev: InspectionEvidenceDto): string {
    return resolveEvidenceId(ev);
  }

  hasInlineThumbError(ev: InspectionEvidenceDto): boolean {
    const id = resolveEvidenceId(ev);
    if (id && (this.failedEvidenceIds()[id] || this.inlineThumbErrors()[id])) {
      return true;
    }
    if (id && this.loadingEvidenceIds()[id]) {
      return false;
    }
    return this.evidenceSrc(ev).length === 0;
  }

  onInlineThumbError(ev: InspectionEvidenceDto): void {
    const id = resolveEvidenceId(ev);
    if (!id) {
      return;
    }
    this.inlineThumbErrors.update((prev) => ({ ...prev, [id]: true }));
  }

  priorityLabel(priority: InspectionDetailsResponse['priority']): string {
    return getInspectionPriorityLabel(priority);
  }

  severityLabel(severity: string): string {
    return getNonConformitySeverityLabel(severity);
  }

  severityTone(severity: string): string {
    return getNonConformitySeverityTone(severity);
  }

  ncStatusLabel(status: string): string {
    switch (status) {
      case 'OPEN':
        return 'Aberta';
      case 'RESOLVED':
        return 'Resolvida';
      case 'CANCELED':
        return 'Cancelada';
      default:
        return status;
    }
  }

  reviewDecisionLabel(decision: InspectionReviewDecision): string {
    switch (decision) {
      case 'REVIEW_STARTED':
        return 'Revisão Iniciada';
      case 'APPROVED':
        return 'Aprovada';
      case 'REJECTED':
        return 'Reprovada';
      default:
        return decision;
    }
  }

  effectiveRejectionReason(detail: InspectionDetailsResponse): string | null {
    return detail.rejectionReason ?? detail.rejection_reason ?? null;
  }

  actionDisabledReason(detail: InspectionDetailsResponse): string {
    if (detail.status === 'APROVADA') {
      return 'Inspeção já aprovada e bloqueada para alterações comuns (RT-03).';
    }
    if (detail.status === 'CANCELADA') {
      return 'Inspeção cancelada não permite aprovação ou reprovação (RT-03).';
    }
    if (!this.canSubmitVerdict()) {
      return 'Disponível apenas para inspeções nos estados ENVIADA ou EM_REVISÃO.';
    }
    return '';
  }

  private refreshAuditLogs(): void {
    if (!this.inspectionId || typeof this.inspectionService.getAuditLogs !== 'function') {
      return;
    }
    this.inspectionService
      .getAuditLogs(this.inspectionId)
      .pipe(
        catchError(() => of(this.auditLogs())),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((logs) => this.auditLogs.set(logs));
  }

  private preloadEvidenceUrls(evidences: InspectionEvidenceDto[]): void {
    if (typeof this.inspectionService.getEvidenceBlob !== 'function') {
      return;
    }
    for (const ev of evidences) {
      const id = resolveEvidenceId(ev);
      if (!id || (ev.url && ev.url.trim().length > 0) || this.resolvedEvidenceUrls()[id]) {
        continue;
      }
      const blob$ = this.inspectionService.getEvidenceBlob(id);
      if (!blob$) {
        continue;
      }
      this.loadingEvidenceIds.update((prev) => ({ ...prev, [id]: true }));
      blob$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (blob) => {
          if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            const objectUrl = URL.createObjectURL(blob);
            this.objectUrls.push(objectUrl);
            this.resolvedEvidenceUrls.update((prev) => ({ ...prev, [id]: objectUrl }));
          }
          this.loadingEvidenceIds.update((prev) => ({ ...prev, [id]: false }));
        },
        error: () => {
          this.failedEvidenceIds.update((prev) => ({ ...prev, [id]: true }));
          this.loadingEvidenceIds.update((prev) => ({ ...prev, [id]: false }));
        },
      });
    }
  }
}
