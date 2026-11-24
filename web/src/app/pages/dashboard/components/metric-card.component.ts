import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type MetricCardTone = 'teal' | 'orange' | 'amber' | 'red' | 'green' | 'blue';
export type MetricCardIcon = 'total' | 'in-progress' | 'awaiting-review' | 'overdue';

/**
 * Card reutilizável de indicador operacional com gradiente, ícone vetorial e skeleton loader (TASK-021).
 */
@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loading) {
      <article
        class="metric-card metric-skeleton"
        [attr.data-testid]="testId + '-skeleton'"
        aria-busy="true"
        aria-label="Carregando métrica"
      >
        <div class="sk-row sk-label"></div>
        <div class="sk-row sk-value"></div>
        <div class="sk-row sk-sub"></div>
      </article>
    } @else {
      <article
        class="metric-card"
        [ngClass]="['tone-' + tone, clickable ? 'is-clickable' : '']"
        [attr.role]="clickable ? 'button' : null"
        [attr.tabindex]="clickable ? 0 : null"
        [attr.data-testid]="testId"
        (click)="handleActivate()"
        (keydown.enter)="handleActivate()"
        (keydown.space)="onSpaceKey($event)"
      >
        <div class="metric-top">
          <div class="metric-heading">
            <span class="metric-label">{{ label }}</span>
            @if (badgeText) {
              <span class="metric-badge">{{ badgeText }}</span>
            }
          </div>

          <span class="metric-icon" aria-hidden="true">
            @switch (icon) {
              @case ('total') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="8" y="2" width="8" height="4" rx="1" />
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
              }
              @case ('in-progress') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              }
              @case ('awaiting-review') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              }
              @case ('overdue') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m10.29 3.86-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.71-3.14l-8-14a2 2 0 0 0-3.42 0Z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
              }
            }
          </span>
        </div>

        <strong class="metric-value" data-testid="metric-card-value">{{ value }}</strong>

        <div class="metric-footer">
          <span class="metric-subtitle">{{ subtitle }}</span>
          @if (clickable) {
            <span class="metric-action-hint">Ver lista →</span>
          }
        </div>
      </article>
    }
  `,
  styles: [
    `
      .metric-card {
        position: relative;
        overflow: hidden;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        border: 1px solid #e2e8f0;
        border-radius: 0.95rem;
        padding: 1.15rem 1.2rem 1.05rem;
        display: grid;
        gap: 0.65rem;
        box-shadow: 0 4px 14px -8px rgba(15, 23, 42, 0.14);
        transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #0f766e, #14b8a6);
        }
      }

      .metric-card.is-clickable {
        cursor: pointer;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px -12px rgba(15, 23, 42, 0.25);
          border-color: #94a3b8;
        }

        &:focus-visible {
          outline: 2px solid #0f766e;
          outline-offset: 2px;
        }
      }

      .metric-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .metric-heading {
        display: grid;
        gap: 0.3rem;
      }

      .metric-label {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #475569;
      }

      .metric-badge {
        display: inline-flex;
        width: fit-content;
        padding: 0.14rem 0.5rem;
        border-radius: 999px;
        font-size: 0.71rem;
        font-weight: 700;
        background: #f1f5f9;
        color: #334155;
      }

      .metric-icon {
        width: 38px;
        height: 38px;
        border-radius: 0.7rem;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        background: #f0fdfa;
        color: #0f766e;

        svg {
          width: 20px;
          height: 20px;
        }
      }

      .metric-value {
        font-size: 2.05rem;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
        color: #0f172a;
      }

      .metric-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.79rem;
      }

      .metric-subtitle {
        color: #64748b;
      }

      .metric-action-hint {
        font-weight: 700;
        color: #0f766e;
        white-space: nowrap;
      }

      .tone-orange::before {
        background: linear-gradient(90deg, #ea580c, #fb923c);
      }
      .tone-orange .metric-icon {
        background: #fff7ed;
        color: #c2410c;
      }

      .tone-amber::before {
        background: linear-gradient(90deg, #d97706, #facc15);
      }
      .tone-amber .metric-icon {
        background: #fefce8;
        color: #a16207;
      }

      .tone-red::before {
        background: linear-gradient(90deg, #dc2626, #f87171);
      }
      .tone-red .metric-icon {
        background: #fef2f2;
        color: #b91c1c;
      }
      .tone-red .metric-badge {
        background: #fef2f2;
        color: #b91c1c;
      }

      .tone-green::before {
        background: linear-gradient(90deg, #059669, #34d399);
      }
      .tone-green .metric-icon {
        background: #ecfdf5;
        color: #047857;
      }

      .tone-blue::before {
        background: linear-gradient(90deg, #0284c7, #38bdf8);
      }
      .tone-blue .metric-icon {
        background: #eff6ff;
        color: #1d4ed8;
      }

      .metric-skeleton {
        min-height: 144px;
      }

      .sk-row {
        border-radius: 0.45rem;
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%;
        animation: cardShimmer 1.2s infinite;
      }

      .sk-label {
        width: 58%;
        height: 14px;
      }
      .sk-value {
        width: 34%;
        height: 32px;
      }
      .sk-sub {
        width: 78%;
        height: 13px;
      }

      @keyframes cardShimmer {
        to {
          background-position: -200% 0;
        }
      }
    `,
  ],
})
export class MetricCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value = 0;
  @Input() subtitle = '';
  @Input() badgeText: string | null = null;
  @Input() tone: MetricCardTone = 'teal';
  @Input() icon: MetricCardIcon = 'total';
  @Input() loading = false;
  @Input() clickable = true;
  @Input() testId = 'metric-card';

  @Output() cardClick = new EventEmitter<void>();

  handleActivate(): void {
    if (this.clickable && !this.loading) {
      this.cardClick.emit();
    }
  }

  onSpaceKey(event: Event): void {
    if (this.clickable && !this.loading) {
      event.preventDefault();
      this.cardClick.emit();
    }
  }
}
