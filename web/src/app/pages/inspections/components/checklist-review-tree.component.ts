import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { getResponseTypeLabel } from '../../templates/template.service';
import {
  InspectionEvidenceDto,
  InspectionItemSnapshotResponse,
  InspectionNonConformityDto,
  InspectionResponseReviewDto,
  getEvidenceImageUrl,
  getNonConformitySeverityLabel,
  getNonConformitySeverityTone,
  resolveEvidenceFileName,
  resolveEvidenceId,
  resolveEvidenceItemId,
  resolveEvidenceResponseId,
} from '../inspection.service';

export interface ChecklistEvidenceSelection {
  evidence: InspectionEvidenceDto;
  list: InspectionEvidenceDto[];
  index: number;
}

interface ReviewItemNode {
  snapshot: InspectionItemSnapshotResponse;
  response: InspectionResponseReviewDto | null;
  evidences: InspectionEvidenceDto[];
  nonConformities: InspectionNonConformityDto[];
}

interface ReviewSectionGroup {
  key: string;
  sectionOrder: number;
  title: string;
  description: string | null;
  items: ReviewItemNode[];
  answeredCount: number;
  nonConformityCount: number;
}

interface FormattedAnswer {
  answered: boolean;
  displayText: string;
  tone: 'success' | 'danger' | 'neutral' | 'info' | 'muted';
}

/**
 * Árvore de revisão do checklist preservando o snapshot original, respostas tipadas por tipo,
 * comentários do técnico, ajustes administrativos diferenciados e miniaturas de evidências
 * (RF-02, RF-03, RT-01, EX-02, RN-084, RN-085).
 */
