import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmModalComponent } from './confirm-modal.component';

describe('ConfirmModalComponent (TASK-008 Passo 5)', () => {
  let fixture: ComponentFixture<ConfirmModalComponent>;
  let component: ConfirmModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmModalComponent);
    component = fixture.componentInstance;
  });

  it('should not render dialog when open is false', () => {
    component.open = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="confirm-modal"]')).toBeNull();
  });

  it('should emit confirmed on click when extra confirmation is not required', () => {
    const confirmedSpy = spyOn(component.confirmed, 'emit');
    component.open = true;
    component.entityLabel = 'Gerador GD-001';
    component.message = 'Deseja inativar?';
    component.requireExtraConfirmation = false;
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector(
      '[data-testid="confirm-modal-confirm-btn"]'
    ) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBeFalse();
    confirmBtn.click();

    expect(confirmedSpy).toHaveBeenCalledTimes(1);
  });

  it('should block confirmation until extra checkbox is checked for EX-01', () => {
    const confirmedSpy = spyOn(component.confirmed, 'emit');
    component.open = true;
    component.entityLabel = 'Indústria Alfa';
    component.message = 'Deseja inativar cliente?';
    component.alertBannerText = 'Possui 1 local ativo e inspeções vinculadas.';
    component.requireExtraConfirmation = true;
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector(
      '[data-testid="confirm-modal-confirm-btn"]'
    ) as HTMLButtonElement;
    const checkbox = fixture.nativeElement.querySelector(
      '[data-testid="confirm-modal-extra-checkbox"]'
    ) as HTMLInputElement;

    expect(fixture.nativeElement.querySelector('[data-testid="confirm-modal-alert-banner"]')).not.toBeNull();
    expect(confirmBtn.disabled).toBeTrue();

    confirmBtn.click();
    expect(confirmedSpy).not.toHaveBeenCalled();

    checkbox.click();
    fixture.detectChanges();

    expect(confirmBtn.disabled).toBeFalse();
    confirmBtn.click();
    expect(confirmedSpy).toHaveBeenCalledTimes(1);
  });
});

