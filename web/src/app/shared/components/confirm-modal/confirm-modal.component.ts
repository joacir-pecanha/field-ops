import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Modal reutilizável de confirmação para ações críticas de inativação/bloqueio
 * (TASK-008 Passo 5 — DoD 18.3, RN-013, RN-088, EX-01, CA-04).
 */
@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div
        class="modal-backdrop"
        (click)="onBackdropClick()"
        data-testid="confirm-modal-backdrop"
      >
        <div
          class="modal-card confirm-modal-card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-description"
          (click)="$event.stopPropagation()"
          data-testid="confirm-modal"
        >
          <header class="modal-header">
            <div class="modal-title-group">
              <span class="modal-danger-badge" aria-hidden="true">!</span>
              <div>
                <h2 id="confirm-modal-title">{{ title }}</h2>
                @if (entityLabel) {
                  <p class="modal-entity-subtitle">{{ entityLabel }}</p>
                }
              </div>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              [disabled]="loading"
              (click)="onCancel()"
              aria-label="Fechar modal de confirmação"
            >
              Fechar
            </button>
          </header>

          <div class="modal-body" id="confirm-modal-description">
            <p class="confirm-message">{{ message }}</p>

            @if (impactWarning) {
              <div class="alert-banner alert-warning" role="note">
                <div>
                  <strong>Impacto operacional (RN-013 / RN-088)</strong>
                  <p>{{ impactWarning }}</p>
                </div>
              </div>
            }

            @if (alertBannerText) {
              <div class="alert-banner alert-error" role="alert" data-testid="confirm-modal-alert-banner">
                <div>
                  <strong>Atenção aos vínculos ativos (EX-01)</strong>
                  <p>{{ alertBannerText }}</p>
                </div>
              </div>
            }

            @if (requireExtraConfirmation) {
              <label class="extra-confirm-check">
                <input
                  type="checkbox"
                  [(ngModel)]="extraConfirmed"
                  [disabled]="loading"
                  data-testid="confirm-modal-extra-checkbox"
                />
                <span>{{ extraConfirmationLabel }}</span>
              </label>
            }
          </div>

          <footer class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              [disabled]="loading"
              (click)="onCancel()"
              data-testid="confirm-modal-cancel-btn"
            >
              {{ cancelLabel }}
            </button>
            <button
              type="button"
              class="btn btn-danger"
              [disabled]="loading || (requireExtraConfirmation && !extraConfirmed())"
              (click)="onConfirm()"
              data-testid="confirm-modal-confirm-btn"
            >
              @if (loading) {
                <span class="inline-spinner" aria-hidden="true"></span>
                <span>Processando...</span>
              } @else {
                <span>{{ confirmLabel }}</span>
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .confirm-modal-card {
        max-width: 540px;
      }

      .modal-title-group {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .modal-danger-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fecaca;
        font-weight: 800;
        font-size: 1rem;
        flex-shrink: 0;
      }

      .modal-entity-subtitle {
        margin: 0.15rem 0 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: #475569;
      }

      .confirm-message {
        margin: 0;
        font-size: 0.94rem;
        line-height: 1.5;
        color: #1e293b;
      }

      .extra-confirm-check {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        padding: 0.85rem 0.95rem;
        border-radius: 0.65rem;
        background: #fff1f2;
        border: 1px solid #fda4af;
        color: #881337;
        font-size: 0.85rem;
        font-weight: 600;
        line-height: 1.45;
        cursor: pointer;

        input[type='checkbox'] {
          margin-top: 0.15rem;
          width: 1rem;
          height: 1rem;
          accent-color: #dc2626;
          flex-shrink: 0;
        }
      }
    `,
  ],
})
export class ConfirmModalComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Confirmar Inativação';
  @Input() entityLabel = '';
  @Input() message = '';
  @Input() impactWarning =
    'Registros inativados ficam impedidos de ser vinculados a novas inspeções, preservando integralmente o histórico e a auditoria (RN-013, RN-088).';
  @Input() alertBannerText: string | null = null;
  @Input() requireExtraConfirmation = false;
  @Input() extraConfirmationLabel =
    'Estou ciente de que este cliente pode possuir locais ou inspeções ativas em andamento e confirmo sua inativação para novos agendamentos (EX-01).';
  @Input() confirmLabel = 'Confirmar Inativação';
  @Input() cancelLabel = 'Cancelar';
  @Input() loading = false;

  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly extraConfirmed = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['entityLabel'] || changes['requireExtraConfirmation']) {
      this.extraConfirmed.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.open && !this.loading) {
      this.onCancel();
    }
  }

  onBackdropClick(): void {
    if (!this.loading) {
      this.onCancel();
    }
  }

  onCancel(): void {
    if (this.loading) {
      return;
    }
    this.extraConfirmed.set(false);
    this.cancelled.emit();
  }

  onConfirm(): void {
    if (this.loading || (this.requireExtraConfirmation && !this.extraConfirmed())) {
      return;
    }
    this.confirmed.emit();
  }
}

