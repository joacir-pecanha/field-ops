import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  InspectionStatus,
  InspectionStatusTone,
  getInspectionStatusLabel,
  getInspectionStatusTone,
} from '../inspection.service';

/**
 * Badge semântico reutilizável para os estados operacionais de inspeção (RT-03 / RF-06).
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="status-badge-group">
      <span
        class="status-pill"
        [ngClass]="'tone-' + tone()"
        [attr.data-status]="status"
        [attr.data-tone]="tone()"
        data-testid="inspection-status-badge"
      >
        {{ label() }}
      </span>

      @if (showOverdueBadge && overdue) {
        <span class="overdue-badge" data-testid="status-overdue-badge"> ⚠ Em atraso </span>
      }
    </span>
  `,
  styles: [
    `
      .status-badge-group {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.22rem 0.62rem;
        border-radius: 999px;
        font-size: 0.74rem;
        font-weight: 700;
        white-space: nowrap;
        border: 1px solid transparent;

        &.tone-blue {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        &.tone-orange {
          background: #fff7ed;
          color: #c2410c;
          border-color: #fed7aa;
        }

        &.tone-yellow {
          background: #fefce8;
          color: #a16207;
          border-color: #fde047;
        }

        &.tone-green {
          background: #ecfdf5;
          color: #047857;
          border-color: #a7f3d0;
        }

        &.tone-red {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }

        &.tone-gray {
          background: #f1f5f9;
          color: #475569;
          border-color: #cbd5e1;
        }
      }

      .overdue-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.14rem 0.48rem;
        border-radius: 999px;
        background: #fef2f2;
        border: 1px solid #fca5a5;
        color: #b91c1c;
        font-size: 0.71rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
    `,
  ],
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: InspectionStatus;
  @Input() overdue = false;
  @Input() showOverdueBadge = false;

  label(): string {
    return getInspectionStatusLabel(this.status);
  }

  tone(): InspectionStatusTone {
    return getInspectionStatusTone(this.status);
  }
}
