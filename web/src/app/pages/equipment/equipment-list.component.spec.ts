import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClientsApiService } from '../../core/master/clients-api.service';
import { EquipmentApiService } from '../../core/master/equipment-api.service';
import {
  ClientResponse,
  EquipmentResponse,
  MasterDataApiError,
  PageResponse,
  SiteResponse,
} from '../../core/master/master-data.models';
import { SitesApiService } from '../../core/master/sites-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { EquipmentListComponent } from './equipment-list.component';

describe('EquipmentListComponent (TASK-008 Passo 6)', () => {
  let fixture: ComponentFixture<EquipmentListComponent>;
  let component: EquipmentListComponent;
  let equipmentApiMock: jasmine.SpyObj<EquipmentApiService>;
  let sitesApiMock: jasmine.SpyObj<SitesApiService>;
  let clientsApiMock: jasmine.SpyObj<ClientsApiService>;
  let notificationsMock: jasmine.SpyObj<NotificationService>;

  const sampleClient: ClientResponse = {
    id: 'cli-1',
    code: 'CLI-ALFA',
    name: 'Indústria Alfa',
    legalName: null,
    document: null,
    email: null,
    phone: null,
    status: 'ACTIVE',
    active: true,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

  const sampleSite: SiteResponse = {
    id: 'site-1',
    clientId: 'cli-1',
    clientName: 'Indústria Alfa',
    code: 'SITE-SOR-01',
    name: 'Planta Sorocaba',
    description: null,
    addressLine: null,
    city: 'Sorocaba',
    state: 'SP',
    postalCode: null,
    latitude: null,
    longitude: null,
    contactName: null,
    contactPhone: null,
    status: 'ACTIVE',
    active: true,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    version: 0,
  };

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

  function equipmentPage(items: EquipmentResponse[]): PageResponse<EquipmentResponse> {
    return {
      content: items,
      page: 0,
      size: 20,
      totalElements: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      first: true,
      last: true,
    };
  }

  beforeEach(async () => {
    equipmentApiMock = jasmine.createSpyObj<EquipmentApiService>('EquipmentApiService', [
      'list',
      'create',
      'update',
      'deactivate',
      'activate',
      'checkQrCodeTaken',
    ]);
    sitesApiMock = jasmine.createSpyObj<SitesApiService>('SitesApiService', [
      'listByClient',
      'getById',
    ]);
    clientsApiMock = jasmine.createSpyObj<ClientsApiService>('ClientsApiService', ['list']);
    notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'showSuccess',
      'showError',
      'showWarning',
      'showInfo',
    ]);

    clientsApiMock.list.and.returnValue(
      of({
        content: [sampleClient],
        page: 0,
        size: 200,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      })
    );
    sitesApiMock.listByClient.and.returnValue(of([sampleSite]));
    equipmentApiMock.list.and.returnValue(of(equipmentPage([sampleEquipment])));
    equipmentApiMock.checkQrCodeTaken.and.returnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [EquipmentListComponent],
      providers: [
        provideRouter([]),
        { provide: EquipmentApiService, useValue: equipmentApiMock },
        { provide: SitesApiService, useValue: sitesApiMock },
        { provide: ClientsApiService, useValue: clientsApiMock },
        { provide: NotificationService, useValue: notificationsMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EquipmentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should filter sites dynamically when client filter changes (RF-03, CA-02)', () => {
    component.clientFilter = 'cli-1';
    component.siteFilter = 'site-old';
    component.onFilterClientChange();

    expect(component.siteFilter).toBe('');
    expect(sitesApiMock.listByClient).toHaveBeenCalledWith('cli-1', false, 200);
    expect(component.filterSites()).toEqual([sampleSite]);
    expect(equipmentApiMock.list).toHaveBeenCalledWith(
      jasmine.objectContaining({ clientId: 'cli-1', siteId: undefined })
    );
  });

  it('should load only active sites belonging to selected client inside the form (RN-010, RN-014)', () => {
    component.openCreateForm();
    fixture.detectChanges();

    component.form.controls.clientId.setValue('cli-1');
    component.onFormClientChange();
    fixture.detectChanges();

    expect(sitesApiMock.listByClient).toHaveBeenCalledWith('cli-1', true, 200);
    expect(component.formSites()).toEqual([sampleSite]);
    expect(component.form.controls.siteId.value).toBe('');
  });

  it('should highlight QR collision in vivid red from async validator and HTTP 409 response (EX-02)', fakeAsync(() => {
    component.openCreateForm();
    fixture.detectChanges();

    equipmentApiMock.checkQrCodeTaken.and.returnValue(of(true));
    component.form.patchValue({
      clientId: 'cli-1',
      siteId: 'site-1',
      name: 'Compressor CP-002',
      qrCode: 'QR-FIELDOPS-GD001',
    });
    tick(400);
    fixture.detectChanges();

    expect(component.hasQrCollision()).toBeTrue();
    const collisionMsg = fixture.nativeElement.querySelector('[data-testid="qr-collision-error"]');
    expect(collisionMsg).not.toBeNull();
    expect(collisionMsg.textContent).toContain('Colisão de QR Code');

    equipmentApiMock.checkQrCodeTaken.and.returnValue(of(false));
    component.suggestUniqueQrCode();
    tick(400);
    fixture.detectChanges();

    expect(component.form.controls.qrCode.value).toMatch(/^QR-FIELDOPS-/);
    expect(component.hasQrCollision()).toBeFalse();

    equipmentApiMock.create.and.returnValue(
      throwError(
        () =>
          new MasterDataApiError(
            "Já existe um equipamento cadastrado com o QR Code informado.",
            409,
            'DUPLICATE_QR_CODE'
          )
      )
    );

    component.submitForm();
    fixture.detectChanges();

    expect(component.hasQrCollision()).toBeTrue();
    expect(component.qrServerCollision()).toContain('QR Code');
  }));

  it('should open QR Code modal from table item and from form preview (RF-04, CA-03)', () => {
    component.openQrModal(sampleEquipment);
    expect(component.qrModalEquipment()?.qrCode).toBe('QR-FIELDOPS-GD001');

    component.closeQrModal();
    expect(component.qrModalEquipment()).toBeNull();

    component.openCreateForm();
    component.form.patchValue({
      clientId: 'cli-1',
      siteId: 'site-1',
      name: 'Novo Transformador',
      qrCode: 'QR-PREVIEW-999',
    });
    component.formSites.set([sampleSite]);

    component.openFormQrPreview();
    expect(component.qrModalEquipment()?.qrCode).toBe('QR-PREVIEW-999');
    expect(component.qrModalEquipment()?.siteName).toBe('Planta Sorocaba');
  });

  it('should require modal confirmation before deactivating or decommissioning equipment (RF-05, CA-04)', fakeAsync(() => {
    component.requestDeactivate(sampleEquipment);
    fixture.detectChanges();

    expect(component.confirmTarget()?.id).toBe('eq-1');

    equipmentApiMock.deactivate.and.returnValue(
      of({ ...sampleEquipment, status: 'INACTIVE', active: false })
    );
    component.confirmDeactivate();
    expect(equipmentApiMock.deactivate).toHaveBeenCalledWith('eq-1');

    component.openEditForm(sampleEquipment);
    fixture.detectChanges();
    tick(400);

    component.form.controls.status.setValue('DECOMMISSIONED');
    component.submitForm();
    fixture.detectChanges();

    expect(equipmentApiMock.update).not.toHaveBeenCalled();
    expect(component.pendingFormPayload()?.status).toBe('DECOMMISSIONED');

    equipmentApiMock.update.and.returnValue(
      of({ ...sampleEquipment, status: 'DECOMMISSIONED', active: false })
    );
    component.confirmDeactivate();
    fixture.detectChanges();
    expect(equipmentApiMock.update).toHaveBeenCalledWith(
      'eq-1',
      jasmine.objectContaining({ status: 'DECOMMISSIONED' })
    );
  }));
});

