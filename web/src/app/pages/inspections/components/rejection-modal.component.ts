import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  InspectionDetailsResponse,
  canSubmitInspectionVerdict,
} from '../inspection.service';

export interface RejectionModalPayload {
  rejection_reason: string;
  comments?: string | null;
}

export interface ApprovalModalPayload {
  comments: string | null;
}

/**
 * Modal de reprovação técnica com validação estrita de motivo obrigatório (RF-07, RN-080, EX-01, CA-04).
 */
@Component({
  selector: 'app-rejection-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (open && inspection) {
      <div class="modal-backdrop" role="presentation" (click)="close()">
        <section
          class="modal-card modal-card-compact"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-inspection-modal-title"
          (click)="$event.stopPropagation()"
          data-testid="rejection-modal"
        >
          <header class="modal-header">
            <h2 id="reject-inspection-modal-title">Reprovar Inspeção</h2>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="close()"
              [disabled]="loading"
              aria-label="Fechar modal de reprovação"
              data-testid="reject-modal-close-btn"
            >
              ✕
            </button>
          </header>

          <form (ngSubmit)="confirm()" novalidate>
            <div class="modal-body">
              <div class="target-pill">
                <strong>{{ inspection.title }}</strong>
                <div class="cell-secondary">
                  {{ inspection.clientName || '—' }} • {{ inspection.siteName || '—' }} • Técnico:
                  {{ inspection.technicianName || '—' }}
                </div>
              </div>

              @if (!canRejectCurrent()) {
                <div
                  class="alert-banner alert-warning"
                  role="alert"
                  data-testid="reject-blocked-status-banner"
                >
                  <div>
                    <strong>Reprovação indisponível</strong>
                    <p>
                      @if (inspection.status === 'APROVADA') {
                        Esta inspeção já foi aprovada e encontra-se bloqueada contra alterações
                        comuns (RT-03, RN-082).
                      } @else if (inspection.status === 'CANCELADA') {
                        Esta inspeção encontra-se cancelada e não aceita vereditos de revisão (RT-03).
                      } @else {
                        A inspeção precisa estar no estado ENVIADA ou EM_REVISÃO para ser reprovada.
                      }
                    </p>
                  </div>
                </div>
              }

              @if (errorMessage) {
                <div class="alert-banner alert-error" role="alert" data-testid="reject-modal-error">
                  <div>
                    <strong>Não foi possível reprovar</strong>
                    <p>{{ errorMessage }}</p>
                  </div>
                </div>
              }

              <div class="form-field">
                <label for="reject-reason-input">Motivo da recusa *</label>
                <textarea
                  id="reject-reason-input"
                  name="rejectionReason"
                  rows="3"
                  maxlength="2000"
                  [formControl]="reasonControl"
                  [class.input-invalid]="showReasonError()"
                  placeholder="Descreva objetivamente o que precisa ser corrigido pelo técnico em campo..."
                  data-testid="reject-reason-input"
                ></textarea>
                @if (showReasonError()) {
                  <span class="field-error" data-testid="reject-reason-error">
                    @if (reasonControl.hasError('maxlength')) {
                      O motivo da reprovação deve ter no máximo 2000 caracteres.
                    } @else {
                      O motivo da reprovação é obrigatório (EX-01).
                    }
                  </span>
                }
                <span class="field-hint">
                  Este motivo será exibido ao técnico no aplicativo móvel para correção (RN-080).
                </span>
              </div>

              <div class="form-field">
                <label for="reject-comments-input">Observações adicionais (opcional)</label>
                <textarea
                  id="reject-comments-input"
                  name="rejectComments"
                  rows="2"
                  maxlength="2000"
                  [formControl]="commentsControl"
                  placeholder="Orientações complementares ao técnico..."
                  data-testid="reject-comments-input"
                ></textarea>
              </div>
            </div>

            <footer class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                (click)="close()"
                [disabled]="loading"
                data-testid="reject-modal-cancel-btn"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="btn btn-danger"
                [disabled]="loading || !canRejectCurrent() || !isValidReason()"
                data-testid="confirm-reject-inspection-btn"
              >
                @if (loading) {
                  <span class="inline-spinner"></span>
                  <span>Reprovando...</span>
                } @else {
                  <span>Confirmar Reprovação</span>
                }
              </button>
            </footer>
          </form>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .modal-card-compact {
        max-width: 540px;
      }

      .target-pill {
        padding: 0.55rem 0.75rem;
        border-radius: 0.55rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        font-size: 0.86rem;
        color: #1e293b;
      }
    `,
  ],
})
export class RejectionModalComponent implements OnChanges {
  @Input() open = false;
  @Input() inspection: InspectionDetailsResponse | null = null;
  @Input() loading = false;
  @Input() errorMessage: string | null = null;

  @Output() readonly confirmed = new EventEmitter<RejectionModalPayload>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });

  readonly commentsControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(2000)],
  });

  submitted = false;

  ngOnChanges(changes: SimpleChanges): void {
    const openChanged = Boolean(changes['open']);
    const prevId = (changes['inspection']?.previousValue as InspectionDetailsResponse | null)?.id;
    const currId = (changes['inspection']?.currentValue as InspectionDetailsResponse | null)?.id;
    if (openChanged || (Boolean(changes['inspection']) && prevId !== currId)) {
      this.reasonControl.reset('');
      this.commentsControl.reset('');
      this.submitted = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.open && !this.loading) {
      this.close();
    }
  }

  canRejectCurrent(): boolean {
    return Boolean(this.inspection && canSubmitInspectionVerdict(this.inspection.status));
  }

  trimmedReason(): string {
    return this.reasonControl.value.trim();
  }

  isValidReason(): boolean {
    return this.trimmedReason().length > 0 && !this.reasonControl.hasError('maxlength');
  }

  showReasonError(): boolean {
    return (this.submitted || this.reasonControl.touched) && !this.isValidReason();
  }

  confirm(): void {
    this.submitted = true;
    this.reasonControl.markAsTouched();
    if (this.loading || !this.canRejectCurrent() || !this.isValidReason()) {
      return;
    }
    const comments = this.commentsControl.value.trim();
    this.confirmed.emit({
      rejection_reason: this.trimmedReason(),
      comments: comments.length > 0 ? comments : null,
    });
  }

  close(): void {
    if (this.loading) {
      return;
    }
    this.cancelled.emit();
  }
}

/**
 * Modal de confirmação de aprovação técnica com campo opcional de parecer (RF-06, RN-081, CA-03).
 */
@Component({
  selector: 'app-approval-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (open && inspection) {
      <div class="modal-backdrop" role="presentation" (click)="close()">
        <section
          class="modal-card modal-card-compact"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-inspection-modal-title"
          (click)="$event.stopPropagation()"
          data-testid="approval-modal"
        >
          <header class="modal-header">
            <h2 id="approve-inspection-modal-title">Aprovar Inspeção</h2>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="close()"
              [disabled]="loading"
              aria-label="Fechar modal de aprovação"
              data-testid="approve-modal-close-btn"
            >
              ✕
            </button>
          </header>

          <form (ngSubmit)="confirm()" novalidate>
            <div class="modal-body">
              <div class="target-pill">
                <strong>{{ inspection.title }}</strong>
                <div class="cell-secondary">
                  {{ inspection.clientName || '—' }} • {{ inspection.siteName || '—' }} • Técnico:
                  {{ inspection.technicianName || '—' }}
                </div>
              </div>

              @if (!canApproveCurrent()) {
                <div
                  class="alert-banner alert-warning"
                  role="alert"
                  data-testid="approve-blocked-status-banner"
                >
                  <div>
                    <strong>Aprovação indisponível</strong>
                    <p>
                      @if (inspection.status === 'APROVADA') {
                        Esta inspeção já se encontra aprovada (RT-03).
                      } @else if (inspection.status === 'CANCELADA') {
                        Esta inspeção encontra-se cancelada (RT-03).
                      } @else {
                        A inspeção precisa estar no estado ENVIADA ou EM_REVISÃO para ser aprovada.
                      }
                    </p>
                  </div>
                </div>
              } @else {
                <div class="alert-banner alert-info" role="note">
                  <div>
                    <strong>Bloqueio após aprovação (RN-082)</strong>
                    <p>
                      Ao aprovar, as respostas e evidências desta inspeção serão bloqueadas contra
                      alterações comuns e a decisão será registrada na auditoria.
                    </p>
                  </div>
                </div>
              }

              @if (errorMessage) {
                <div class="alert-banner alert-error" role="alert" data-testid="approve-modal-error">
                  <div>
                    <strong>Não foi possível aprovar</strong>
                    <p>{{ errorMessage }}</p>
                  </div>
                </div>
              }

              <div class="form-field">
                <label for="approve-comments-input">Parecer técnico (opcional)</label>
                <textarea
                  id="approve-comments-input"
                  name="approveComments"
                  rows="3"
                  maxlength="2000"
                  [formControl]="commentsControl"
                  placeholder="Registre observações técnicas ou validações finais (opcional)..."
                  data-testid="approve-comments-input"
                ></textarea>
                @if (commentsControl.hasError('maxlength')) {
                  <span class="field-error">
                    O parecer técnico deve ter no máximo 2000 caracteres.
                  </span>
                }
              </div>
            </div>

            <footer class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                (click)="close()"
                [disabled]="loading"
                data-testid="approve-modal-cancel-btn"
              >
                Voltar
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="loading || !canApproveCurrent() || commentsControl.invalid"
                data-testid="confirm-approve-inspection-btn"
              >
                @if (loading) {
                  <span class="inline-spinner"></span>
                  <span>Aprovando...</span>
                } @else {
                  <span>Confirmar Aprovação</span>
                }
              </button>
            </footer>
          </form>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .modal-card-compact {
        max-width: 540px;
      }

      .target-pill {
        padding: 0.55rem 0.75rem;
        border-radius: 0.55rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        font-size: 0.86rem;
        color: #1e293b;
      }
    `,
  ],
})
export class ApprovalModalComponent implements OnChanges {
  @Input() open = false;
  @Input() inspection: InspectionDetailsResponse | null = null;
  @Input() loading = false;
  @Input() errorMessage: string | null = null;

  @Output() readonly confirmed = new EventEmitter<ApprovalModalPayload>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly commentsControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(2000)],
  });

  ngOnChanges(changes: SimpleChanges): void {
    const openChanged = Boolean(changes['open']);
    const prevId = (changes['inspection']?.previousValue as InspectionDetailsResponse | null)?.id;
    const currId = (changes['inspection']?.currentValue as InspectionDetailsResponse | null)?.id;
    if (openChanged || (Boolean(changes['inspection']) && prevId !== currId)) {
      this.commentsControl.reset('');
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.open && !this.loading) {
      this.close();
    }
  }

  canApproveCurrent(): boolean {
    return Boolean(this.inspection && canSubmitInspectionVerdict(this.inspection.status));
  }

  confirm(): void {
    if (this.loading || !this.canApproveCurrent() || this.commentsControl.invalid) {
      return;
    }
    const comments = this.commentsControl.value.trim();
    this.confirmed.emit({
      comments: comments.length > 0 ? comments : null,
    });
  }

  close(): void {
    if (this.loading) {
      return;
    }
    this.cancelled.emit();
  }
}
