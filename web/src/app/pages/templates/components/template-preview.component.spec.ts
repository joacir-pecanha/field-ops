import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  PreviewTemplateModel,
  TemplatePreviewComponent,
} from './template-preview.component';

describe('TemplatePreviewComponent (TASK-010 Passo 5 & Passo 6)', () => {
  let fixture: ComponentFixture<TemplatePreviewComponent>;
  let component: TemplatePreviewComponent;

  const fullTemplate: PreviewTemplateModel = {
    code: 'TPL-GER-01',
    title: 'Checklist Preventivo de Gerador',
    category: 'MECANICA',
    description: 'Verificações de campo para o técnico.',
    versionLabel: 'v1',
    statusLabel: 'Rascunho',
    sections: [
      {
        title: 'Segurança e Operação',
        description: 'Antes da partida',
        items: [
          {
            code: 'GER-01',
            title: 'Lacre intacto?',
            description: null,
            responseType: 'CONFORMITY',
            required: true,
            observationRequiredOnFailure: true,
            evidenceRequiredOnFailure: true,
            options: [],
          },
          {
            code: 'GER-02',
            title: 'Área limpa?',
            description: null,
            responseType: 'BOOLEAN',
            required: true,
            observationRequiredOnFailure: false,
            evidenceRequiredOnFailure: false,
            options: [],
          },
          {
            code: 'GER-03',
            title: 'Modo do painel',
            description: null,
            responseType: 'SINGLE_CHOICE',
            required: true,
            observationRequiredOnFailure: false,
            evidenceRequiredOnFailure: false,
            options: ['Automático', 'Manual', 'Desligado'],
          },
        ],
      },
      {
        title: 'Leituras e Evidências',
        description: null,
        items: [
          {
            code: 'GER-04',
            title: 'Horímetro',
            description: null,
            responseType: 'NUMBER',
            required: false,
            observationRequiredOnFailure: false,
            evidenceRequiredOnFailure: false,
            options: [],
          },
          {
            code: 'GER-05',
            title: 'Operador local',
            description: null,
            responseType: 'TEXT_SHORT',
            required: false,
            observationRequiredOnFailure: false,
            evidenceRequiredOnFailure: false,
            options: [],
          },
          {
            code: 'GER-06',
            title: 'Parecer técnico',
            description: null,
            responseType: 'TEXT_LONG',
            required: false,
            observationRequiredOnFailure: false,
            evidenceRequiredOnFailure: false,
            options: [],
          },
          {
            code: 'GER-07',
            title: 'Próxima revisão',
            description: null,
            responseType: 'DATE',
            required: false,
            observationRequiredOnFailure: false,
            evidenceRequiredOnFailure: false,
            options: [],
          },
          {
            code: 'GER-08',
            title: 'Foto frontal',
            description: null,
            responseType: 'PHOTO',
            required: false,
            observationRequiredOnFailure: false,
            evidenceRequiredOnFailure: false,
            options: [],
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplatePreviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplatePreviewComponent);
    component = fixture.componentInstance;
    component.template = fullTemplate;
    fixture.detectChanges();
  });

  it('should render inputs for all 8 configured response types and radio options (CA-02)', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="preview-template-title"]')?.textContent).toContain(
      'Checklist Preventivo de Gerador'
    );
    expect(root.querySelectorAll('[data-testid="preview-conformity-btn"]').length).toBe(3);
    expect(root.querySelectorAll('[data-testid="preview-boolean-btn"]').length).toBe(2);
    expect(root.querySelector('[data-testid="preview-text-short-input"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="preview-text-long-input"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="preview-number-input"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="preview-date-input"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="preview-photo-btn"]')).not.toBeNull();

    const radioOptions = root.querySelectorAll(
      '[data-testid="preview-single-choice-option"]'
    ) as NodeListOf<HTMLInputElement>;
    expect(radioOptions.length).toBe(3);
    expect(Array.from(radioOptions).map((opt) => opt.value)).toEqual([
      'Automático',
      'Manual',
      'Desligado',
    ]);
  });

  it('should update progress, enforce non-conformity observation/evidence and validate simulated completion', () => {
    const root = fixture.nativeElement as HTMLElement;

    // 1. Marcar GER-01 como Não Conforme (NC)
    const conformityBtns = root.querySelectorAll(
      '[data-testid="preview-conformity-btn"]'
    ) as NodeListOf<HTMLButtonElement>;
    conformityBtns[1].click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="preview-nc-panel"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="preview-nc-observation-input"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="preview-nc-evidence-btn"]')).not.toBeNull();

    // Tentar concluir ainda com pendências
    const completeBtn = root.querySelector(
      '[data-testid="preview-simulate-complete-btn"]'
    ) as HTMLButtonElement;
    completeBtn.click();
    fixture.detectChanges();

    const blockedResult = root.querySelector(
      '[data-testid="preview-validation-result"]'
    ) as HTMLElement;
    expect(blockedResult.textContent).toContain('Conclusão bloqueada');
    expect(blockedResult.textContent).toContain('Observação obrigatória');
    expect(blockedResult.textContent).toContain('Evidência fotográfica obrigatória');
    expect(blockedResult.textContent).toContain('Área limpa?');
    expect(blockedResult.textContent).toContain('Modo do painel');

    // 2. Preencher observação e evidência de NC + itens obrigatórios restantes
    component.setObservation('0-0', 'Lacre rompido no painel lateral.');
    component.addSimulatedEvidence('0-0');

    const booleanBtns = root.querySelectorAll(
      '[data-testid="preview-boolean-btn"]'
    ) as NodeListOf<HTMLButtonElement>;
    booleanBtns[0].click();

    const radioOptions = root.querySelectorAll(
      '[data-testid="preview-single-choice-option"]'
    ) as NodeListOf<HTMLInputElement>;
    radioOptions[0].click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="preview-progress-text"]')?.textContent).toContain(
      '3 de 8 itens respondidos'
    );

    completeBtn.click();
    fixture.detectChanges();

    const validResult = root.querySelector(
      '[data-testid="preview-validation-result"]'
    ) as HTMLElement;
    expect(validResult.textContent).toContain('Checklist válido para conclusão');
  });

  it('should render controlled fallback for empty template or missing responseType', () => {
    component.template = {
      title: 'Modelo Incompleto',
      sections: [
        {
          title: 'Seção 1',
          items: [
            {
              title: 'Item sem tipo',
              responseType: '',
              required: false,
              observationRequiredOnFailure: false,
              evidenceRequiredOnFailure: false,
              options: [],
            },
          ],
        },
      ],
    };
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="preview-unknown-type"]')
    ).not.toBeNull();

    component.template = {
      title: 'Modelo Vazio',
      sections: [],
    };
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="preview-empty-state"]')
    ).not.toBeNull();
  });
});
