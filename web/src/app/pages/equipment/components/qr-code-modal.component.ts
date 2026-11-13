import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as QRCode from 'qrcode';
import { EquipmentResponse } from '../../../core/master/master-data.models';
import { NotificationService } from '../../../core/services/notification.service';

export type QrRenderMode = 'canvas' | 'svg';

/**
 * Modal de geração, visualização em Canvas/SVG, download em alta definição e impressão
 * de etiquetas QR Code para equipamentos (TASK-008 Passo 4 — RF-04, RN-011, CA-03).
 */
@Component({
  selector: 'app-qr-code-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (equipment) {
      <div
        class="modal-backdrop"
        (click)="close()"
        data-testid="qr-modal-backdrop"
      >
        <div
          class="modal-card qr-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          (click)="$event.stopPropagation()"
          data-testid="qr-code-modal"
        >
          <header class="modal-header">
            <div>
              <h2 id="qr-modal-title">Etiqueta QR Code do Equipamento</h2>
              <p class="qr-subtitle">
                Renderização em alta definição (Canvas HD e SVG vetorial) para fixação física (RN-011).
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="close()"
              data-testid="qr-close-btn"
            >
              Fechar
            </button>
          </header>

          <div class="modal-body">
            <div class="qr-toolbar">
              <div class="render-mode-group" role="group" aria-label="Modo de renderização">
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-primary]="renderMode() === 'canvas'"
                  [class.btn-secondary]="renderMode() !== 'canvas'"
                  (click)="setRenderMode('canvas')"
                  data-testid="qr-mode-canvas-btn"
                >
                  Canvas HD
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-primary]="renderMode() === 'svg'"
                  [class.btn-secondary]="renderMode() !== 'svg'"
                  (click)="setRenderMode('svg')"
                  data-testid="qr-mode-svg-btn"
                >
                  SVG Vetorial
                </button>
              </div>

              <button
                type="button"
                class="btn btn-secondary btn-sm"
                (click)="copyQrCode()"
                data-testid="qr-copy-btn"
              >
                Copiar Código
              </button>
            </div>

            @if (renderError()) {
              <div class="alert-banner alert-error" role="alert">
                <div>
                  <strong>Falha ao gerar QR Code</strong>
                  <p>{{ renderError() }}</p>
                </div>
              </div>
            }

            <div class="qr-label-preview" data-testid="qr-label-preview">
              <div class="qr-label-brand">
                <span class="brand-tag">FIELDOPS</span>
                <span class="brand-doc">IDENTIFICAÇÃO PATRIMONIAL</span>
              </div>

              <div class="qr-stage">
                <div [hidden]="renderMode() !== 'canvas'" class="qr-canvas-wrap">
                  <canvas
                    #qrCanvas
                    width="280"
                    height="280"
                    aria-label="QR Code do equipamento em Canvas"
                    data-testid="qr-canvas"
                  ></canvas>
                </div>

                @if (renderMode() === 'svg' && safeSvgMarkup()) {
                  <div
                    class="qr-svg-wrap"
                    [innerHTML]="safeSvgMarkup()"
                    aria-label="QR Code do equipamento em SVG"
                    data-testid="qr-svg"
                  ></div>
                }
              </div>

              <div class="qr-code-value">
                <span class="code-chip">{{ equipment.qrCode }}</span>
              </div>

              <dl class="qr-metadata-grid">
                <div>
                  <dt>Equipamento</dt>
                  <dd>{{ equipment.name }}</dd>
                </div>
                <div>
                  <dt>Código</dt>
                  <dd>{{ equipment.code || 'Sem código' }}</dd>
                </div>
                <div>
                  <dt>Cliente</dt>
                  <dd>{{ equipment.clientName || '—' }}</dd>
                </div>
                <div>
                  <dt>Local</dt>
                  <dd>{{ equipment.siteName || '—' }}</dd>
                </div>
                <div>
                  <dt>Patrimônio</dt>
                  <dd>{{ equipment.assetNumber || '—' }}</dd>
                </div>
                <div>
                  <dt>Nº de Série</dt>
                  <dd>{{ equipment.serialNumber || '—' }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <footer class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              (click)="downloadSvg()"
              [disabled]="!rawSvg()"
              data-testid="qr-download-svg-btn"
            >
              Baixar SVG
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              (click)="downloadPngHd()"
              [disabled]="!hdPngDataUrl()"
              data-testid="qr-download-png-btn"
            >
              Baixar PNG HD
            </button>
            <button
              type="button"
              class="btn btn-primary"
              (click)="printLabel()"
              [disabled]="!rawSvg()"
              data-testid="qr-print-btn"
            >
              Imprimir Etiqueta
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .qr-modal-card {
        max-width: 620px;
      }

      .qr-subtitle {
        margin: 0.2rem 0 0;
        font-size: 0.84rem;
        color: #64748b;
      }

      .qr-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .render-mode-group {
        display: inline-flex;
        gap: 0.4rem;
      }

      .qr-label-preview {
        border: 2px solid #0f172a;
        border-radius: 0.85rem;
        padding: 1.15rem;
        background: #ffffff;
        display: grid;
        gap: 0.9rem;
        justify-items: center;
      }

      .qr-label-brand {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 0.65rem;
        border-bottom: 1px solid #cbd5e1;
      }

      .brand-tag {
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #0f766e;
      }

      .brand-doc {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #475569;
      }

      .qr-stage {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.65rem;
      }

      .qr-canvas-wrap canvas {
        display: block;
        width: 240px;
        height: 240px;
      }

      .qr-svg-wrap {
        width: 240px;
        height: 240px;
        display: flex;
        align-items: center;
        justify-content: center;

        ::ng-deep svg {
          width: 100%;
          height: 100%;
          display: block;
        }
      }

      .qr-code-value {
        display: flex;
        justify-content: center;
      }

      .qr-metadata-grid {
        width: 100%;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.65rem 1rem;
        padding-top: 0.75rem;
        border-top: 1px dashed #cbd5e1;

        dt {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }

        dd {
          margin: 0.15rem 0 0;
          font-size: 0.85rem;
          font-weight: 600;
          color: #0f172a;
          word-break: break-word;
        }
      }

      @media (max-width: 520px) {
        .qr-metadata-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class QrCodeModalComponent implements OnChanges {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly notifications = inject(NotificationService);

  @Input() equipment: EquipmentResponse | null = null;
  @Output() readonly closed = new EventEmitter<void>();

  private canvasElement?: ElementRef<HTMLCanvasElement>;

  @ViewChild('qrCanvas')
  set qrCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.canvasElement = ref;
    if (ref && this.equipment?.qrCode) {
      void this.renderCanvas(this.equipment.qrCode, ref.nativeElement);
    }
  }

  readonly renderMode = signal<QrRenderMode>('canvas');
  readonly renderError = signal<string | null>(null);
  readonly rawSvg = signal<string>('');
  readonly safeSvgMarkup = signal<SafeHtml | null>(null);
  readonly hdPngDataUrl = signal<string>('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['equipment']) {
      if (this.equipment?.qrCode) {
        void this.generateQrOutputs(this.equipment.qrCode);
      } else {
        this.resetOutputs();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.equipment) {
      this.close();
    }
  }

  setRenderMode(mode: QrRenderMode): void {
    this.renderMode.set(mode);
    if (mode === 'canvas' && this.canvasElement && this.equipment?.qrCode) {
      void this.renderCanvas(this.equipment.qrCode, this.canvasElement.nativeElement);
    }
  }

  close(): void {
    this.closed.emit();
  }

  async copyQrCode(): Promise<void> {
    const code = this.equipment?.qrCode;
    if (!code) {
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        this.notifications.showSuccess(`Código QR "${code}" copiado para a área de transferência.`);
        return;
      }
      this.notifications.showInfo(`Código QR: ${code}`);
    } catch {
      this.notifications.showWarning('Não foi possível copiar automaticamente. Copie o código exibido na etiqueta.');
    }
  }

  async downloadPngHd(): Promise<void> {
    const equipment = this.equipment;
    const qrDataUrl = this.hdPngDataUrl();
    if (!equipment || !qrDataUrl) {
      return;
    }

    try {
      const compositeUrl = await this.buildCompositeLabelPng(equipment, qrDataUrl);
      this.triggerDownload(compositeUrl, `${this.buildFileSlug(equipment)}.png`);
      this.notifications.showSuccess('Etiqueta PNG em alta definição gerada para download.');
    } catch {
      this.triggerDownload(qrDataUrl, `${this.buildFileSlug(equipment)}.png`);
      this.notifications.showSuccess('QR Code PNG em alta definição gerado para download.');
    }
  }

  downloadSvg(): void {
    const equipment = this.equipment;
    const svg = this.rawSvg();
    if (!equipment || !svg) {
      return;
    }

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    this.triggerDownload(objectUrl, `${this.buildFileSlug(equipment)}.svg`);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    this.notifications.showSuccess('QR Code SVG vetorial gerado para download.');
  }

  printLabel(): void {
    const equipment = this.equipment;
    const svg = this.rawSvg();
    if (!equipment || !svg || typeof window === 'undefined') {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=720,height=840');
    if (!printWindow) {
      this.notifications.showWarning(
        'O navegador bloqueou a janela de impressão. Libere pop-ups ou utilize "Baixar PNG HD" / "Baixar SVG".'
      );
      return;
    }

    const html = this.buildPrintableLabelHtml(equipment, svg);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 150);
  }

  private async generateQrOutputs(qrValue: string): Promise<void> {
    this.renderError.set(null);

    try {
      const [svgString, pngUrl] = await Promise.all([
        QRCode.toString(qrValue, {
          type: 'svg',
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 280,
          color: { dark: '#0f172a', light: '#ffffff' },
        }),
        QRCode.toDataURL(qrValue, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 1024,
          color: { dark: '#0f172a', light: '#ffffff' },
        }),
      ]);

      this.rawSvg.set(svgString);
      this.safeSvgMarkup.set(this.sanitizer.bypassSecurityTrustHtml(svgString));
      this.hdPngDataUrl.set(pngUrl);

      if (this.canvasElement) {
        await this.renderCanvas(qrValue, this.canvasElement.nativeElement);
      }
    } catch {
      this.renderError.set('Não foi possível renderizar o QR Code para o código informado.');
    }
  }

  private async renderCanvas(qrValue: string, canvas: HTMLCanvasElement): Promise<void> {
    try {
      await QRCode.toCanvas(canvas, qrValue, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 280,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch {
      this.renderError.set('Erro ao renderizar QR Code no elemento Canvas.');
    }
  }

  private async buildCompositeLabelPng(
    equipment: EquipmentResponse,
    qrDataUrl: string
  ): Promise<string> {
    if (typeof document === 'undefined') {
      return qrDataUrl;
    }

    const image = await this.loadImage(qrDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1320;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return qrDataUrl;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('FIELDOPS • ETIQUETA PATRIMONIAL', 60, 86);

    ctx.drawImage(image, 140, 120, 800, 800);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(equipment.qrCode, canvas.width / 2, 975);

    ctx.textAlign = 'left';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(equipment.name.slice(0, 44), 60, 1055);

    ctx.fillStyle = '#475569';
    ctx.font = '26px sans-serif';
    ctx.fillText(`Cliente: ${equipment.clientName || '—'}`.slice(0, 56), 60, 1110);
    ctx.fillText(`Local: ${equipment.siteName || '—'}`.slice(0, 56), 60, 1155);
    ctx.fillText(
      `Código: ${equipment.code || '—'}  |  Patrimônio: ${equipment.assetNumber || '—'}`.slice(0, 58),
      60,
      1200
    );
    ctx.fillText(`Nº Série: ${equipment.serialNumber || '—'}`.slice(0, 56), 60, 1245);

    return canvas.toDataURL('image/png');
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }

  private triggerDownload(href: string, filename: string): void {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private buildFileSlug(equipment: EquipmentResponse): string {
    const raw = (equipment.code || equipment.qrCode || 'equipamento')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    return `etiqueta-qr-${raw}`;
  }

  private buildPrintableLabelHtml(equipment: EquipmentResponse, svg: string): string {
    const escapeHtml = (value: string | null | undefined): string =>
      (value ?? '—')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Etiqueta QR - ${escapeHtml(equipment.qrCode)}</title>
    <style>
      @page { margin: 12mm; }
      body {
        margin: 0;
        font-family: 'Segoe UI', system-ui, sans-serif;
        color: #0f172a;
        display: flex;
        justify-content: center;
        padding: 16px;
      }
      .label-sheet {
        width: 360px;
        border: 2px solid #0f172a;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
      }
      .brand {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #0f766e;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 8px;
        margin-bottom: 14px;
      }
      .qr-box svg {
        width: 240px;
        height: 240px;
      }
      .qr-code {
        display: inline-block;
        margin: 10px 0 14px;
        padding: 4px 10px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-family: monospace;
        font-size: 13px;
        font-weight: 700;
      }
      .meta {
        text-align: left;
        border-top: 1px dashed #cbd5e1;
        padding-top: 10px;
        font-size: 12px;
        line-height: 1.5;
      }
      .meta strong {
        color: #475569;
      }
    </style>
  </head>
  <body>
    <article class="label-sheet">
      <div class="brand">
        <span>FIELDOPS</span>
        <span>IDENTIFICAÇÃO PATRIMONIAL</span>
      </div>
      <div class="qr-box">${svg}</div>
      <div class="qr-code">${escapeHtml(equipment.qrCode)}</div>
      <div class="meta">
        <div><strong>Equipamento:</strong> ${escapeHtml(equipment.name)}</div>
        <div><strong>Código:</strong> ${escapeHtml(equipment.code || 'Sem código')}</div>
        <div><strong>Cliente:</strong> ${escapeHtml(equipment.clientName)}</div>
        <div><strong>Local:</strong> ${escapeHtml(equipment.siteName)}</div>
        <div><strong>Patrimônio:</strong> ${escapeHtml(equipment.assetNumber)}</div>
        <div><strong>Nº de Série:</strong> ${escapeHtml(equipment.serialNumber)}</div>
      </div>
    </article>
  </body>
</html>`;
  }

  private resetOutputs(): void {
    this.renderError.set(null);
    this.rawSvg.set('');
    this.safeSvgMarkup.set(null);
    this.hdPngDataUrl.set('');
  }
}

