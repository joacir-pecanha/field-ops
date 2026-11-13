import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormControl } from '@angular/forms';
import { SingleChoiceOptionsEditorComponent } from './single-choice-options-editor.component';

describe('SingleChoiceOptionsEditorComponent (TASK-010 Passo 4 & Passo 6)', () => {
  let fixture: ComponentFixture<SingleChoiceOptionsEditorComponent>;
  let component: SingleChoiceOptionsEditorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SingleChoiceOptionsEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SingleChoiceOptionsEditorComponent);
    component = fixture.componentInstance;
  });

  it('should render empty state, add default option pair and emit optionsChanged', () => {
    const options = new FormArray<FormControl<string>>([]);
    component.optionsArray = options;
    component.editable = true;
    const changedSpy = spyOn(component.optionsChanged, 'emit');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="choice-options-empty"]')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="choice-options-error"]')
    ).not.toBeNull();

    const defaultPairBtn = fixture.nativeElement.querySelector(
      '[data-testid="add-default-options-btn"]'
    ) as HTMLButtonElement;
    defaultPairBtn.click();
    fixture.detectChanges();

    expect(options.length).toBe(2);
    expect(changedSpy).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="choice-option-input"]').length
    ).toBe(2);
  });

  it('should add, reorder, remove options and warn on duplicates', () => {
    const options = new FormArray<FormControl<string>>([
      new FormControl('Automático', { nonNullable: true }),
      new FormControl('Manual', { nonNullable: true }),
    ]);
    component.optionsArray = options;
    component.editable = true;
    fixture.detectChanges();

    const addBtn = fixture.nativeElement.querySelector(
      '[data-testid="add-choice-option-btn"]'
    ) as HTMLButtonElement;
    addBtn.click();
    options.at(2).setValue('manual');
    fixture.detectChanges();

    expect(component.hasDuplicateOptions).toBeTrue();
    expect(
      fixture.nativeElement.querySelector('[data-testid="choice-options-duplicate-warning"]')
    ).not.toBeNull();

    // Corrigir rótulo e reordenar a última opção para cima
    options.at(2).setValue('Desligado');
    fixture.detectChanges();
    expect(component.hasDuplicateOptions).toBeFalse();

    const moveUpBtns = fixture.nativeElement.querySelectorAll(
      '[data-testid="move-choice-option-up-btn"]'
    ) as NodeListOf<HTMLButtonElement>;
    moveUpBtns[2].click();
    fixture.detectChanges();

    expect(options.getRawValue()).toEqual(['Automático', 'Desligado', 'Manual']);

    const removeBtns = fixture.nativeElement.querySelectorAll(
      '[data-testid="remove-choice-option-btn"]'
    ) as NodeListOf<HTMLButtonElement>;
    removeBtns[1].click();
    fixture.detectChanges();

    expect(options.getRawValue()).toEqual(['Automático', 'Manual']);
    expect(
      (fixture.nativeElement.querySelector('[data-testid="choice-options-count"]') as HTMLElement)
        .textContent
    ).toContain('2 opções válidas');
  });

  it('should hide mutation buttons when editable is false', () => {
    component.optionsArray = new FormArray<FormControl<string>>([
      new FormControl('Sim', { nonNullable: true }),
    ]);
    component.editable = false;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="add-choice-option-btn"]')
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="remove-choice-option-btn"]')
    ).toBeNull();
  });
});
