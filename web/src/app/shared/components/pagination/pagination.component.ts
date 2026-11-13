import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagination-bar" data-testid="pagination-bar">
      <div class="pagination-summary">
        @if (totalElements === 0) {
          <span>Nenhum registro exibido</span>
        } @else {
          <span>
            Exibindo <strong>{{ startItem() }}–{{ endItem() }}</strong> de
            <strong>{{ totalElements }}</strong> registros
          </span>
        }
      </div>

      <div class="pagination-controls">
        <label class="size-selector">
          <span>Por página</span>
          <select
            [value]="size"
            [disabled]="disabled"
            (change)="onSizeSelect($event)"
            aria-label="Registros por página"
          >
            @for (option of pageSizeOptions; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>

        <div class="page-buttons">
          <button
            type="button"
            class="page-btn"
            [disabled]="disabled || first || page <= 0"
            (click)="goToPage(0)"
            title="Primeira página"
          >
            «
          </button>
          <button
            type="button"
            class="page-btn"
            [disabled]="disabled || first || page <= 0"
            (click)="goToPage(page - 1)"
          >
            Anterior
          </button>

          <span class="page-indicator">
            Página <strong>{{ totalPages === 0 ? 0 : page + 1 }}</strong> de
            <strong>{{ totalPages }}</strong>
          </span>

          <button
            type="button"
            class="page-btn"
            [disabled]="disabled || last || page + 1 >= totalPages"
            (click)="goToPage(page + 1)"
          >
            Próxima
          </button>
          <button
            type="button"
            class="page-btn"
            [disabled]="disabled || last || page + 1 >= totalPages"
            (click)="goToPage(totalPages - 1)"
            title="Última página"
          >
            »
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .pagination-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.9rem 1.15rem;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        border-radius: 0 0 0.85rem 0.85rem;
        font-size: 0.85rem;
        color: #475569;
      }

      .pagination-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .size-selector {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;

        select {
          padding: 0.35rem 0.6rem;
          border-radius: 0.45rem;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.83rem;
          font-weight: 600;
        }
      }

      .page-buttons {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      .page-btn {
        padding: 0.38rem 0.7rem;
        border-radius: 0.45rem;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #0f172a;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s ease, border-color 0.15s ease;

        &:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #94a3b8;
        }

        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }

      .page-indicator {
        padding: 0 0.4rem;
        font-size: 0.83rem;
        color: #334155;
      }
    `,
  ],
})
export class PaginationComponent {
  @Input() page = 0;
  @Input() size = 20;
  @Input() totalElements = 0;
  @Input() totalPages = 0;
  @Input() first = true;
  @Input() last = true;
  @Input() disabled = false;
  @Input() pageSizeOptions: readonly number[] = [10, 20, 50];

  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly sizeChange = new EventEmitter<number>();

  readonly startItem = computed(() => {
    if (this.totalElements === 0) {
      return 0;
    }
    return this.page * this.size + 1;
  });

  readonly endItem = computed(() => {
    return Math.min((this.page + 1) * this.size, this.totalElements);
  });

  goToPage(targetPage: number): void {
    if (this.disabled || targetPage < 0 || (this.totalPages > 0 && targetPage >= this.totalPages)) {
      return;
    }
    this.pageChange.emit(targetPage);
  }

  onSizeSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const nextSize = Number(select.value);
    if (!Number.isNaN(nextSize) && nextSize > 0) {
      this.sizeChange.emit(nextSize);
    }
  }
}

