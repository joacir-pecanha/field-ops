import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ItemFormGroup } from '../template-form.types';

/**
 * Subcomponente dedicado à configuração de obrigatoriedade e regras de não conformidade
 * (exigir observação e/ou evidência fotográfica em caso de falha) — TASK-010 Passo 4.
 */
@Component({
  selector: 'app-non-conformity-rules',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="rules-panel" data-testid="non-conformity-rules-panel">
      <div class="rules-header">
        <div class="rules-title-row">
          <span class="rules-heading">Regras de Preenchimento e Não Conformidade</span>
          @if (activeRuleBadges.length > 0) {
            <div class="rules-badges" data-testid="item-rules-summary">
              @for (badge of activeRuleBadges; track badge.label) {
                <span class="rule-pill" [class.rule-pill-warn]="badge.warning">
                  {{ badge.label }}
                </span>
              }
            </div>
          }
        </div>
        <p class="rules-context-note" data-testid="non-conformity-context-note">
          {{ failureTriggerHint }}
        </p>
      </div>

      <div class="item-rules-grid">
        <label class="rule-checkbox" [class.rule-checkbox-active]="itemGroup.controls.required.value">
          <input
            type="checkbox"
            [formControl]="itemGroup.controls.required"
            (change)="rulesChanged.emit()"
            data-testid="item-required-checkbox"
          />
          <span>
            <strong>Resposta obrigatória</strong>
            <small>Impede concluir inspeção sem responder</small>
          </span>
        </label>

        <label
          class="rule-checkbox"
          [class.rule-checkbox-warn]="itemGroup.controls.observationRequiredOnFailure.value"
        >
          <input
            type="checkbox"
            [formControl]="itemGroup.controls.observationRequiredOnFailure"
            (change)="rulesChanged.emit()"
            data-testid="item-obs-fail-checkbox"
          />
          <span>
            <strong>Exigir observação em Não Conforme</strong>
            <small>Regra require_observation_on_fail (RN-038)</small>
          </span>
        </label>

        <label
          class="rule-checkbox"
          [class.rule-checkbox-warn]="itemGroup.controls.evidenceRequiredOnFailure.value"
        >
          <input
            type="checkbox"
            [formControl]="itemGroup.controls.evidenceRequiredOnFailure"
            (change)="rulesChanged.emit()"
            data-testid="item-evidence-fail-checkbox"
          />
          <span>
            <strong>Exigir foto em Não Conforme</strong>
            <small>Regra require_evidence_on_fail (RN-039)</small>
          </span>
        </label>
      </div>
    </div>
  `,
  styles: [
    `
      .rules-panel {
        display: grid;
        gap: 0.55rem;
        padding: 0.75rem;
        border-radius: 0.6rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }

      .rules-header {
        display: grid;
        gap: 0.25rem;
      }

      .rules-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .rules-heading {
        font-size: 0.8rem;
        font-weight: 700;
        color: #1e293b;
      }

      .rules-badges {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .rule-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.12rem 0.48rem;
        border-radius: 999px;
        background: #f0fdfa;
        border: 1px solid #99f6e4;
        color: #0f766e;
        font-size: 0.7rem;
        font-weight: 700;

        &.rule-pill-warn {
          background: #fffbeb;
          border-color: #fde68a;
          color: #b45309;
        }
      }

      .rules-context-note {
        margin: 0;
        font-size: 0.74rem;
        color: #64748b;
      }

      .item-rules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.55rem;
      }

      .rule-checkbox {
        display: flex;
        align-items: flex-start;
        gap: 0.45rem;
        padding: 0.5rem 0.6rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        font-size: 0.82rem;
        color: #1e293b;
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;

        input {
          margin-top: 0.15rem;
          accent-color: #0f766e;
        }

        small {
          display: block;
          font-size: 0.73rem;
          color: #64748b;
        }

        &.rule-checkbox-active {
          border-color: #99f6e4;
          background: #f0fdfa;
        }

        &.rule-checkbox-warn {
          border-color: #fcd34d;
          background: #fffbeb;
        }
      }
    `,
  ],
})
export class NonConformityRulesComponent {
  @Input({ required: true }) itemGroup!: ItemFormGroup;

  @Output() readonly rulesChanged = new EventEmitter<void>();

  get activeRuleBadges(): Array<{ label: string; warning: boolean }> {
    const badges: Array<{ label: string; warning: boolean }> = [];
    if (this.itemGroup.controls.required.value) {
      badges.push({ label: 'Obrigatório', warning: false });
    }
    if (this.itemGroup.controls.observationRequiredOnFailure.value) {
      badges.push({ label: 'NC exige observação', warning: true });
    }
    if (this.itemGroup.controls.evidenceRequiredOnFailure.value) {
      badges.push({ label: 'NC exige foto', warning: true });
    }
    return badges;
  }

  get failureTriggerHint(): string {
    const type = this.itemGroup.controls.responseType.value;
    if (type === 'CONFORMITY') {
      return 'Para Conformidade, as regras de não conformidade são acionadas quando o técnico selecionar "Não Conforme (NC)".';
    }
    if (type === 'BOOLEAN') {
      return 'Para Booleano, as regras de falha podem ser acionadas quando o técnico selecionar "Não".';
    }
    return 'As regras de não conformidade ficam salvas no item e são aplicadas no app sempre que uma falha for registrada.';
  }
}
