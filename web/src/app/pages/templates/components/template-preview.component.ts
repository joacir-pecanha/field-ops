import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResponseType, getCategoryLabel } from '../template.service';

export interface PreviewTemplateItem {
  code?: string | null;
  title: string;
  description?: string | null;
  responseType: ResponseType | '' | null;
  required: boolean;
  observationRequiredOnFailure: boolean;
  evidenceRequiredOnFailure: boolean;
  options: string[];
}

export interface PreviewTemplateSection {
  title: string;
  description?: string | null;
  items: PreviewTemplateItem[];
}

export interface PreviewTemplateModel {
  code?: string | null;
  title: string;
  category?: string | null;
  description?: string | null;
  versionLabel?: string;
  statusLabel?: string;
  sections: PreviewTemplateSection[];
}

interface SimulatedItemState {
  value: string;
  photos: string[];
  observation: string;
  evidencePhotos: string[];
  manualFailure: boolean;
}

/**
 * Prévia interativa do checklist simulando a experiência do técnico no app mobile
 * (TASK-010 Passo 5 — RF-04, CA-02).
 */
@Component({
  selector: 'app-template-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="preview-wrapper" data-testid="template-preview">
      <div class="preview-toolbar">
        <div class="preview-toolbar-info">
          <span class="preview-badge">Simulação do Aplicativo Mobile (Técnico)</span>
          <span class="preview-hint">
            Teste as respostas, opções de escolha única e bloqueios de não conformidade antes de publicar.
          </span>
        </div>

        <div class="preview-toolbar-actions">
          <div class="viewport-toggle" role="group" aria-label="Tamanho da prévia">
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="viewportMode() === 'mobile'"
              [class.btn-secondary]="viewportMode() !== 'mobile'"
              (click)="viewportMode.set('mobile')"
              data-testid="preview-viewport-mobile-btn"
            >
              Mobile (390px)
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="viewportMode() !== 'mobile'"
              [class.btn-secondary]="viewportMode() === 'mobile'"
              (click)="viewportMode.set('expanded')"
              data-testid="preview-viewport-expanded-btn"
            >
              Expandido
            </button>
          </div>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            (click)="resetSimulation()"
            data-testid="preview-reset-btn"
          >
            Limpar Respostas
          </button>
        </div>
      </div>

      <div
        class="device-shell"
        [class.device-shell-mobile]="viewportMode() === 'mobile'"
        [class.device-shell-expanded]="viewportMode() === 'expanded'"
      >
        @if (viewportMode() === 'mobile') {
          <div class="device-notch" aria-hidden="true">
            <span class="notch-pill"></span>
          </div>
        }

        <header class="mobile-app-header">
          <div class="mobile-status-row">
            <span class="mobile-context-tag">FieldOps Mobile · Execução em Campo</span>
            @if (template.versionLabel) {
              <span class="mobile-version-tag">{{ template.versionLabel }}</span>
            }
          </div>

          <h2 class="mobile-template-title" data-testid="preview-template-title">
            {{ template.title.trim() || 'Modelo de Inspeção sem título' }}
          </h2>

          <div class="mobile-meta-chips">
            @if (template.code) {
              <span class="code-chip">{{ template.code }}</span>
            }
            @if (template.category) {
              <span class="category-chip">{{ categoryLabel(template.category) }}</span>
            }
            @if (template.statusLabel) {
              <span class="status-chip">{{ template.statusLabel }}</span>
            }
          </div>

          @if (template.description?.trim()) {
            <p class="mobile-template-desc">{{ template.description }}</p>
          }

          <div class="progress-card">
            <div class="progress-text-row">
              <strong data-testid="preview-progress-text">
                {{ answeredItemsCount }} de {{ totalItemsCount }}
                {{ totalItemsCount === 1 ? 'item respondido' : 'itens respondidos' }}
              </strong>
              <span>{{ progressPercent }}%</span>
            </div>
            <div class="progress-track" aria-hidden="true">
              <div
                class="progress-fill"
                [style.width.%]="progressPercent"
                data-testid="preview-progress-bar"
              ></div>
            </div>
          </div>
        </header>

        <div class="mobile-scroll-body">
          @if (template.sections.length === 0 || totalItemsCount === 0) {
            <div class="preview-empty" data-testid="preview-empty-state">
              <h3>Checklist ainda sem itens para simular</h3>
              <p>
                Volte ao Editor de Estrutura para adicionar seções e itens e visualizar os campos
                interativos do técnico.
              </p>
            </div>
          } @else {
            @for (section of template.sections; track $index; let sIdx = $index) {
              <section class="mobile-section" data-testid="preview-section-card">
                <div class="mobile-section-header">
                  <span class="mobile-section-index">Seção {{ sIdx + 1 }}</span>
                  <h3>{{ section.title.trim() || 'Seção sem título' }}</h3>
                  @if (section.description?.trim()) {
                    <p>{{ section.description }}</p>
                  }
                </div>

                @if (section.items.length === 0) {
                  <p class="mobile-section-empty">Nenhum item cadastrado nesta seção.</p>
                } @else {
                  <div class="mobile-items-list">
                    @for (item of section.items; track $index; let iIdx = $index) {
                      @let itemKey = keyOf(sIdx, iIdx);
                      @let state = stateFor(itemKey);
                      @let isFailed = isItemInFailure(item, state);

                      <article
                        class="mobile-item-card"
                        [class.mobile-item-failed]="isFailed"
                        [class.mobile-item-answered]="isItemAnswered(item, state)"
                        data-testid="preview-item-card"
                      >
                        <div class="mobile-item-top">
                          <span class="mobile-item-num">{{ sIdx + 1 }}.{{ iIdx + 1 }}</span>
                          @if (item.code) {
                            <span class="code-chip">{{ item.code }}</span>
                          }
                          @if (item.required) {
                            <span class="rule-badge rule-required">Obrigatório</span>
                          }
                          @if (item.observationRequiredOnFailure) {
                            <span class="rule-badge rule-nc">Obs. se NC</span>
                          }
                          @if (item.evidenceRequiredOnFailure) {
                            <span class="rule-badge rule-nc">Foto se NC</span>
                          }
                        </div>

                        <div class="mobile-item-question">
                          <h4>
                            {{ item.title.trim() || 'Pergunta sem título' }}
                            @if (item.required) {
                              <span class="required-star" aria-hidden="true">*</span>
                            }
                          </h4>
                          @if (item.description?.trim()) {
                            <p>{{ item.description }}</p>
                          }
                        </div>

                        @switch (item.responseType) {
                          @case ('CONFORMITY') {
                            <div class="segmented-grid segmented-3" role="group">
                              <button
                                type="button"
                                class="seg-btn"
                                [class.seg-btn-ok]="state.value === 'C'"
                                (click)="setItemValue(itemKey, 'C')"
                                data-testid="preview-conformity-btn"
                              >
                                Conforme (C)
                              </button>
                              <button
                                type="button"
                                class="seg-btn"
                                [class.seg-btn-fail]="state.value === 'NC'"
                                (click)="setItemValue(itemKey, 'NC')"
                                data-testid="preview-conformity-btn"
                              >
                                Não Conforme (NC)
                              </button>
                              <button
                                type="button"
                                class="seg-btn"
                                [class.seg-btn-na]="state.value === 'NA'"
                                (click)="setItemValue(itemKey, 'NA')"
                                data-testid="preview-conformity-btn"
                              >
                                Não Aplicável (NA)
                              </button>
                            </div>
                          }

                          @case ('BOOLEAN') {
                            <div class="segmented-grid segmented-2" role="group">
                              <button
                                type="button"
                                class="seg-btn"
                                [class.seg-btn-ok]="state.value === 'YES'"
                                (click)="setItemValue(itemKey, 'YES')"
                                data-testid="preview-boolean-btn"
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                class="seg-btn"
                                [class.seg-btn-fail]="state.value === 'NO'"
                                (click)="setItemValue(itemKey, 'NO')"
                                data-testid="preview-boolean-btn"
                              >
                                Não
                              </button>
                            </div>
                          }

                          @case ('TEXT_SHORT') {
                            <input
                              type="text"
                              class="mobile-input"
                              [ngModel]="state.value"
                              (ngModelChange)="setItemValue(itemKey, $event)"
                              placeholder="Digite a resposta curta..."
                              data-testid="preview-text-short-input"
                            />
                          }

                          @case ('TEXT_LONG') {
                            <textarea
                              rows="3"
                              class="mobile-input"
                              [ngModel]="state.value"
                              (ngModelChange)="setItemValue(itemKey, $event)"
                              placeholder="Descreva o parecer técnico detalhado..."
                              data-testid="preview-text-long-input"
                            ></textarea>
                          }

                          @case ('NUMBER') {
                            <input
                              type="number"
                              class="mobile-input"
                              [ngModel]="state.value"
                              (ngModelChange)="setItemValue(itemKey, $event)"
                              placeholder="Informe o valor numérico..."
                              data-testid="preview-number-input"
                            />
                          }

                          @case ('SINGLE_CHOICE') {
                            @let validOpts = validOptionsFor(item);
                            @if (validOpts.length === 0) {
                              <div class="controlled-fallback" data-testid="preview-single-choice-empty">
                                Nenhuma opção válida configurada para este item de escolha única.
                              </div>
                            } @else {
                              <div class="radio-options-list" role="radiogroup">
                                @for (opt of validOpts; track $index; let oIdx = $index) {
                                  <label
                                    class="radio-option-card"
                                    [class.radio-option-selected]="state.value === opt"
                                  >
                                    <input
                                      type="radio"
                                      [name]="'preview-radio-' + itemKey"
                                      [value]="opt"
                                      [checked]="state.value === opt"
                                      (change)="setItemValue(itemKey, opt)"
                                      data-testid="preview-single-choice-option"
                                    />
                                    <span>{{ opt }}</span>
                                  </label>
                                }
                              </div>
                            }
                          }

                          @case ('DATE') {
                            <input
                              type="date"
                              class="mobile-input"
                              [ngModel]="state.value"
                              (ngModelChange)="setItemValue(itemKey, $event)"
                              data-testid="preview-date-input"
                            />
                          }

                          @case ('PHOTO') {
                            <div class="photo-capture-box">
                              <button
                                type="button"
                                class="btn btn-secondary btn-sm"
                                (click)="addSimulatedPhoto(itemKey)"
                                data-testid="preview-photo-btn"
                              >
                                + Capturar Foto (Simulação)
                              </button>
                              @if (state.photos.length > 0) {
                                <div class="simulated-photos-list">
                                  @for (photo of state.photos; track photo; let pIdx = $index) {
                                    <span class="photo-chip">
                                      <span>{{ photo }}</span>
                                      <button
                                        type="button"
                                        class="photo-remove"
                                        (click)="removeSimulatedPhoto(itemKey, pIdx)"
                                        title="Remover foto simulada"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  }
                                </div>
                              }
                            </div>
                          }

                          @default {
                            <div class="controlled-fallback" data-testid="preview-unknown-type">
                              Tipo de resposta ainda não configurado neste item.
                            </div>
                          }
                        }

                        @if (
                          item.responseType !== 'CONFORMITY' &&
                          item.responseType !== 'BOOLEAN' &&
                          (item.observationRequiredOnFailure || item.evidenceRequiredOnFailure)
                        ) {
                          <div class="manual-nc-toggle-row">
                            <label class="manual-nc-toggle">
                              <input
                                type="checkbox"
                                [checked]="state.manualFailure"
                                (change)="toggleManualFailure(itemKey)"
                                data-testid="preview-manual-nc-toggle"
                              />
                              <span>Simular Não Conformidade neste item</span>
                            </label>
                          </div>
                        }

                        @if (isFailed) {
                          <div class="nc-requirement-box" data-testid="preview-nc-panel">
                            <strong>Tratativa de Não Conformidade</strong>

                            @if (item.observationRequiredOnFailure) {
                              <div class="nc-field">
                                <label [attr.for]="'preview-nc-obs-' + itemKey">
                                  Observação técnica obrigatória *
                                </label>
                                <textarea
                                  [id]="'preview-nc-obs-' + itemKey"
                                  rows="2"
                                  class="mobile-input"
                                  [ngModel]="state.observation"
                                  (ngModelChange)="setObservation(itemKey, $event)"
                                  placeholder="Descreva o desvio encontrado em campo..."
                                  data-testid="preview-nc-observation-input"
                                ></textarea>
                                @if (!state.observation.trim()) {
                                  <span class="field-error">
                                    Observação obrigatória para resposta não conforme.
                                  </span>
                                }
                              </div>
                            }

                            @if (item.evidenceRequiredOnFailure) {
                              <div class="nc-field">
                                <span class="nc-label">Evidência fotográfica obrigatória *</span>
                                <div class="photo-capture-box">
                                  <button
                                    type="button"
                                    class="btn btn-secondary btn-sm"
                                    (click)="addSimulatedEvidence(itemKey)"
                                    data-testid="preview-nc-evidence-btn"
                                  >
                                    + Anexar Evidência (Simulação)
                                  </button>
                                  @if (state.evidencePhotos.length > 0) {
                                    <div class="simulated-photos-list">
                                      @for (
                                        ev of state.evidencePhotos;
                                        track ev;
                                        let eIdx = $index
                                      ) {
                                        <span class="photo-chip">
                                          <span>{{ ev }}</span>
                                          <button
                                            type="button"
                                            class="photo-remove"
                                            (click)="removeSimulatedEvidence(itemKey, eIdx)"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      }
                                    </div>
                                  }
                                </div>
                                @if (state.evidencePhotos.length === 0) {
                                  <span class="field-error">
                                    Anexe ao menos uma evidência fotográfica para esta não conformidade.
                                  </span>
                                }
                              </div>
                            }
                          </div>
                        }
                      </article>
                    }
                  </div>
                }
              </section>
            }
          }
        </div>

        @if (totalItemsCount > 0) {
          <footer class="mobile-footer">
            @if (validationResult(); as result) {
              <div
                class="validation-feedback"
                [class.validation-ok]="result.valid"
                [class.validation-blocked]="!result.valid"
                data-testid="preview-validation-result"
              >
                @if (result.valid) {
                  <strong>Checklist válido para conclusão!</strong>
                  <p>
                    Todos os itens obrigatórios e exigências de não conformidade foram atendidos.
                  </p>
                } @else {
                  <strong>Conclusão bloqueada ({{ result.pendencies.length }})</strong>
                  <ul>
                    @for (p of result.pendencies; track p) {
                      <li>{{ p }}</li>
                    }
                  </ul>
                }
              </div>
            }

            <button
              type="button"
              class="btn btn-primary mobile-submit-btn"
              (click)="simulateCompletion()"
              data-testid="preview-simulate-complete-btn"
            >
              Simular Conclusão da Inspeção
            </button>
          </footer>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .preview-wrapper {
        display: grid;
        gap: 1rem;
      }

      .preview-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.85rem;
        padding: 0.85rem 1.05rem;
      }

      .preview-toolbar-info {
        display: grid;
        gap: 0.2rem;
      }

      .preview-badge {
        display: inline-flex;
        width: fit-content;
        padding: 0.16rem 0.55rem;
        border-radius: 999px;
        background: #f0fdfa;
        border: 1px solid #99f6e4;
        color: #0f766e;
        font-size: 0.74rem;
        font-weight: 700;
      }

      .preview-hint {
        font-size: 0.81rem;
        color: #475569;
      }

      .preview-toolbar-actions,
      .viewport-toggle {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .device-shell {
        margin: 0 auto;
        width: 100%;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 1.4rem;
        overflow: hidden;
        box-shadow: 0 20px 40px -18px rgba(15, 23, 42, 0.28);
        display: flex;
        flex-direction: column;
      }

      .device-shell-mobile {
        max-width: 410px;
        border: 8px solid #0f172a;
        border-radius: 2rem;
      }

      .device-shell-expanded {
        max-width: 860px;
      }

      .device-notch {
        background: #0f172a;
        display: flex;
        justify-content: center;
        padding: 0.35rem 0 0.5rem;
      }

      .notch-pill {
        width: 86px;
        height: 6px;
        border-radius: 999px;
        background: #334155;
      }

      .mobile-app-header {
        background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
        color: #ffffff;
        padding: 1rem 1.05rem;
        display: grid;
        gap: 0.5rem;
      }

      .mobile-status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.72rem;
        color: #ccfbf1;
        font-weight: 600;
      }

      .mobile-version-tag {
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
      }

      .mobile-template-title {
        margin: 0;
        font-size: 1.08rem;
        font-weight: 700;
        line-height: 1.3;
      }

      .mobile-meta-chips {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .mobile-meta-chips .code-chip {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.3);
        color: #ffffff;
      }

      .category-chip,
      .status-chip {
        padding: 0.14rem 0.48rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        color: #f0fdfa;
        font-size: 0.71rem;
        font-weight: 700;
      }

      .mobile-template-desc {
        margin: 0;
        font-size: 0.79rem;
        color: #e2e8f0;
        line-height: 1.4;
      }

      .progress-card {
        background: rgba(15, 23, 42, 0.22);
        border-radius: 0.65rem;
        padding: 0.55rem 0.7rem;
        display: grid;
        gap: 0.35rem;
      }

      .progress-text-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.76rem;
        color: #f0fdfa;
      }

      .progress-track {
        height: 7px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.22);
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: #5eead4;
        border-radius: 999px;
        transition: width 0.2s ease;
      }

      .mobile-scroll-body {
        padding: 0.9rem;
        display: grid;
        gap: 0.95rem;
      }

      .preview-empty {
        text-align: center;
        padding: 2rem 1rem;
        background: #ffffff;
        border: 1px dashed #cbd5e1;
        border-radius: 0.85rem;
        color: #475569;

        h3 {
          margin: 0 0 0.35rem;
          font-size: 1rem;
          color: #0f172a;
        }

        p {
          margin: 0;
          font-size: 0.84rem;
        }
      }

      .mobile-section {
        display: grid;
        gap: 0.65rem;
      }

      .mobile-section-header {
        display: grid;
        gap: 0.15rem;

        h3 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
        }

        p {
          margin: 0;
          font-size: 0.78rem;
          color: #64748b;
        }
      }

      .mobile-section-index {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #0f766e;
      }

      .mobile-section-empty {
        margin: 0;
        padding: 0.7rem;
        border-radius: 0.6rem;
        background: #ffffff;
        border: 1px dashed #cbd5e1;
        font-size: 0.8rem;
        color: #64748b;
      }

      .mobile-items-list {
        display: grid;
        gap: 0.65rem;
      }

      .mobile-item-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 0.8rem;
        display: grid;
        gap: 0.55rem;

        &.mobile-item-answered {
          border-color: #99f6e4;
        }

        &.mobile-item-failed {
          border-color: #f59e0b;
          background: #fffdf7;
        }
      }

      .mobile-item-top {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .mobile-item-num {
        padding: 0.1rem 0.4rem;
        border-radius: 0.35rem;
        background: #e2e8f0;
        color: #1e293b;
        font-size: 0.71rem;
        font-weight: 700;
      }

      .rule-badge {
        padding: 0.1rem 0.42rem;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 700;

        &.rule-required {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        &.rule-nc {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }
      }

      .mobile-item-question {
        display: grid;
        gap: 0.15rem;

        h4 {
          margin: 0;
          font-size: 0.89rem;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.35;
        }

        p {
          margin: 0;
          font-size: 0.76rem;
          color: #64748b;
        }
      }

      .required-star {
        color: #dc2626;
      }

      .segmented-grid {
        display: grid;
        gap: 0.4rem;

        &.segmented-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        &.segmented-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .seg-btn {
        padding: 0.5rem 0.4rem;
        border-radius: 0.5rem;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #334155;
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
        transition: all 0.14s ease;

        &:hover {
          border-color: #94a3b8;
        }

        &.seg-btn-ok {
          background: #ecfdf5;
          border-color: #059669;
          color: #065f46;
        }

        &.seg-btn-fail {
          background: #fef2f2;
          border-color: #dc2626;
          color: #991b1b;
        }

        &.seg-btn-na {
          background: #e2e8f0;
          border-color: #64748b;
          color: #1e293b;
        }
      }

      .mobile-input {
        width: 100%;
        padding: 0.52rem 0.68rem;
        border-radius: 0.5rem;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #0f172a;
        font-size: 0.85rem;
        font-family: inherit;

        &:focus {
          outline: none;
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
        }
      }

      .radio-options-list {
        display: grid;
        gap: 0.35rem;
      }

      .radio-option-card {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.48rem 0.65rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        font-size: 0.83rem;
        color: #0f172a;
        cursor: pointer;

        input {
          accent-color: #0f766e;
        }

        &.radio-option-selected {
          background: #f0fdfa;
          border-color: #0f766e;
          font-weight: 600;
        }
      }

      .photo-capture-box {
        display: grid;
        gap: 0.45rem;
      }

      .simulated-photos-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }

      .photo-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.22rem 0.5rem;
        border-radius: 0.45rem;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e40af;
        font-size: 0.74rem;
        font-weight: 600;
      }

      .photo-remove {
        border: none;
        background: transparent;
        color: inherit;
        font-weight: 700;
        cursor: pointer;
        padding: 0 0.15rem;
      }

      .controlled-fallback {
        padding: 0.55rem 0.7rem;
        border-radius: 0.5rem;
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
        font-size: 0.78rem;
        font-weight: 600;
      }

      .manual-nc-toggle-row {
        padding-top: 0.15rem;
      }

      .manual-nc-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.77rem;
        font-weight: 600;
        color: #b45309;
        cursor: pointer;

        input {
          accent-color: #d97706;
        }
      }

      .nc-requirement-box {
        display: grid;
        gap: 0.55rem;
        padding: 0.7rem;
        border-radius: 0.55rem;
        background: #fffbeb;
        border: 1px solid #fcd34d;

        strong {
          font-size: 0.8rem;
          color: #92400e;
        }
      }

      .nc-field {
        display: grid;
        gap: 0.3rem;

        label,
        .nc-label {
          font-size: 0.76rem;
          font-weight: 700;
          color: #78350f;
        }
      }

      .mobile-footer {
        padding: 0.85rem 0.9rem 1rem;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        display: grid;
        gap: 0.65rem;
      }

      .mobile-submit-btn {
        width: 100%;
      }

      .validation-feedback {
        padding: 0.65rem 0.75rem;
        border-radius: 0.55rem;
        font-size: 0.79rem;

        strong {
          display: block;
          margin-bottom: 0.2rem;
        }

        p,
        ul {
          margin: 0;
        }

        ul {
          padding-left: 1.1rem;
        }

        &.validation-ok {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
        }

        &.validation-blocked {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }
      }
    `,
  ],
})
export class TemplatePreviewComponent implements OnChanges {
  @Input({ required: true }) template!: PreviewTemplateModel;

  readonly viewportMode = signal<'mobile' | 'expanded'>('mobile');
  readonly itemStates = signal<Record<string, SimulatedItemState>>({});
  readonly validationResult = signal<{ valid: boolean; pendencies: string[] } | null>(null);

  private photoSeq = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['template']) {
      this.validationResult.set(null);
    }
  }

  get totalItemsCount(): number {
    return this.template.sections.reduce((sum, sec) => sum + sec.items.length, 0);
  }

  get answeredItemsCount(): number {
    let count = 0;
    this.template.sections.forEach((sec, sIdx) => {
      sec.items.forEach((item, iIdx) => {
        if (this.isItemAnswered(item, this.stateFor(this.keyOf(sIdx, iIdx)))) {
          count += 1;
        }
      });
    });
    return count;
  }

  get progressPercent(): number {
    const total = this.totalItemsCount;
    if (total === 0) {
      return 0;
    }
    return Math.round((this.answeredItemsCount / total) * 100);
  }

  categoryLabel(category: string): string {
    return getCategoryLabel(category);
  }

  keyOf(sectionIndex: number, itemIndex: number): string {
    return `${sectionIndex}-${itemIndex}`;
  }

  stateFor(key: string): SimulatedItemState {
    return (
      this.itemStates()[key] ?? {
        value: '',
        photos: [],
        observation: '',
        evidencePhotos: [],
        manualFailure: false,
      }
    );
  }

  validOptionsFor(item: PreviewTemplateItem): string[] {
    return item.options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);
  }

  isItemAnswered(item: PreviewTemplateItem, state: SimulatedItemState): boolean {
    if (item.responseType === 'PHOTO') {
      return state.photos.length > 0;
    }
    return String(state.value ?? '').trim().length > 0;
  }

  isItemInFailure(item: PreviewTemplateItem, state: SimulatedItemState): boolean {
    if (item.responseType === 'CONFORMITY') {
      return state.value === 'NC';
    }
    if (item.responseType === 'BOOLEAN') {
      return state.value === 'NO';
    }
    return state.manualFailure;
  }

  setItemValue(key: string, value: string): void {
    const current = this.stateFor(key);
    this.itemStates.update((map) => ({
      ...map,
      [key]: { ...current, value: value ?? '' },
    }));
    this.validationResult.set(null);
  }

  toggleManualFailure(key: string): void {
    const current = this.stateFor(key);
    this.itemStates.update((map) => ({
      ...map,
      [key]: { ...current, manualFailure: !current.manualFailure },
    }));
    this.validationResult.set(null);
  }

  setObservation(key: string, observation: string): void {
    const current = this.stateFor(key);
    this.itemStates.update((map) => ({
      ...map,
      [key]: { ...current, observation: observation ?? '' },
    }));
    this.validationResult.set(null);
  }

  addSimulatedPhoto(key: string): void {
    this.photoSeq += 1;
    const current = this.stateFor(key);
    this.itemStates.update((map) => ({
      ...map,
      [key]: { ...current, photos: [...current.photos, `foto-item-${this.photoSeq}.jpg`] },
    }));
    this.validationResult.set(null);
  }

  removeSimulatedPhoto(key: string, photoIndex: number): void {
    const current = this.stateFor(key);
    this.itemStates.update((map) => ({
      ...map,
      [key]: {
        ...current,
        photos: current.photos.filter((_, idx) => idx !== photoIndex),
      },
    }));
    this.validationResult.set(null);
  }

  addSimulatedEvidence(key: string): void {
    this.photoSeq += 1;
    const current = this.stateFor(key);
    this.itemStates.update((map) => ({
      ...map,
      [key]: {
        ...current,
        evidencePhotos: [...current.evidencePhotos, `evidencia-nc-${this.photoSeq}.jpg`],
      },
    }));
    this.validationResult.set(null);
  }

  removeSimulatedEvidence(key: string, photoIndex: number): void {
    const current = this.stateFor(key);
    this.itemStates.update((map) => ({
      ...map,
      [key]: {
        ...current,
        evidencePhotos: current.evidencePhotos.filter((_, idx) => idx !== photoIndex),
      },
    }));
    this.validationResult.set(null);
  }

  resetSimulation(): void {
    this.itemStates.set({});
    this.validationResult.set(null);
  }

  simulateCompletion(): void {
    const pendencies: string[] = [];

    this.template.sections.forEach((sec, sIdx) => {
      sec.items.forEach((item, iIdx) => {
        const label = item.title.trim() || `Item ${sIdx + 1}.${iIdx + 1}`;
        const state = this.stateFor(this.keyOf(sIdx, iIdx));

        if (item.required && !this.isItemAnswered(item, state)) {
          pendencies.push(`Item obrigatório sem resposta: "${label}".`);
        }

        if (this.isItemInFailure(item, state)) {
          if (item.observationRequiredOnFailure && !state.observation.trim()) {
            pendencies.push(`Observação obrigatória em não conformidade: "${label}".`);
          }
          if (item.evidenceRequiredOnFailure && state.evidencePhotos.length === 0) {
            pendencies.push(`Evidência fotográfica obrigatória em não conformidade: "${label}".`);
          }
        }
      });
    });

    this.validationResult.set({
      valid: pendencies.length === 0,
      pendencies,
    });
  }
}