@Component({
  selector: 'app-checklist-review-tree',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="tree-root" data-testid="checklist-review-tree">
      @if (loading) {
        <div class="skeleton-list" data-testid="checklist-tree-loading">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      } @else if (sections().length === 0) {
        <div class="empty-state" data-testid="checklist-tree-empty">
          <h3>Nenhum item no snapshot do checklist</h3>
          <p>Esta inspeção não possui seções ou itens congelados disponíveis para revisão.</p>
        </div>
      } @else {
        <div class="tree-toolbar">
          <span class="tree-summary">
            {{ sections().length }} {{ sections().length === 1 ? 'seção' : 'seções' }} •
            {{ items.length }} {{ items.length === 1 ? 'item' : 'itens' }}
          </span>
          <div class="tree-toolbar-actions">
            <button type="button" class="btn btn-secondary btn-sm" (click)="expandAll()">
              Expandir todas
            </button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="collapseAll()">
              Recolher todas
            </button>
          </div>
        </div>

        @for (section of sections(); track section.key) {
          <article class="section-card" data-testid="checklist-section">
            <button
              type="button"
              class="section-toggle"
              (click)="toggleSection(section.key)"
              [attr.aria-expanded]="!isCollapsed(section.key)"
              data-testid="checklist-section-toggle"
            >
              <div class="section-title-col">
                <span class="section-chevron">{{ isCollapsed(section.key) ? '▸' : '▾' }}</span>
                <div>
                  <h3>{{ section.title }}</h3>
                  @if (section.description) {
                    <p class="section-desc">{{ section.description }}</p>
                  }
                </div>
              </div>
              <div class="section-badges">
                <span class="meta-chip">
                  {{ section.answeredCount }}/{{ section.items.length }} respondidos
                </span>
                @if (section.nonConformityCount > 0) {
                  <span class="meta-chip chip-danger">
                    {{ section.nonConformityCount }} NC
                  </span>
                }
              </div>
            </button>

            @if (!isCollapsed(section.key)) {
              <div class="section-items">
                @for (node of section.items; track node.snapshot.id) {
                  <div
                    class="item-row"
                    [class.item-row-nc]="isItemNonConforming(node)"
                    data-testid="checklist-item-row"
                  >
                    <div class="item-head">
                      <div class="item-title-block">
                        <div class="item-title-line">
                          @if (node.snapshot.itemCode) {
                            <span class="code-chip">{{ node.snapshot.itemCode }}</span>
                          }
                          <strong data-testid="snapshot-item-title">
                            {{ node.snapshot.itemTitle }}
                          </strong>
                          @if (node.snapshot.required) {
                            <span class="req-pill">Obrigatório</span>
                          }
                        </div>
                        @if (node.snapshot.itemDescription) {
                          <p class="item-desc">{{ node.snapshot.itemDescription }}</p>
                        }
                        <span class="item-type-tag">
                          Tipo: {{ responseTypeLabel(node.snapshot.responseType) }}
                        </span>
                      </div>

                      <div class="item-answer-col">
                        @let answer = formatAnswer(node.snapshot, node.response);
                        @if (answer.answered) {
                          <span
                            class="answer-pill"
                            [ngClass]="'tone-' + answer.tone"
                            data-testid="item-answer-value"
                          >
                            {{ answer.displayText }}
                          </span>
                        } @else {
                          <span class="answer-pill tone-muted" data-testid="item-unanswered-badge">
                            Não respondido
                          </span>
                        }

                        @if (node.response?.answeredAtDevice) {
                          <span class="answer-time">
                            {{ node.response!.answeredAtDevice | date: 'dd/MM/yyyy HH:mm' }}
                          </span>
                        }
                      </div>
                    </div>

                    @if (
                      node.snapshot.responseType === 'SINGLE_CHOICE' &&
                      node.snapshot.options.length > 0
                    ) {
                      <div class="choice-options-row" data-testid="item-choice-options">
                        @for (opt of node.snapshot.options; track opt) {
                          <span
                            class="choice-chip"
                            [class.choice-selected]="isSelectedOption(node.response, opt)"
                          >
                            {{ opt }}
                          </span>
                        }
                      </div>
                    }

                    @if (node.response?.observation || node.response?.nonConformityDescription) {
                      <div class="observation-box" data-testid="item-observation">
                        @if (node.response?.observation) {
                          <div>
                            <strong>Observação do técnico:</strong> {{ node.response!.observation }}
                          </div>
                        }
                        @if (node.response?.nonConformityDescription) {
                          <div>
                            <strong>Descrição da não conformidade:</strong>
                            {{ node.response!.nonConformityDescription }}
                          </div>
                        }
                      </div>
                    }

                    @if (node.response?.adminAdjusted) {
                      <div class="admin-adjust-box" data-testid="item-admin-adjustment">
                        <strong>
                          Ajuste administrativo auditado
                          @if (node.response?.adminAdjustedByName) {
                            ({{ node.response!.adminAdjustedByName }})
                          }
                        </strong>
                        <div>
                          Valor ajustado: <strong>{{ node.response!.adminAdjustedValue }}</strong>
                          @if (node.response?.adminAdjustmentReason) {
                            — Motivo: {{ node.response!.adminAdjustmentReason }}
                          }
                        </div>
                        <div class="field-hint">
                          Valor original do técnico preservado acima (RN-084).
                        </div>
                      </div>
                    }

                    @if (node.nonConformities.length > 0) {
                      <div class="item-nc-list">
                        @for (nc of node.nonConformities; track nc.id) {
                          <span
                            class="sev-badge"
                            [ngClass]="'sev-' + severityTone(nc.severity)"
                            data-testid="item-linked-nc"
                          >
                            NC ({{ severityLabel(nc.severity) }}): {{ nc.title }}
                          </span>
                        }
                      </div>
                    }

                    @if (node.evidences.length > 0) {
                      <div class="evidence-strip" data-testid="item-evidence-strip">
                        @for (ev of node.evidences; track evidenceKey(ev, $index)) {
                          @let evKey = evidenceKey(ev, $index);
                          <div class="thumb-card">
                            @if (hasImageError(ev, evKey)) {
                              <div
                                class="thumb-fallback"
                                data-testid="evidence-image-fallback"
                                [title]="evidenceFileName(ev)"
                              >
                                <span aria-hidden="true">🖼</span>
                                <span>Imagem indisponível</span>
                                <small>{{ evidenceFileName(ev) }}</small>
                              </div>
                            } @else {
                              <button
                                type="button"
                                class="thumb-btn"
                                (click)="openEvidence(ev)"
                                [attr.aria-label]="'Ampliar ' + evidenceFileName(ev)"
                                data-testid="item-evidence-thumb"
                              >
                                @if (isImageLoading(ev, evKey)) {
                                  <span class="thumb-loading">Carregando...</span>
                                }
                                @if (resolveImageSrc(ev); as src) {
                                  <img
                                    [src]="src"
                                    [alt]="evidenceFileName(ev)"
                                    (load)="onImageLoad(evKey)"
                                    (error)="onImageError(evKey)"
                                    data-testid="item-evidence-img"
                                  />
                                }
                                <span class="thumb-caption">{{ evidenceFileName(ev) }}</span>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </article>
        }
      }
    </section>
  `,
  styles: [
    `
      .tree-root {
        display: grid;
        gap: 0.9rem;
      }

      .tree-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .tree-summary {
        font-size: 0.85rem;
        font-weight: 600;
        color: #475569;
      }

      .tree-toolbar-actions {
        display: flex;
        gap: 0.45rem;
      }

      .section-card {
        border: 1px solid #e2e8f0;
        border-radius: 0.8rem;
        background: #ffffff;
        overflow: hidden;
      }

      .section-toggle {
        width: 100%;
        border: none;
        background: #f8fafc;
        padding: 0.85rem 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        cursor: pointer;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;

        h3 {
          margin: 0;
          font-size: 0.96rem;
          color: #0f172a;
        }
      }

      .section-title-col {
        display: flex;
        align-items: flex-start;
        gap: 0.55rem;
      }

      .section-chevron {
        font-size: 0.95rem;
        color: #0f766e;
        line-height: 1.3;
      }

      .section-desc {
        margin: 0.18rem 0 0;
        font-size: 0.8rem;
        color: #64748b;
      }

      .section-badges {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .meta-chip {
        padding: 0.16rem 0.52rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        background: #e2e8f0;
        color: #334155;

        &.chip-danger {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
      }

      .section-items {
        display: grid;
      }

      .item-row {
        padding: 0.9rem 1rem;
        border-bottom: 1px solid #f1f5f9;
        display: grid;
        gap: 0.6rem;

        &:last-child {
          border-bottom: none;
        }

        &.item-row-nc {
          background: #fffafa;
          box-shadow: inset 3px 0 0 #dc2626;
        }
      }

      .item-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .item-title-block {
        display: grid;
        gap: 0.2rem;
        flex: 1;
        min-width: 240px;
      }

      .item-title-line {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .req-pill {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 0.12rem 0.45rem;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
      }

      .item-desc,
      .item-type-tag {
        margin: 0;
        font-size: 0.78rem;
        color: #64748b;
      }

      .item-answer-col {
        display: grid;
        justify-items: end;
        gap: 0.2rem;
      }

      .answer-pill {
        padding: 0.25rem 0.65rem;
        border-radius: 0.5rem;
        font-size: 0.83rem;
        font-weight: 700;
        border: 1px solid transparent;
        max-width: 360px;
        word-break: break-word;

        &.tone-success {
          background: #ecfdf5;
          color: #047857;
          border-color: #a7f3d0;
        }
        &.tone-danger {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }
        &.tone-info {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }
        &.tone-neutral {
          background: #f1f5f9;
          color: #334155;
          border-color: #cbd5e1;
        }
        &.tone-muted {
          background: #f8fafc;
          color: #94a3b8;
          border-color: #e2e8f0;
        }
      }

      .answer-time {
        font-size: 0.74rem;
        color: #64748b;
      }

      .choice-options-row,
      .item-nc-list {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .choice-chip {
        padding: 0.16rem 0.55rem;
        border-radius: 999px;
        font-size: 0.77rem;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;

        &.choice-selected {
          background: #ecfdf5;
          color: #047857;
          border-color: #10b981;
          font-weight: 700;
        }
      }

      .observation-box {
        padding: 0.6rem 0.75rem;
        border-radius: 0.55rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        font-size: 0.83rem;
        color: #1e293b;
        display: grid;
        gap: 0.25rem;
      }

      .admin-adjust-box {
        padding: 0.6rem 0.75rem;
        border-radius: 0.55rem;
        background: #fffbeb;
        border: 1px solid #fcd34d;
        font-size: 0.82rem;
        color: #78350f;
        display: grid;
        gap: 0.2rem;
      }

      .evidence-strip {
        display: flex;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .thumb-card {
        width: 132px;
      }

      .thumb-btn,
      .thumb-fallback {
        width: 132px;
        height: 108px;
        border-radius: 0.6rem;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 0;
      }

      .thumb-btn {
        cursor: pointer;
        position: relative;

        &:hover {
          border-color: #0f766e;
          box-shadow: 0 2px 8px rgba(15, 118, 110, 0.2);
        }

        img {
          width: 100%;
          height: 82px;
          object-fit: cover;
          display: block;
        }
      }

      .thumb-caption {
        font-size: 0.7rem;
        color: #334155;
        padding: 0.2rem 0.35rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
        text-align: left;
        background: #ffffff;
      }

      .thumb-loading {
        position: absolute;
        inset: 0 0 24px 0;
        display: grid;
        place-items: center;
        font-size: 0.74rem;
        color: #475569;
        background: #f1f5f9;
      }

      .thumb-fallback {
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.2rem;
        padding: 0.45rem;
        border-style: dashed;
        color: #64748b;
        font-size: 0.74rem;

        small {
          font-size: 0.66rem;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    `,
  ],
})
export class ChecklistReviewTreeComponent implements OnChanges {
  @Input() items: InspectionItemSnapshotResponse[] = [];
  @Input() responses: InspectionResponseReviewDto[] = [];
  @Input() evidences: InspectionEvidenceDto[] = [];
  @Input() nonConformities: InspectionNonConformityDto[] = [];
  @Input() resolvedUrls: Record<string, string> = {};
  @Input() failedEvidenceIds: Record<string, boolean> = {};
  @Input() loadingEvidenceIds: Record<string, boolean> = {};
  @Input() loading = false;

  @Output() readonly evidenceSelected = new EventEmitter<ChecklistEvidenceSelection>();

  readonly sections = signal<ReviewSectionGroup[]>([]);
  private readonly collapsedKeys = signal<Record<string, boolean>>({});
  private readonly loadedImageKeys = signal<Record<string, boolean>>({});
  private readonly erroredImageKeys = signal<Record<string, boolean>>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['items'] ||
      changes['responses'] ||
      changes['evidences'] ||
      changes['nonConformities']
    ) {
      this.rebuildSections();
    }
    if (changes['evidences']) {
      this.loadedImageKeys.set({});
      this.erroredImageKeys.set({});
    }
  }

  toggleSection(key: string): void {
    this.collapsedKeys.update((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  isCollapsed(key: string): boolean {
    return Boolean(this.collapsedKeys()[key]);
  }

  expandAll(): void {
    this.collapsedKeys.set({});
  }

  collapseAll(): void {
    const next: Record<string, boolean> = {};
    for (const sec of this.sections()) {
      next[sec.key] = true;
    }
    this.collapsedKeys.set(next);
  }

  responseTypeLabel(type: string): string {
    return getResponseTypeLabel(type as never);
  }

  severityLabel(severity: string): string {
    return getNonConformitySeverityLabel(severity);
  }

  severityTone(severity: string): string {
    return getNonConformitySeverityTone(severity);
  }

  isItemNonConforming(node: ReviewItemNode): boolean {
    return (
      Boolean(node.response?.nonConformity) ||
      node.response?.conformity === 'NON_CONFORMING' ||
      node.nonConformities.length > 0
    );
  }

  isSelectedOption(response: InspectionResponseReviewDto | null, option: string): boolean {
    if (!response) {
      return false;
    }
    const candidate = (response.valueText ?? response.valueRaw ?? '').trim().toLowerCase();
    return candidate.length > 0 && candidate === option.trim().toLowerCase();
  }

  formatAnswer(
    snapshot: InspectionItemSnapshotResponse,
    response: InspectionResponseReviewDto | null
  ): FormattedAnswer {
    if (!response) {
      return { answered: false, displayText: 'Não respondido', tone: 'muted' };
    }

    const raw = response.valueRaw?.trim() ?? '';
    switch (snapshot.responseType) {
      case 'CONFORMITY': {
        const val = (response.conformity ?? raw).toUpperCase();
        if (val === 'CONFORMING' || val === 'CONFORME') {
          return { answered: true, displayText: 'Conforme', tone: 'success' };
        }
        if (
          val === 'NON_CONFORMING' ||
          val === 'NAO_CONFORME' ||
          val === 'NÃO_CONFORME' ||
          val === 'NAO CONFORME'
        ) {
          return { answered: true, displayText: 'Não Conforme', tone: 'danger' };
        }
        if (val === 'NOT_APPLICABLE' || val === 'NA' || val === 'N/A') {
          return { answered: true, displayText: 'Não Aplicável', tone: 'neutral' };
        }
        return raw
          ? { answered: true, displayText: raw, tone: 'info' }
          : { answered: false, displayText: 'Não respondido', tone: 'muted' };
      }
      case 'BOOLEAN': {
        if (response.valueBoolean === true || ['true', 'sim', '1', 'yes'].includes(raw.toLowerCase())) {
          return { answered: true, displayText: 'Sim', tone: 'success' };
        }
        if (
          response.valueBoolean === false ||
          ['false', 'nao', 'não', '0', 'no'].includes(raw.toLowerCase())
        ) {
          return { answered: true, displayText: 'Não', tone: 'neutral' };
        }
        return { answered: false, displayText: 'Não respondido', tone: 'muted' };
      }
      case 'NUMBER': {
        if (response.valueNumber !== null && response.valueNumber !== undefined) {
          return { answered: true, displayText: String(response.valueNumber), tone: 'info' };
        }
        return raw
          ? { answered: true, displayText: raw, tone: 'info' }
          : { answered: false, displayText: 'Não respondido', tone: 'muted' };
      }
      case 'DATE': {
        const dateRaw = response.valueDate ?? raw;
        if (!dateRaw) {
          return { answered: false, displayText: 'Não respondido', tone: 'muted' };
        }
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateRaw);
        const formatted = match ? `${match[3]}/${match[2]}/${match[1]}` : dateRaw;
        return { answered: true, displayText: formatted, tone: 'info' };
      }
      case 'PHOTO': {
        const text = response.valueText ?? raw;
        return text
          ? { answered: true, displayText: text, tone: 'info' }
          : { answered: true, displayText: 'Evidência fotográfica registrada', tone: 'info' };
      }
      default: {
        const text = response.valueText?.trim() || raw;
        return text
          ? { answered: true, displayText: text, tone: 'info' }
          : { answered: false, displayText: 'Não respondido', tone: 'muted' };
      }
    }
  }

  evidenceKey(ev: InspectionEvidenceDto, fallbackIndex: number): string {
    return resolveEvidenceId(ev) || `ev-${fallbackIndex}`;
  }

  evidenceFileName(ev: InspectionEvidenceDto): string {
    return resolveEvidenceFileName(ev);
  }

  resolveImageSrc(ev: InspectionEvidenceDto): string {
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

  hasImageError(ev: InspectionEvidenceDto, key: string): boolean {
    const id = resolveEvidenceId(ev);
    if (id && this.failedEvidenceIds[id]) {
      return true;
    }
    if (this.erroredImageKeys()[key]) {
      return true;
    }
    if (id && this.loadingEvidenceIds[id]) {
      return false;
    }
    return this.resolveImageSrc(ev).length === 0;
  }

  isImageLoading(ev: InspectionEvidenceDto, key: string): boolean {
    const id = resolveEvidenceId(ev);
    if (this.hasImageError(ev, key)) {
      return false;
    }
    if (id && this.loadingEvidenceIds[id]) {
      return true;
    }
    return Boolean(this.resolveImageSrc(ev)) && !this.loadedImageKeys()[key];
  }

  onImageLoad(key: string): void {
    this.loadedImageKeys.update((prev) => ({ ...prev, [key]: true }));
    this.erroredImageKeys.update((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  onImageError(key: string): void {
    this.erroredImageKeys.update((prev) => ({ ...prev, [key]: true }));
  }

  openEvidence(evidence: InspectionEvidenceDto): void {
    const targetId = resolveEvidenceId(evidence);
    const list = this.evidences.length > 0 ? this.evidences : [evidence];
    const index = list.findIndex((item) =>
      targetId ? resolveEvidenceId(item) === targetId : item === evidence
    );
    this.evidenceSelected.emit({
      evidence,
      list,
      index: index >= 0 ? index : 0,
    });
  }

  private rebuildSections(): void {
    const responseByItemId = new Map<string, InspectionResponseReviewDto>();
    for (const resp of this.responses ?? []) {
      responseByItemId.set(resp.inspectionItemId, resp);
    }

    const sortedItems = [...(this.items ?? [])].sort((a, b) => {
      if (a.sectionOrder !== b.sectionOrder) {
        return a.sectionOrder - b.sectionOrder;
      }
      return a.itemOrder - b.itemOrder;
    });

    const groupsMap = new Map<string, ReviewSectionGroup>();

    for (const snapshot of sortedItems) {
      const response = responseByItemId.get(snapshot.id) ?? null;
      const itemEvidences = (this.evidences ?? []).filter((ev) => {
        const evItemId = resolveEvidenceItemId(ev);
        const evRespId = resolveEvidenceResponseId(ev);
        return evItemId === snapshot.id || (response !== null && evRespId === response.id);
      });
      const itemNcs = (this.nonConformities ?? []).filter(
        (nc) =>
          nc.inspectionItemId === snapshot.id ||
          (response !== null && nc.responseId === response.id)
      );

      const secKey = `${snapshot.sectionOrder}::${snapshot.sectionTitle}`;
      let group = groupsMap.get(secKey);
      if (!group) {
        group = {
          key: secKey,
          sectionOrder: snapshot.sectionOrder,
          title: snapshot.sectionTitle || 'Checklist Geral',
          description: snapshot.sectionDescription ?? null,
          items: [],
          answeredCount: 0,
          nonConformityCount: 0,
        };
        groupsMap.set(secKey, group);
      }

      const node: ReviewItemNode = {
        snapshot,
        response,
        evidences: itemEvidences,
        nonConformities: itemNcs,
      };
      group.items.push(node);
      if (this.formatAnswer(snapshot, response).answered) {
        group.answeredCount += 1;
      }
      if (this.isItemNonConforming(node)) {
        group.nonConformityCount += 1;
      }
    }

    this.sections.set(Array.from(groupsMap.values()));
  }
}
