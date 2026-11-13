import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ItemFormGroup, SectionFormGroup } from '../template-form.types';
import { ItemEditorComponent } from './item-editor.component';

/**
 * Subcomponente de edição de seção e ordenação de seus itens (TASK-010 Passo 4).
 */
@Component({
  selector: 'app-section-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ItemEditorComponent],
  template: `
    <article
      class="section-card"
      [id]="domId"
      [class.section-card-selected]="selected"
      [formGroup]="sectionGroup"
      data-testid="builder-section-card"
    >
      <header class="section-card-header">
        <div class="section-header-left">
          <span class="section-order-badge">Seção {{ sectionIndex + 1 }}</span>
          <span class="section-summary-text">
            {{ sectionGroup.controls.title.value.trim() || 'Nova seção' }}
          </span>
          <span class="section-count-chip">
            {{ sectionGroup.controls.items.length }}
            {{ sectionGroup.controls.items.length === 1 ? 'item' : 'itens' }}
          </span>
        </div>

        <div class="section-header-actions">
          <button
            type="button"
            class="btn btn-secondary btn-icon"
            (click)="toggleCollapse.emit()"
            data-testid="toggle-section-collapse-btn"
          >
            {{ collapsed ? 'Expandir' : 'Recolher' }}
          </button>

          @if (editable) {
            <button
              type="button"
              class="btn btn-secondary btn-icon"
              (click)="moveUp.emit()"
              [disabled]="sectionIndex === 0"
              title="Mover seção para cima"
              data-testid="move-section-up-btn"
            >
              ↑
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-icon"
              (click)="moveDown.emit()"
              [disabled]="sectionIndex === totalSections - 1"
              title="Mover seção para baixo"
              data-testid="move-section-down-btn"
            >
              ↓
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-icon"
              (click)="duplicate.emit()"
              title="Duplicar seção"
              data-testid="duplicate-section-btn"
            >
              Duplicar
            </button>
            <button
              type="button"
              class="btn btn-danger-outline btn-icon"
              (click)="remove.emit()"
              data-testid="remove-section-btn"
            >
              Excluir
            </button>
          }
        </div>
      </header>

      @if (!collapsed) {
        <div class="section-card-body">
          <div class="form-grid">
            <div class="form-field">
              <label [attr.for]="'section-title-' + sectionIndex">Título da seção *</label>
              <input
                [id]="'section-title-' + sectionIndex"
                type="text"
                formControlName="title"
                placeholder="Ex.: Condições Físicas e Segurança"
                [class.input-invalid]="isSectionTitleInvalid"
                data-testid="section-title-input"
              />
              @if (isSectionTitleInvalid) {
                <span class="field-error">O título da seção é obrigatório.</span>
              }
            </div>

            <div class="form-field">
              <label [attr.for]="'section-desc-' + sectionIndex">Descrição da seção</label>
              <input
                [id]="'section-desc-' + sectionIndex"
                type="text"
                formControlName="description"
                placeholder="Instruções opcionais exibidas ao técnico antes dos itens..."
              />
            </div>
          </div>

          <div class="items-stack" formArrayName="items">
            @if (sectionGroup.controls.items.controls.length === 0) {
              <div class="empty-items-box">
                <p>Esta seção ainda não possui itens configurados.</p>
                @if (editable) {
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    (click)="addItem.emit()"
                    data-testid="add-item-btn"
                  >
                    + Adicionar Item
                  </button>
                }
              </div>
            } @else {
              @for (
                itemGroup of sectionGroup.controls.items.controls;
                track itemGroup;
                let iIdx = $index
              ) {
                <app-item-editor
                  [itemGroup]="itemGroup"
                  [sectionIndex]="sectionIndex"
                  [itemIndex]="iIdx"
                  [totalItemsInSection]="sectionGroup.controls.items.length"
                  [editable]="editable"
                  [selected]="selectedItemGroup === itemGroup"
                  [submitted]="submitted"
                  [domId]="getItemDomId(itemGroup)"
                  (moveUp)="moveItem.emit({ itemIndex: iIdx, delta: -1 })"
                  (moveDown)="moveItem.emit({ itemIndex: iIdx, delta: 1 })"
                  (duplicate)="duplicateItem.emit(iIdx)"
                  (remove)="removeItem.emit(iIdx)"
                  (responseTypeChanged)="itemResponseTypeChanged.emit(iIdx)"
                  (structureChanged)="structureChanged.emit()"
                />
              }
            }
          </div>

          @if (editable) {
            <div class="section-footer-actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                (click)="addItem.emit()"
                data-testid="add-item-btn"
              >
                + Adicionar Item nesta Seção
              </button>
            </div>
          }
        </div>
      }
    </article>
  `,
  styles: [
    `
      .section-card {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-left: 4px solid #0f766e;
        border-radius: 0.85rem;

        &.section-card-selected {
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
        }
      }

      .section-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        flex-wrap: wrap;
        padding: 0.8rem 1rem;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        border-radius: 0.85rem 0.85rem 0 0;
      }

      .section-header-left,
      .section-header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .section-order-badge {
        padding: 0.22rem 0.55rem;
        border-radius: 0.35rem;
        background: #0f766e;
        color: #ffffff;
        font-size: 0.72rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .section-summary-text {
        font-size: 0.94rem;
        font-weight: 700;
        color: #0f172a;
      }

      .section-count-chip {
        font-size: 0.73rem;
        font-weight: 600;
        padding: 0.14rem 0.48rem;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
      }

      .section-card-body {
        padding: 1.05rem;
        display: grid;
        gap: 0.9rem;
      }

      .items-stack {
        display: grid;
        gap: 0.9rem;
      }

      .empty-items-box {
        padding: 1rem;
        text-align: center;
        font-size: 0.82rem;
        color: #64748b;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 0.6rem;
      }

      .btn-icon {
        padding: 0.28rem 0.52rem;
        font-size: 0.77rem;
      }
    `,
  ],
})
export class SectionEditorComponent {
  @Input({ required: true }) sectionGroup!: SectionFormGroup;
  @Input() sectionIndex = 0;
  @Input() totalSections = 1;
  @Input() editable = true;
  @Input() selected = false;
  @Input() collapsed = false;
  @Input() submitted = false;
  @Input() domId = '';
  @Input() selectedItemGroup: ItemFormGroup | null = null;
  @Input() getItemDomId: (item: ItemFormGroup) => string = () => '';

  @Output() readonly toggleCollapse = new EventEmitter<void>();
  @Output() readonly moveUp = new EventEmitter<void>();
  @Output() readonly moveDown = new EventEmitter<void>();
  @Output() readonly duplicate = new EventEmitter<void>();
  @Output() readonly remove = new EventEmitter<void>();
  @Output() readonly addItem = new EventEmitter<void>();
  @Output() readonly moveItem = new EventEmitter<{ itemIndex: number; delta: -1 | 1 }>();
  @Output() readonly duplicateItem = new EventEmitter<number>();
  @Output() readonly removeItem = new EventEmitter<number>();
  @Output() readonly itemResponseTypeChanged = new EventEmitter<number>();
  @Output() readonly structureChanged = new EventEmitter<void>();

  get isSectionTitleInvalid(): boolean {
    const control = this.sectionGroup.controls.title;
    return Boolean(control.invalid && (control.dirty || control.touched || this.submitted));
  }
}
