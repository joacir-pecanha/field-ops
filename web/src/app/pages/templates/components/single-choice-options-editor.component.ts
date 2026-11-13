import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';

/**
 * Subcomponente dedicado à configuração de opções exclusivas (rádio)
 * para itens do tipo SINGLE_CHOICE (TASK-010 Passo 4).
 */
@Component({
  selector: 'app-single-choice-options-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="options-editor" data-testid="single-choice-options-editor">
      <div class="options-header">
        <div class="options-title-group">
          <strong>Opções de Escolha Única (Rádio)</strong>
          <span class="options-count-chip" data-testid="choice-options-count">
            {{ validOptionsCount }}
            {{ validOptionsCount === 1 ? 'opção válida' : 'opções válidas' }}
          </span>
        </div>

        @if (editable) {
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            (click)="addOption()"
            data-testid="add-choice-option-btn"
          >
            + Opção
          </button>
        }
      </div>

      @if (optionsArray.controls.length === 0) {
        <div class="options-empty" data-testid="choice-options-empty">
          <span>Nenhuma opção configurada ainda.</span>
          @if (editable) {
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              (click)="addDefaultPair()"
              data-testid="add-default-options-btn"
            >
              Adicionar 2 opções iniciais
            </button>
          }
        </div>
      } @else {
        <div class="options-list">
          @for (optCtrl of optionsArray.controls; track optCtrl; let oIdx = $index) {
            <div class="option-row" data-testid="choice-option-row">
              <span class="option-index" aria-hidden="true">{{ oIdx + 1 }}.</span>
              <input
                type="text"
                [formControl]="optCtrl"
                [placeholder]="'Opção ' + (oIdx + 1)"
                [class.input-duplicate]="isDuplicateOption(oIdx)"
                (input)="onOptionInput()"
                (keydown.enter)="onOptionEnter($event, oIdx)"
                data-testid="choice-option-input"
              />
              @if (editable) {
                <button
                  type="button"
                  class="btn btn-secondary btn-icon"
                  (click)="moveOption(oIdx, -1)"
                  [disabled]="oIdx === 0"
                  title="Subir opção"
                  data-testid="move-choice-option-up-btn"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-icon"
                  (click)="moveOption(oIdx, 1)"
                  [disabled]="oIdx === optionsArray.length - 1"
                  title="Descer opção"
                  data-testid="move-choice-option-down-btn"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="btn btn-danger-outline btn-icon"
                  (click)="removeOption(oIdx)"
                  title="Remover opção"
                  data-testid="remove-choice-option-btn"
                >
                  ×
                </button>
              }
            </div>
          }
        </div>
      }

      @if (validOptionsCount === 0) {
        <span class="field-error" data-testid="choice-options-error">
          Adicione ao menos uma opção preenchida para liberar a publicação deste item.
        </span>
      } @else if (hasDuplicateOptions) {
        <span class="field-warning" data-testid="choice-options-duplicate-warning">
          Existem opções repetidas. Diferencie os rótulos para evitar ambiguidade para o técnico.
        </span>
      } @else if (hasBlankOptions) {
        <span class="field-hint">
          Opções em branco serão ignoradas ao salvar o modelo.
        </span>
      }
    </div>
  `,
  styles: [
    `
      .options-editor {
        display: grid;
        gap: 0.55rem;
        padding: 0.78rem;
        border-radius: 0.6rem;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
      }

      .options-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;

        strong {
          font-size: 0.84rem;
          color: #0f172a;
        }
      }

      .options-title-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .options-count-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.12rem 0.48rem;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .options-empty {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;
        padding: 0.6rem 0.7rem;
        border-radius: 0.5rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        font-size: 0.8rem;
        color: #64748b;
      }

      .options-list {
        display: grid;
        gap: 0.45rem;
      }

      .option-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: nowrap;

        input {
          flex: 1;
          min-width: 0;
          padding: 0.48rem 0.68rem;
          border-radius: 0.48rem;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.85rem;

          &:focus {
            outline: none;
            border-color: #0f766e;
            box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
          }

          &.input-duplicate {
            border-color: #d97706;
            background: #fffbeb;
          }
        }
      }

      .option-index {
        min-width: 1.3rem;
        font-size: 0.78rem;
        font-weight: 700;
        color: #64748b;
        text-align: right;
      }

      .btn-icon {
        padding: 0.28rem 0.52rem;
        font-size: 0.77rem;
      }

      .field-warning {
        font-size: 0.78rem;
        font-weight: 600;
        color: #b45309;
      }
    `,
  ],
})
export class SingleChoiceOptionsEditorComponent {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) optionsArray!: FormArray<FormControl<string>>;
  @Input() editable = true;

  @Output() readonly optionsChanged = new EventEmitter<void>();

  get validOptionsCount(): number {
    return this.optionsArray.controls.filter((ctrl) => ctrl.value.trim().length > 0).length;
  }

  get hasBlankOptions(): boolean {
    return this.optionsArray.controls.some((ctrl) => ctrl.value.trim().length === 0);
  }

  get hasDuplicateOptions(): boolean {
    const seen = new Set<string>();
    for (const ctrl of this.optionsArray.controls) {
      const normalized = ctrl.value.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      if (seen.has(normalized)) {
        return true;
      }
      seen.add(normalized);
    }
    return false;
  }

  isDuplicateOption(optionIndex: number): boolean {
    const target = this.optionsArray.at(optionIndex)?.value.trim().toLowerCase();
    if (!target) {
      return false;
    }
    let matches = 0;
    for (const ctrl of this.optionsArray.controls) {
      if (ctrl.value.trim().toLowerCase() === target) {
        matches += 1;
      }
    }
    return matches > 1;
  }

  addOption(): void {
    if (!this.editable) {
      return;
    }
    this.optionsArray.push(this.fb.nonNullable.control(''));
    this.optionsChanged.emit();
  }

  addDefaultPair(): void {
    if (!this.editable || this.optionsArray.length > 0) {
      return;
    }
    this.optionsArray.push(this.fb.nonNullable.control(''));
    this.optionsArray.push(this.fb.nonNullable.control(''));
    this.optionsChanged.emit();
  }

  removeOption(optionIndex: number): void {
    if (!this.editable) {
      return;
    }
    this.optionsArray.removeAt(optionIndex);
    this.optionsChanged.emit();
  }

  moveOption(optionIndex: number, delta: -1 | 1): void {
    if (!this.editable) {
      return;
    }
    const target = optionIndex + delta;
    if (target < 0 || target >= this.optionsArray.length) {
      return;
    }
    const control = this.optionsArray.at(optionIndex);
    this.optionsArray.removeAt(optionIndex, { emitEvent: false });
    this.optionsArray.insert(target, control, { emitEvent: false });
    this.optionsChanged.emit();
  }

  onOptionInput(): void {
    this.optionsChanged.emit();
  }

  onOptionEnter(event: Event, optionIndex: number): void {
    event.preventDefault();
    if (this.editable && optionIndex === this.optionsArray.length - 1) {
      this.addOption();
    }
  }
}
