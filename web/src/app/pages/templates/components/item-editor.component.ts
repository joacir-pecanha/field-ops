import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ItemFormGroup } from '../template-form.types';
import { RESPONSE_TYPE_OPTIONS } from '../template.service';
import { NonConformityRulesComponent } from './non-conformity-rules.component';
import { SingleChoiceOptionsEditorComponent } from './single-choice-options-editor.component';

/**
 * Subcomponente de configuração detalhada de item de checklist (TASK-010 Passo 4).
 */
@Component({
  selector: 'app-item-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NonConformityRulesComponent,
    SingleChoiceOptionsEditorComponent,
  ],
  template: `
    <div
      class="item-card"
      [id]="domId"
      [class.item-card-selected]="selected"
      [class.item-card-incomplete]="issues.length > 0"
      [formGroup]="itemGroup"
      data-testid="builder-item-card"
    >
      <div class="item-card-header">
        <div class="item-header-left">
          <span class="item-order-badge"> Item {{ sectionIndex + 1 }}.{{ itemIndex + 1 }} </span>
          @for (issue of issues; track issue) {
            <span class="item-incomplete-pill">{{ issue }}</span>
          }
        </div>

        @if (editable) {
          <div class="section-header-actions">
            <button
              type="button"
              class="btn btn-secondary btn-icon"
              (click)="moveUp.emit()"
              [disabled]="itemIndex === 0"
              title="Mover item para cima"
              data-testid="move-item-up-btn"
            >
              ↑
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-icon"
              (click)="moveDown.emit()"
              [disabled]="itemIndex === totalItemsInSection - 1"
              title="Mover item para baixo"
              data-testid="move-item-down-btn"
            >
              ↓
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-icon"
              (click)="duplicate.emit()"
              data-testid="duplicate-item-btn"
            >
              Duplicar
            </button>
            <button
              type="button"
              class="btn btn-danger-outline btn-icon"
              (click)="remove.emit()"
              data-testid="remove-item-btn"
            >
              Excluir
            </button>
          </div>
        }
      </div>

      <div class="form-grid">
        <div class="form-field">
          <label [attr.for]="'item-title-' + sectionIndex + '-' + itemIndex">
            Pergunta / Título do item *
          </label>
          <input
            [id]="'item-title-' + sectionIndex + '-' + itemIndex"
            type="text"
            formControlName="title"
            placeholder="Ex.: Nível de óleo lubrificante dentro da faixa?"
            [class.input-invalid]="isTitleInvalid"
            data-testid="item-title-input"
          />
          @if (isTitleInvalid) {
            <span class="field-error">O título do item é obrigatório.</span>
          }
        </div>

        <div class="form-field">
          <label [attr.for]="'item-type-' + sectionIndex + '-' + itemIndex">
            Tipo de resposta *
          </label>
          <select
            [id]="'item-type-' + sectionIndex + '-' + itemIndex"
            formControlName="responseType"
            (change)="responseTypeChanged.emit()"
            [class.input-invalid]="!itemGroup.controls.responseType.value"
            data-testid="item-response-type-select"
          >
            <option value="">Selecione o tipo de resposta...</option>
            @for (rt of responseTypeOptions; track rt.value) {
              <option [value]="rt.value">{{ rt.label }}</option>
            }
          </select>
          @if (!itemGroup.controls.responseType.value) {
            <span class="field-error">
              Selecione um tipo de resposta para liberar a publicação.
            </span>
          }
        </div>

        <div class="form-field">
          <label [attr.for]="'item-code-' + sectionIndex + '-' + itemIndex">Código do item</label>
          <input
            [id]="'item-code-' + sectionIndex + '-' + itemIndex"
            type="text"
            formControlName="code"
            placeholder="Ex.: CHK-01"
          />
        </div>

        <div class="form-field">
          <label [attr.for]="'item-desc-' + sectionIndex + '-' + itemIndex">
            Orientação adicional ao técnico
          </label>
          <input
            [id]="'item-desc-' + sectionIndex + '-' + itemIndex"
            type="text"
            formControlName="description"
            placeholder="Critério de aceitação ou dica de verificação..."
          />
        </div>
      </div>

      <app-non-conformity-rules
        [itemGroup]="itemGroup"
        (rulesChanged)="structureChanged.emit()"
      />

      @if (itemGroup.controls.responseType.value === 'SINGLE_CHOICE') {
        <app-single-choice-options-editor
          [optionsArray]="itemGroup.controls.options"
          [editable]="editable"
          (optionsChanged)="structureChanged.emit()"
        />
      }
    </div>
  `,
  styles: [
    `
      .item-card {
        border: 1px solid #e2e8f0;
        border-radius: 0.7rem;
        padding: 0.9rem;
        background: #fcfdff;
        display: grid;
        gap: 0.8rem;

        &.item-card-selected {
          border-color: #0f766e;
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.14);
        }

        &.item-card-incomplete {
          border-color: #f59e0b;
          background: #fffdf7;
        }
      }

      .item-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .item-header-left,
      .section-header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .item-order-badge {
        padding: 0.14rem 0.42rem;
        border-radius: 0.35rem;
        background: #e2e8f0;
        color: #1e293b;
        font-size: 0.72rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .item-incomplete-pill {
        padding: 0.16rem 0.52rem;
        border-radius: 999px;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .btn-icon {
        padding: 0.28rem 0.52rem;
        font-size: 0.77rem;
      }
    `,
  ],
})
export class ItemEditorComponent {
  readonly responseTypeOptions = RESPONSE_TYPE_OPTIONS;

  @Input({ required: true }) itemGroup!: ItemFormGroup;
  @Input() sectionIndex = 0;
  @Input() itemIndex = 0;
  @Input() totalItemsInSection = 1;
  @Input() editable = true;
  @Input() selected = false;
  @Input() submitted = false;
  @Input() domId = '';

  @Output() readonly moveUp = new EventEmitter<void>();
  @Output() readonly moveDown = new EventEmitter<void>();
  @Output() readonly duplicate = new EventEmitter<void>();
  @Output() readonly remove = new EventEmitter<void>();
  @Output() readonly responseTypeChanged = new EventEmitter<void>();
  @Output() readonly structureChanged = new EventEmitter<void>();

  get issues(): string[] {
    const item = this.itemGroup.getRawValue();
    const issues: string[] = [];
    if (!item.title.trim()) {
      issues.push('Título obrigatório');
    }
    if (!item.responseType) {
      issues.push('Sem tipo de resposta');
    } else if (
      item.responseType === 'SINGLE_CHOICE' &&
      !item.options.some((opt) => opt.trim().length > 0)
    ) {
      issues.push('Sem opções válidas');
    }
    return issues;
  }

  get isTitleInvalid(): boolean {
    const control = this.itemGroup.controls.title;
    return Boolean(control.invalid && (control.dirty || control.touched || this.submitted));
  }
}
