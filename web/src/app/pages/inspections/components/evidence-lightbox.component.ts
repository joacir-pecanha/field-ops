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
import {
  InspectionEvidenceDto,
  getEvidenceImageUrl,
  resolveEvidenceFileName,
  resolveEvidenceId,
} from '../inspection.service';

/**
 * Visualizador modal em tela cheia para evidências fotográficas com controle de zoom,
 * navegação entre fotos e fallback amigável em falha de carregamento (RF-03, EX-02, CA-02).
 */
@Component({
  selector: 'app-evidence-lightbox',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open && evidences.length > 0) {
      <div
        class="lightbox-backdrop"
        role="presentation"
        (click)="close()"
        data-testid="evidence-lightbox-backdrop"
      >
        <section
          class="lightbox-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
          (click)="$event.stopPropagation()"
          data-testid="evidence-lightbox-modal"
        >
          <header class="lightbox-header">
            <div class="lightbox-title-group">
              <h2 id="lightbox-title">{{ activeFileName() }}</h2>
              <span class="lightbox-counter" data-testid="lightbox-counter">
                Foto {{ safeIndex() + 1 }} de {{ evidences.length }}
              </span>
              @if (activeEvidence(); as ev) {
                @if (ev.client_timestamp || ev.clientTimestamp || ev.uploaded_at || ev.uploadedAt) {
                  <span class="lightbox-meta">
                    {{
                      (ev.client_timestamp || ev.clientTimestamp || ev.uploaded_at || ev.uploadedAt)
                        | date: 'dd/MM/yyyy HH:mm'
                    }}
                  </span>
                }
              }
            </div>

            <div class="lightbox-controls">
              <button
                type="button"
                class="lb-btn"
                (click)="zoomOut()"
                [disabled]="zoomLevel() <= minZoom"
                aria-label="Reduzir zoom"
                data-testid="lightbox-zoom-out-btn"
              >
                −
              </button>
              <button
                type="button"
                class="lb-btn"
                (click)="resetZoom()"
                aria-label="Resetar zoom"
                data-testid="lightbox-zoom-reset-btn"
              >
                {{ (zoomLevel() * 100).toFixed(0) }}%
              </button>
              <button
                type="button"
                class="lb-btn"
                (click)="zoomIn()"
                [disabled]="zoomLevel() >= maxZoom"
                aria-label="Ampliar zoom"
                data-testid="lightbox-zoom-in-btn"
              >
                +
              </button>
              <button
                type="button"
                class="lb-btn lb-btn-close"
                (click)="close()"
                aria-label="Fechar visualizador"
                data-testid="lightbox-close-btn"
              >
                ✕ Fechar
              </button>
            </div>
          </header>

          <div class="lightbox-stage">
            <button
              type="button"
              class="lb-nav-btn"
              (click)="prev()"
              [disabled]="safeIndex() <= 0"
              aria-label="Foto anterior"
              data-testid="lightbox-prev-btn"
            >
              ‹
            </button>

            <div class="lightbox-canvas">
              @if (hasActiveError()) {
                <div class="lightbox-fallback" data-testid="lightbox-image-fallback">
                  <div class="fallback-icon" aria-hidden="true">🖼</div>
                  <strong>Imagem indisponível em alta resolução</strong>
                  <p>
                    Não foi possível carregar o arquivo "{{ activeFileName() }}". Verifique a
                    sincronização ou tente novamente mais tarde.
                  </p>
                </div>
              } @else {
                @if (isActiveLoading()) {
                  <div class="lightbox-loading" data-testid="lightbox-image-loading">
                    <span class="inline-spinner"></span>
                    <span>Carregando fotografia...</span>
                  </div>
                }
                @if (activeImageSrc(); as src) {
                  <img
                    class="lightbox-img"
                    [src]="src"
                    [alt]="activeFileName()"
                    [style.transform]="'scale(' + zoomLevel() + ')'"
                    [class.zoomed]="zoomLevel() > 1"
                    [class.img-hidden]="isActiveLoading()"
                    (click)="toggleZoom()"
                    (load)="onImageLoad(activeEvidenceId())"
                    (error)="onImageError(activeEvidenceId())"
                    data-testid="lightbox-image"
                  />
                }
              }
            </div>

            <button
              type="button"
              class="lb-nav-btn"
              (click)="next()"
              [disabled]="safeIndex() >= evidences.length - 1"
              aria-label="Próxima foto"
              data-testid="lightbox-next-btn"
            >
              ›
            </button>
          </div>

          @if (evidences.length > 1) {
            <footer class="lightbox-thumbs" aria-label="Miniaturas das evidências">
              @for (ev of evidences; track evidenceKey(ev, $index)) {
                <button
                  type="button"
                  class="lb-thumb-btn"
                  [class.active]="$index === safeIndex()"
                  (click)="selectIndex($index)"
                  [attr.aria-label]="'Selecionar ' + evidenceName(ev)"
                  data-testid="lightbox-thumb-btn"
                >
                  @if (hasErrorFor(ev)) {
                    <span class="lb-thumb-fallback">!</span>
                  } @else if (imageSrcFor(ev); as thumbSrc) {
                    <img
                      [src]="thumbSrc"
                      [alt]="evidenceName(ev)"
                      (error)="onImageError(evidenceKey(ev, $index))"
                    />
                  } @else {
                    <span class="lb-thumb-fallback">…</span>
                  }
                </button>
              }
            </footer>
          }
        </section>
      </div>
    }
  `,
  styles: [
    `
      .lightbox-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1400;
        background: rgba(2, 6, 23, 0.88);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .lightbox-dialog {
        width: min(1140px, 100%);
        height: min(88vh, 840px);
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 0.9rem;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .lightbox-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 1.15rem;
        border-bottom: 1px solid #1e293b;
        background: #020617;
      }

      .lightbox-title-group {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
        min-width: 0;

        h2 {
          margin: 0;
          font-size: 0.98rem;
          font-weight: 700;
          color: #f8fafc;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .lightbox-counter,
      .lightbox-meta {
        font-size: 0.78rem;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        background: #1e293b;
        color: #cbd5e1;
      }

      .lightbox-controls {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
      }

      .lb-btn {
        border: 1px solid #334155;
        background: #1e293b;
        color: #f8fafc;
        border-radius: 0.45rem;
        padding: 0.35rem 0.65rem;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;

        &:hover:not(:disabled) {
          background: #334155;
        }

        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }

      .lb-btn-close {
        background: #991b1b;
        border-color: #b91c1c;

        &:hover:not(:disabled) {
          background: #b91c1c;
        }
      }

      .lightbox-stage {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 48px 1fr 48px;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
      }

      .lb-nav-btn {
        height: 48px;
        width: 48px;
        border-radius: 999px;
        border: 1px solid #334155;
        background: rgba(30, 41, 59, 0.85);
        color: #f8fafc;
        font-size: 1.5rem;
        cursor: pointer;

        &:hover:not(:disabled) {
          background: #0f766e;
          border-color: #14b8a6;
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      }

      .lightbox-canvas {
        height: 100%;
        width: 100%;
        overflow: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #020617;
        border-radius: 0.65rem;
        padding: 0.75rem;
      }

      .lightbox-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transform-origin: center center;
        transition: transform 0.16s ease;
        cursor: zoom-in;
        border-radius: 0.35rem;

        &.zoomed {
          cursor: zoom-out;
        }

        &.img-hidden {
          display: none;
        }
      }

      .lightbox-loading,
      .lightbox-fallback {
        display: grid;
        place-items: center;
        text-align: center;
        gap: 0.45rem;
        color: #cbd5e1;
        padding: 1.5rem;
        max-width: 420px;

        p {
          margin: 0;
          font-size: 0.84rem;
          color: #94a3b8;
        }
      }

      .fallback-icon {
        font-size: 2rem;
      }

      .lightbox-thumbs {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.65rem 1rem;
        border-top: 1px solid #1e293b;
        background: #020617;
        overflow-x: auto;
      }

      .lb-thumb-btn {
        width: 56px;
        height: 44px;
        padding: 0;
        border-radius: 0.4rem;
        border: 2px solid #334155;
        background: #1e293b;
        overflow: hidden;
        cursor: pointer;
        flex-shrink: 0;

        &.active {
          border-color: #14b8a6;
          box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.35);
        }

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      }

      .lb-thumb-fallback {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        font-weight: 700;
        color: #fca5a5;
      }
    `,
  ],
})
export class EvidenceLightboxComponent implements OnChanges {
  @Input() open = false;
  @Input() evidences: InspectionEvidenceDto[] = [];
  @Input() activeIndex = 0;
  @Input() resolvedUrls: Record<string, string> = {};
  @Input() failedEvidenceIds: Record<string, boolean> = {};
  @Input() loadingEvidenceIds: Record<string, boolean> = {};

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly indexChange = new EventEmitter<number>();

  readonly minZoom = 0.5;
  readonly maxZoom = 3;

  readonly zoomLevel = signal(1);
  private readonly loadedIds = signal<Record<string, boolean>>({});
  private readonly errorIds = signal<Record<string, boolean>>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['activeIndex']) {
      this.zoomLevel.set(1);
    }
    if (changes['evidences']) {
      this.loadedIds.set({});
      this.errorIds.set({});
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.open || this.evidences.length === 0) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetZoom();
    }
  }

  safeIndex(): number {
    if (this.evidences.length === 0) {
      return 0;
    }
    return Math.max(0, Math.min(this.activeIndex, this.evidences.length - 1));
  }

  activeEvidence(): InspectionEvidenceDto | null {
    return this.evidences[this.safeIndex()] ?? null;
  }

  activeEvidenceId(): string {
    const ev = this.activeEvidence();
    return ev ? this.evidenceKey(ev, this.safeIndex()) : '';
  }

  activeFileName(): string {
    const ev = this.activeEvidence();
    return ev ? resolveEvidenceFileName(ev) : 'Evidência';
  }

  evidenceKey(ev: InspectionEvidenceDto, fallbackIndex: number): string {
    return resolveEvidenceId(ev) || `ev-${fallbackIndex}`;
  }

  evidenceName(ev: InspectionEvidenceDto): string {
    return resolveEvidenceFileName(ev);
  }

  imageSrcFor(ev: InspectionEvidenceDto): string {
    if (ev.url && ev.url.trim().length > 0) {
      return ev.url.trim();
    }
    const id = resolveEvidenceId(ev);
    if (id && this.resolvedUrls[id]) {
      return this.resolvedUrls[id];
    }
    if (id && this.loadingEvidenceIds[id]) {
      return '';
    }
    return getEvidenceImageUrl(ev);
  }

  activeImageSrc(): string {
    const ev = this.activeEvidence();
    return ev ? this.imageSrcFor(ev) : '';
  }

  hasErrorFor(ev: InspectionEvidenceDto): boolean {
    const id = resolveEvidenceId(ev);
    const key = id || '';
    if (id && this.failedEvidenceIds[id]) {
      return true;
    }
    if (key && this.errorIds()[key]) {
      return true;
    }
    if (id && this.loadingEvidenceIds[id]) {
      return false;
    }
    return this.imageSrcFor(ev).length === 0;
  }

  hasActiveError(): boolean {
    const ev = this.activeEvidence();
    if (!ev) {
      return false;
    }
    const key = this.activeEvidenceId();
    if (this.failedEvidenceIds[key] || this.errorIds()[key]) {
      return true;
    }
    if (this.loadingEvidenceIds[key]) {
      return false;
    }
    return this.activeImageSrc().length === 0;
  }

  isActiveLoading(): boolean {
    const key = this.activeEvidenceId();
    if (!key || this.hasActiveError()) {
      return false;
    }
    if (this.loadingEvidenceIds[key]) {
      return true;
    }
    const src = this.activeImageSrc();
    return Boolean(src) && !this.loadedIds()[key];
  }

  onImageLoad(id: string): void {
    if (!id) {
      return;
    }
    this.loadedIds.update((prev) => ({ ...prev, [id]: true }));
    this.errorIds.update((prev) => {
      if (!prev[id]) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  onImageError(id: string): void {
    if (!id) {
      return;
    }
    this.errorIds.update((prev) => ({ ...prev, [id]: true }));
  }

  zoomIn(): void {
    this.zoomLevel.update((z) => Math.min(this.maxZoom, Number((z + 0.5).toFixed(2))));
  }

  zoomOut(): void {
    this.zoomLevel.update((z) => Math.max(this.minZoom, Number((z - 0.5).toFixed(2))));
  }

  resetZoom(): void {
    this.zoomLevel.set(1);
  }

  toggleZoom(): void {
    this.zoomLevel.update((z) => (z > 1 ? 1 : 2));
  }

  prev(): void {
    const current = this.safeIndex();
    if (current > 0) {
      this.selectIndex(current - 1);
    }
  }

  next(): void {
    const current = this.safeIndex();
    if (current < this.evidences.length - 1) {
      this.selectIndex(current + 1);
    }
  }

  selectIndex(index: number): void {
    if (this.evidences.length === 0) {
      return;
    }
    const clamped = Math.max(0, Math.min(index, this.evidences.length - 1));
    this.zoomLevel.set(1);
    this.indexChange.emit(clamped);
  }

  close(): void {
    this.closed.emit();
  }
}
