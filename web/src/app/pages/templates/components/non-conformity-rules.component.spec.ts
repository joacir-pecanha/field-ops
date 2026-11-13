import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { ItemFormGroup } from '../template-form.types';
import { ResponseType } from '../template.service';
import { NonConformityRulesComponent } from './non-conformity-rules.component';

describe('NonConformityRulesComponent (TASK-010 Passo 4 & Passo 6)', () => {
  let fixture: ComponentFixture<NonConformityRulesComponent>;
  let component: NonConformityRulesComponent;
  let itemGroup: ItemFormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NonConformityRulesComponent],
    }).compileComponents();

    itemGroup = new FormGroup({
      code: new FormControl('GER-01', { nonNullable: true }),
      title: new FormControl('Lacre intacto', { nonNullable: true }),
      description: new FormControl('', { nonNullable: true }),
      responseType: new FormControl<ResponseType | ''>('CONFORMITY', {
        nonNullable: true,
      }),
      required: new FormControl(true, { nonNullable: true }),
      observationRequiredOnFailure: new FormControl(false, { nonNullable: true }),
      evidenceRequiredOnFailure: new FormControl(false, { nonNullable: true }),
      options: new FormArray<FormControl<string>>([]),
      orderIndex: new FormControl(0, { nonNullable: true }),
    });

    fixture = TestBed.createComponent(NonConformityRulesComponent);
    component = fixture.componentInstance;
    component.itemGroup = itemGroup;
    fixture.detectChanges();
  });

  it('should toggle required, observationRequiredOnFailure and evidenceRequiredOnFailure and update badges', () => {
    const changedSpy = spyOn(component.rulesChanged, 'emit');

    const obsCheckbox = fixture.nativeElement.querySelector(
      '[data-testid="item-obs-fail-checkbox"]'
    ) as HTMLInputElement;
    const evidenceCheckbox = fixture.nativeElement.querySelector(
      '[data-testid="item-evidence-fail-checkbox"]'
    ) as HTMLInputElement;

    obsCheckbox.click();
    evidenceCheckbox.click();
    fixture.detectChanges();

    expect(itemGroup.controls.observationRequiredOnFailure.value).toBeTrue();
    expect(itemGroup.controls.evidenceRequiredOnFailure.value).toBeTrue();
    expect(changedSpy).toHaveBeenCalledTimes(2);

    const summary = fixture.nativeElement.querySelector(
      '[data-testid="item-rules-summary"]'
    ) as HTMLElement;
    expect(summary.textContent).toContain('Obrigatório');
    expect(summary.textContent).toContain('NC exige observação');
    expect(summary.textContent).toContain('NC exige foto');
  });

  it('should display contextual failure hint according to responseType', () => {
    const note = fixture.nativeElement.querySelector(
      '[data-testid="non-conformity-context-note"]'
    ) as HTMLElement;
    expect(note.textContent).toContain('Não Conforme (NC)');

    itemGroup.controls.responseType.setValue('BOOLEAN');
    fixture.detectChanges();
    expect(note.textContent).toContain('"Não"');
  });
});
