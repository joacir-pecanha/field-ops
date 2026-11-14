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
import { InspectionDetailsResponse, canCancelInspection } from '../inspection.service';

/**
 * Modal obrigatório de cancelamento de inspeção com validação de justificativa (RF-07 / EX-02).
 */
@Component({
  selector: 'app-cancel-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (open && inspection) {
      <div class="modal-backdrop" role="presentation" (click)="close()">
        <section
          class="modal-card modal-card-compact"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-inspection-modal-title"
          (click)="$event.stopPropagation()"
          data-testid="cancel-inspection-modal"
        >
          <header class="modal-header">
            <h2 id="cancel-inspection-modal-title">Cancelar Inspeção</h2>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="close()"
              [disabled]="loading"
              aria-label="Fechar modal de cancelamento"
              data-testid="cancel-modal-close-btn"
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

              @if (!canCancelCurrent()) {
                <div
                  class="alert-banner alert-warning"
                  role="alert"
                  data-testid="cancel-blocked-status-banner"
                >
                  <div>
                    <strong>Cancelamento bloqueado</strong>
                    <p>
                      @if (inspection.status === 'APROVADA') {
                        Inspeções já aprovadas não podem ser canceladas (RN-030).
                      } @else {
                        Esta inspeção já se encontra cancelada.
                      }
                    </p>
                  </div>
                </div>
              }

              @if (errorMessage) {
                <div class="alert-banner alert-error" role="alert" data-testid="cancel-modal-error">
                  <div>
                    <strong>Não foi possível cancelar</strong>
                    <p>{{ errorMessage }}</p>
                  </div>
                </div>
              }

              <div class="form-field">
                <label for="cancel-reason-input">Justificativa do cancelamento *</label>
                <textarea
                  id="cancel-reason-input"
                  name="cancelReason"
                  rows="3"
                  maxlength="1000"
                  [formControl]="reasonControl"
                  [class.input-invalid]="showReasonError()"
                  placeholder="Descreva o motivo operacional do cancelamento (obrigatório)..."
                  data-testid="cancel-reason-input"
                ></textarea>
                @if (showReasonError()) {
                  <span class="field-error" data-testid="cancel-reason-error">
                    @if (reasonControl.hasError('maxlength')) {
                      A justificativa deve ter no máximo 1000 caracteres.
                    } @else {
                      Informe uma justificativa operacional válida para cancelar a inspeção.
                    }
                  </span>
                }
                <span class="field-hint">
                  A justificativa, o responsável e o horário serão registrados na trilha de
                  auditoria (RN-029).
                </span>
              </div>
            </div>

            <footer class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                (click)="close()"
                [disabled]="loading"
                data-testid="cancel-modal-back-btn"
              >
                Voltar
              </button>
              <button
                type="submit"
                class="btn btn-danger"
                [disabled]="loading || !canCancelCurrent() || !isValidReason()"
                data-testid="confirm-cancel-inspection-btn"
              >
                @if (loading) {
                  <span class="inline-spinner"></span>
                  <span>Cancelando...</span>
                } @else {
                  <span>Confirmar Cancelamento</span>
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
        max-width: 520px;
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
export class CancelModalComponent implements OnChanges {
  @Input() open = false;
  @Input() inspection: InspectionDetailsResponse | null = null;
  @Input() loading = false;
  @Input() errorMessage: string | null = null;

  @Output() readonly confirmed = new EventEmitter<string>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  submitted = false;

  ngOnChanges(changes: SimpleChanges): void {
    const openChanged = Boolean(changes['open']);
    const prevInspectionId = (changes['inspection']?.previousValue as InspectionDetailsResponse | null)
      ?.id;
    const currInspectionId = (changes['inspection']?.currentValue as InspectionDetailsResponse | null)
      ?.id;
    const inspectionTargetChanged =
      Boolean(changes['inspection']) && prevInspectionId !== currInspectionId;

    if (openChanged || inspectionTargetChanged) {
      this.reasonControl.reset('');
      this.submitted = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.open && !this.loading) {
      this.close();
    }
  }

  canCancelCurrent(): boolean {
    return Boolean(this.inspection && canCancelInspection(this.inspection.status));
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
    if (this.loading || !this.canCancelCurrent() || !this.isValidReason()) {
      return;
    }
    this.confirmed.emit(this.trimmedReason());
  }

  close(): void {
    if (this.loading) {
      return;
    }
    this.cancelled.emit();
  }
}
