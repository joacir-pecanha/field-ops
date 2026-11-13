import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EquipmentResponse } from '../../../core/master/master-data.models';
import { QrCodeModalComponent } from './qr-code-modal.component';

describe('QrCodeModalComponent (TASK-008 Passo 4)', () => {
  let fixture: ComponentFixture<QrCodeModalComponent>;
  let component: QrCodeModalComponent;

  const sampleEquipment: EquipmentResponse = {
    id: 'eq-1',
    siteId: 'site-1',
    siteName: 'Planta Sorocaba',
    clientId: 'cli-1',
    clientName: 'Indústria Alfa',
    code: 'EQP-GD-001',
    name: 'Gerador Diesel GD-001',
    assetNumber: 'PAT-2026-0001',
    serialNumber: 'SN-CAT-9001',
    manufacturer: 'Caterpillar',
    model: 'C15-500kVA',
    description: null,
    qrCode: 'QR-FIELDOPS-GD001',
    status: 'ACTIVE',
    active: true,
    installedAt: '2025-03-10',
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrCodeModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QrCodeModalComponent);
    component = fixture.componentInstance;
  });

  it('should render Canvas and SVG QR outputs for a given equipment', async () => {
    component.equipment = sampleEquipment;
    component.ngOnChanges({
      equipment: new SimpleChange(null, sampleEquipment, true),
    });
    fixture.detectChanges();

    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 100));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="qr-code-modal"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="qr-canvas"]')).not.toBeNull();
    expect(component.rawSvg()).toContain('<svg');
    expect(component.hdPngDataUrl()).toContain('data:image/png;base64,');

    const svgToggleBtn = fixture.nativeElement.querySelector(
      '[data-testid="qr-mode-svg-btn"]'
    ) as HTMLButtonElement;
    svgToggleBtn.click();
    fixture.detectChanges();

    const svgWrap = fixture.nativeElement.querySelector('[data-testid="qr-svg"]');
    expect(svgWrap).not.toBeNull();
    expect(svgWrap.innerHTML).toContain('<svg');
  });

  it('should emit closed event when clicking close button', () => {
    const closedSpy = spyOn(component.closed, 'emit');
    component.equipment = sampleEquipment;
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector(
      '[data-testid="qr-close-btn"]'
    ) as HTMLButtonElement;
    closeBtn.click();

    expect(closedSpy).toHaveBeenCalledTimes(1);
  });
});

